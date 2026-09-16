/**
 * KV 驱动（自动适配 Cloudflare / EdgeOne）
 * 
 * 支持两种模式：
 * 1. Binding 模式：直接访问 KV binding（Cloudflare Workers / EdgeOne Edge Functions）
 * 2. HTTP 代理模式：通过 Edge Function 代理访问（EdgeOne Node Functions）
 * 
 * 自动检测环境并选择合适的模式。
 */
import { sanitizeProxyOrigin } from "../proxy"
import { probeWebKvBinding } from "../kv-binding"
import type { Driver, EnvContext } from "../types"

/*
 * 形态判定（含 RESP 客户端排除）统一在 ../kv-binding 实现。
 * 历史教训：EdgeOne Node 云函数注入的 `KV` 是 Redis/RESP 客户端，
 * 它同样暴露 get/set —— 只在本地按「有没有 get/set」判断会把它当 KV 用，
 * 于是驱动被选中、每次读写却抛 `Not connected`，整站存储被拦成 503。
 */

/**
 * 获取 KV binding（仅返回符合 Web KV API 的绑定）。
 *
 * 注意：不能写成 `env || globalThis` —— 只要 env 是真值就不会回退到
 * globalThis，而 EdgeOne Edge Functions 会把绑定名注入为全局标识符。
 * 因此这里两处都要检查，且都要通过接口形态校验。
 */
function getKvBinding(env?: any): any | null {
  const g = globalThis as any
  // 绑定名统一为 KV（KV namespace binding 的通用约定名）
  return probeWebKvBinding([env?.KV, g?.KV])
}

/**
 * 获取代理内部调用密钥。
 *
 * Edge Function 侧用**完整密钥**校验 X-Internal-Call。
 *
 * 只从环境变量读取，原因：
 *  1. 若走 KV 回退读取密钥，则需要先访问 KV 才能拿密钥、拿密钥才能访问 KV，
 *     形成循环依赖；
 *  2. 打包产物中不能依赖源码相对路径的动态 import。
 *
 * 因此 KV 代理模式要求显式配置 JWT_SECRET（>=16 字符）。
 */
function getProxySecret(env?: EnvContext): string | null {
  try {
    const s = env?.JWT_SECRET
    return typeof s === "string" && s.length >= 16 ? s : null
  } catch {
    return null
  }
}

/**
 * Detect missing configuration for KV proxy mode.
 *
 * Triggered when all of the following hold:
 *  1. The current env has no KV binding, so the HTTP proxy must be used.
 *  2. No JWT_SECRET (>= 16 chars) is configured, so the proxy cannot be
 *     authenticated.
 *
 * The combination "no binding + proxy required" only occurs on EdgeOne Node
 * Functions: Cloudflare Workers have a native binding, and other platforms
 * never take the proxy branch. So no platform sniffing is needed.
 *
 * @returns A human-readable configuration error, or null when valid.
 */
export function checkProxyConfig(env?: any): string | null {
  try {
    if (getKvBinding(env) !== null) return null // binding mode, no secret needed
    if (getProxySecret(env)) return null // secret present
  } catch {
    // 探测自身异常（异常 getter 等）视为「无可用 binding」，
    // 继续走到报错分支，而不是让调用方崩溃。
  }

  return (
    "KV proxy mode requires the JWT_SECRET " +
    "environment variable with at least 16 characters.\n" +
    "Reason: EdgeOne Node Functions cannot access KV directly and must go " +
    "through an Edge Function proxy, whose authentication depends on this " +
    "secret.\n" +
    "Add it under Environment Variables in the EdgeOne project settings, for " +
    "example:\n" +
    "  JWT_SECRET=<random string of 32+ characters>\n" +
    "Generate one with: openssl rand -hex 32"
  )
}

/**
 * 构建 HTTP 代理请求头
 */
function buildProxyHeaders(env?: EnvContext): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  }

  // 内部调用标识：提交**完整密钥**（Edge Function 侧常量时间比对）。
  // 不截断 —— 截断会把熵降到 64 bit，且该通道绕过管理员角色校验。
  const sharedSecret = getProxySecret(env)
  if (sharedSecret) {
    headers["X-Internal-Call"] = sharedSecret
  }

  // 如果有用户 token，也携带上（用于角色校验）
  const userToken = (env as any)?._currentUserToken
  if (userToken) {
    headers["Authorization"] = `Bearer ${userToken}`
  }

  return headers
}

/**
 * 获取 HTTP 代理基础 URL（必须是绝对地址）。
 *
 * Node 的 fetch 不接受相对 URL（会抛 ERR_INVALID_URL），因此这里不能返回 ""。
 * 优先级：
 *  1. EO_KV_URLS —— 显式配置的完整地址（跨域 / 本地调试）
 *  2. __requestOrigin —— 由 index.ts 中间件注入的当前请求 origin，
 *     即同一部署的自身域名，用于 Node 云函数自调用 Edge Function
 */
function getProxyBaseUrl(env?: EnvContext): string {
  if (!env) return ""

  const explicit = (env as any).EO_KV_URLS
  if (explicit) {
    const safe = sanitizeProxyOrigin(explicit, env)
    if (safe) return safe
  }

  const origin = (env as any).__requestOrigin
  if (origin) {
    const safe = sanitizeProxyOrigin(origin, env)
    if (safe) return safe
  }

  return ""
}

/**
 * KV 代理健康探测（唯一实现）。
 *
 * isAvailable() 与 health() 共用，避免两处各自实现导致判定标准漂移。
 * 判定：HTTP 200 表示代理与 KV 均可用；401 表示代理可达但鉴权失败，
 * 属于「代理部署存在但密钥不对」。
 *
 * 注意两个调用方对 401 的取舍不同，故这里只返回原始探测结果：
 *   - isAvailable() 把 401 视为可用（代理已部署，驱动可被选中）
 *   - health() 把 401 视为不可用（鉴权失败，持久化不可依赖）
 */
async function probeProxy(
  env?: EnvContext,
): Promise<{ ok: boolean; status: number; error?: string }> {
  const configError = checkProxyConfig(env)
  if (configError) {
    return { ok: false, status: 0, error: configError.split("\n")[0] }
  }

  const baseUrl = getProxyBaseUrl(env)
  if (!baseUrl) {
    return {
      ok: false,
      status: 0,
      error:
        "cannot determine deployment origin. " +
        "Set EO_KV_URLS to the deployment origin.",
    }
  }

  try {
    const url = `${baseUrl}/kv-list?prefix=__health__`
    const response = await fetch(url, {
      method: "GET",
      headers: buildProxyHeaders(env),
    })
    return { ok: response.ok, status: response.status }
  } catch (err: any) {
    return { ok: false, status: 0, error: err?.message || String(err) }
  }
}

/**
 * 解析代理基础 URL，无法确定时抛出明确错误。
 *
 * 集中校验「密钥 + origin」两个前置条件，避免各方法重复检查，
 * 也让 Node 的 ERR_INVALID_URL 不会以晦涩形式出现在日志里。
 */
function requireProxyBaseUrl(env?: EnvContext): string {
  const configError = checkProxyConfig(env)
  if (configError) {
    throw new Error("KV proxy misconfigured: " + configError.split("\n")[0])
  }

  const baseUrl = getProxyBaseUrl(env)
  if (!baseUrl) {
    throw new Error(
      "KV proxy base URL unavailable: cannot determine deployment origin. " +
        "Set EO_KV_URLS to the deployment origin.",
    )
  }

  return baseUrl
}

export const kvDriver: Driver = {
  name: "kv",

  async isAvailable(env?: any): Promise<boolean> {
    // 模式1: 检查 KV binding
    if (getKvBinding(env) !== null) {
      return true
    }

    // 模式2: HTTP 代理（EdgeOne Node Functions 拿不到 binding）
    const probe = await probeProxy(env)
    if (!probe.ok && probe.status !== 401) {
      if (probe.error) console.error("[DB] KV proxy unavailable: " + probe.error)
      return false
    }
    return true
  },

  async init(env?: any): Promise<void> {
    // KV 无需初始化
  },

  async get(key: string, env?: any): Promise<string | null> {
    const kv = getKvBinding(env)
    
    // 模式1: Binding 模式
    if (kv) {
      // Cloudflare KV 用 get(key, "text")，EdgeOne KV 用 get(key, {type:"text"})，
      // 两者签名不兼容，需按序尝试并归一化返回值（避免拿到对象导致上游 JSON.parse 失败）。
      //
      // 但要区分「签名不兼容」与「真实故障」：
      //   - 签名不兼容会抛 TypeError（参数类型不符），此时才应回退到第二种签名；
      //   - 网络/权限错误（401、超时等）必须**原样抛出**，否则会被第二次尝试
      //     掩盖成 "key not found"，让调用方误判为数据不存在而写入错误状态。
      const isSignatureError = (e: any): boolean =>
        e instanceof TypeError ||
        /not a function|invalid|unexpected|argument/i.test(
          String(e?.message || ""),
        )

      let value: any
      try {
        value = await kv.get(key, "text")
      } catch (e) {
        if (!isSignatureError(e)) throw e
        value = undefined
      }

      if (value === undefined || value === null) {
        try {
          value = await kv.get(key, { type: "text" })
        } catch (e) {
          // 若第一种签名已成功执行（未抛签名错误），说明第二种只是"空结果"的回退，
          // 此时真实错误同样要抛出，不得吞掉。
          if (!isSignatureError(e)) throw e
          value = null
        }
      }

      if (value === undefined || value === null) return null
      if (typeof value === "string") return value
      // 绑定误返回对象时统一序列化，保持 Driver.get 的 string 契约
      return JSON.stringify(value)
    }
    
    // 模式2: HTTP 代理模式（无原生 binding → 经 Edge Function 代理）
    const baseUrl = requireProxyBaseUrl(env)
    const url = `${baseUrl}/kv-get?key=${encodeURIComponent(key)}`

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: buildProxyHeaders(env),
      })

      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        throw new Error(`KV proxy get failed: ${response.status}`)
      }

      const data = await response.json() as { value?: string | null }
      // 归一化为 string | null：Edge Function 在错误分支只返回 { error }，
      // 此时 data.value 为 undefined，不能直接透传（调用方按 === null 判断会漏掉）。
      if (data?.value === undefined || data?.value === null) return null
      return typeof data.value === "string" ? data.value : String(data.value)
    } catch (err) {
      console.error(`[KV] get(${key}) failed:`, err)
      throw err
    }
  },

  async put(key: string, value: string, env?: any): Promise<void> {
    const kv = getKvBinding(env)
    
    // 模式1: Binding 模式
    if (kv) {
      await kv.put(key, value)
      return
    }
    
    // 模式2: HTTP 代理模式
    const baseUrl = requireProxyBaseUrl(env)
    const url = `${baseUrl}/kv-put`

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: buildProxyHeaders(env),
        body: JSON.stringify({ key, value }),
      })

      if (!response.ok) {
        throw new Error(`KV proxy put failed: ${response.status}`)
      }
    } catch (err) {
      console.error(`[KV] put(${key}) failed:`, err)
      throw err
    }
  },

  async delete(key: string, env?: any): Promise<void> {
    const kv = getKvBinding(env)
    
    // 模式1: Binding 模式
    if (kv) {
      await kv.delete(key)
      return
    }
    
    // 模式2: HTTP 代理模式
    const baseUrl = requireProxyBaseUrl(env)
    const url = `${baseUrl}/kv-delete?key=${encodeURIComponent(key)}`

    try {
      const response = await fetch(url, {
        method: "DELETE",
        headers: buildProxyHeaders(env),
      })

      if (!response.ok && response.status !== 404) {
        throw new Error(`KV proxy delete failed: ${response.status}`)
      }
    } catch (err) {
      console.error(`[KV] delete(${key}) failed:`, err)
      throw err
    }
  },

  async list(prefix: string, env?: any): Promise<string[]> {
    const kv = getKvBinding(env)
    
    // 模式1: Binding 模式
    if (kv) {
      // EdgeOne KV list() 语义兼容两种官方文档说法：
      //   形态 A：page.keys -> [{ key, ttl, meta }]，cursor 手动取末个 key
      //   形态 B：page.keys -> [{ name }]，page.cursor 为下一页游标
      // 元素名统一取 `key ?? name`，游标优先用 page.cursor。
      const keyNameOf = (item: any): string | null => {
        if (typeof item === "string") return item || null
        if (!item || typeof item !== "object") return null
        const name = item.key ?? item.name
        return typeof name === "string" && name ? name : null
      }

      const keys: string[] = []
      const seen = new Set<string>()
      let cursor = ""
      let complete = false
      let guard = 0
      let prevFirstKey: string | null = null

      while (!complete && guard < 1000) {
        guard += 1

        const page = await kv.list({ prefix, cursor, limit: 256 })
        const pageKeys = Array.isArray(page?.keys) ? page.keys : []

        if (pageKeys.length === 0) {
          complete = true
          break
        }

        const firstKey = keyNameOf(pageKeys[0])
        // 重复页检测：当平台不返回 `cursor` 且末个 key 不能作为游标推进时，
        // 下一页会与上一页完全相同。若不拦截，循环会一路跑到 guard 上限，
        // 把同一个 key 重复上千次（既污染结果又浪费配额），因此这里立即终止。
        if (firstKey !== null && firstKey === prevFirstKey) {
          console.warn(
            "[KV] list(): repeated page detected; stopping pagination " +
              "to avoid returning duplicates",
          )
          break
        }
        prevFirstKey = firstKey

        for (const item of pageKeys) {
          const name = keyNameOf(item)
          if (name) seen.add(name)
        }

        // 优先使用平台返回的 cursor；老语义下回退为末个 key 名
        const nextCursor = page?.cursor
        cursor =
          typeof nextCursor === "string" && nextCursor
            ? nextCursor
            : keyNameOf(pageKeys[pageKeys.length - 1]) || ""

        complete = Boolean(page?.complete)
      }

      return [...seen]
    }
    
    // 模式2: HTTP 代理模式
    const baseUrl = requireProxyBaseUrl(env)
    const url = `${baseUrl}/kv-list?prefix=${encodeURIComponent(prefix)}`

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: buildProxyHeaders(env),
      })

      if (!response.ok) {
        throw new Error(`KV proxy list failed: ${response.status}`)
      }

      const data = await response.json() as { keys: string[] }
      return data.keys || []
    } catch (err) {
      console.error(`[KV] list(${prefix}) failed:`, err)
      throw err
    }
  },

  async health(env?: any): Promise<any> {
    const kv = getKvBinding(env)
    
    // 模式1: Binding 模式
    if (kv) {
      try {
        await kv.get("__health_check__")
        return {
          driver: "kv",
          mode: "binding",
          available: true,
          platform: "Cloudflare KV / EdgeOne KV",
        }
      } catch (err: any) {
        return {
          driver: "kv",
          mode: "binding",
          available: false,
          error: err?.message || String(err),
        }
      }
    }
    
    // 模式2: HTTP 代理模式。
    //
    // 判定比 isAvailable 更严格：健康状态必须真正可读写，401 表示鉴权
    // 失败（代理在但密钥不对），对依赖持久化的接口而言应报不可用，
    // 而不是被 /env_check 判定为 ready。共用 probeProxy 仅复用探测动作。
    const probe = await probeProxy(env)
    if (!probe.ok) {
      return {
        driver: "kv",
        mode: "proxy",
        available: false,
        error: probe.error || `HTTP ${probe.status}`,
      }
    }

    return {
      driver: "kv",
      mode: "proxy",
      available: true,
      platform: "EdgeOne KV (via Edge Function proxy)",
    }
  },
}
