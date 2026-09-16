/**
 * JSON / KV / Blob 后端（默认后端）。
 *
 * 从原 db.ts 原样迁移：EdgeOne Blob SDK、Cloudflare/EdgeOne KV binding、
 * Cloudflare KV REST API、内存回退。行为与原实现完全一致。
 */
import type { StoreBackend } from "./types"
import { sanitizeProxyOrigin } from "./proxy"
import { probeWebKvBinding } from "./kv-binding"

// 保持既有引用路径不变（scripts/_regress.mjs 通过 jsonMod 访问）
export { sanitizeProxyOrigin } from "./proxy"
// 形态判定的唯一实现在 ./kv-binding（必须排除 Redis/RESP 客户端）；
// 这里按旧名字转出，保持既有引用路径可用。
export { isWebKvBinding as isWebKv } from "./kv-binding"

// ---- EdgeOne Blob SDK (HTTP API, avoids Redis RESP protocol crashes) ----
let _blobStore: any = null

/**
 * 探测次数上限。
 *
 * 只缓存「成功」结果，失败不缓存：
 * 冷启动早期 SDK 可能尚未就绪，若把失败也永久缓存，会导致整个实例
 * 生命周期内再也不会尝试，表现为「明明能用却一直报无持久化后端」。
 * 同时设上限避免每个请求都重复探测。
 */
let _blobProbeCount = 0

async function getBlobStore(): Promise<any | null> {
  if (_blobStore) return _blobStore // 成功过：直接复用
  if (_blobProbeCount >= 3) return null // 连续失败：不再重试
  _blobProbeCount++
  try {
    // @ts-ignore
    const { getStore } = await import("@edgeone/pages-blob")
    // In Makers Functions, projectId/token are auto-injected by the runtime.
    // TypeScript types require them, but the SDK works without them inside Functions.
    _blobStore = getStore({
      name: "openlist_db",
      consistency: "strong",
    } as any)
  } catch {
    return null // 不缓存失败，允许后续请求重试
  }
  return _blobStore
}

// ---- Safety net: catch uncaught exceptions from KV binding RESP parser ----
// Only registered in EdgeOne environments (invoked by getKvBinding detection),
// so Cloudflare Workers / local Node.js keep their default global error behavior.
let _respSafetyNetInstalled = false
function installRespSafetyNet() {
  if (_respSafetyNetInstalled) return
  _respSafetyNetInstalled = true
  if (typeof process === "undefined" || typeof process.on !== "function") return
  process.on("uncaughtException", (err: any) => {
    if (
      err?.message?.includes("RESP") ||
      err?.message?.includes("Unknown type") ||
      err?.stack?.includes("processResponses")
    ) {
      console.error(
        "[KV/RESP] Caught uncaught exception from storage binding, continuing:",
        err.message,
      )
      // Do NOT re-throw — let the function instance survive.
      // Subsequent requests will fall back to memoryDb.
    }
    // All other errors: let Node.js default handler process them.
  })
}

// JSON 后端的模块级环境上下文（与 db.ts 的 globalEnvCtx 并行维护，由
// db.ts 的 setEnvCtx 同步写入）。
let jsonEnvCtx: any = null

export function setJsonEnvCtx(env: any) {
  if (env) jsonEnvCtx = env
}

/**
 * Universal KV / Blob Storage Adapter for EdgeOne Makers & Cloudflare Workers
 *
 * 默认（auto）按以下顺序检测：
 *   1. @edgeone/pages-blob SDK (EdgeOne — HTTP API, no RESP crashes)
 *   2. KV namespace binding (Cloudflare Workers native)
 *   3. CF REST API (env vars)
 *   4. None (memory fallback)
 */
/*
 * 「可用的 Web KV binding」判定已移至 ./kv-binding 的 isWebKvBinding()
 * （在本文件顶部以旧名字 `isWebKv` 转出）。
 *
 * 之所以必须下沉并强化：EdgeOne Node 云函数注入的 `KV` 是一个
 * Redis/RESP 客户端，它同样暴露 get/set，仅按「有没有 get/set」判断
 * 会把它当成合法 KV binding —— 于是驱动解析成功、读写却全部失败
 * （`Not connected`），整站被存储拦截成 503。
 * 现在的判定会先排除 RESP 客户端，再要求 KV Web API 的写接口。
 */

/**
 * 创建基于 HTTP 代理的 KV 适配器。
 *
 * 用于 EdgeOne Node 云函数：拿不到 KV binding，必须经 Edge Function
 * （functions/kv-*）代为访问。对外暴露与原生 binding 相同的接口，
 * 使调用方（middlewares/auth/admin）无需感知差异。
 *
 * 实现**直接委托给 kvDriver**（该代理协议的唯一实现），避免同一协议
 * 在本文件中重复一份、与 driver/kv.ts 的行为产生漂移。
 * 这里只负责把 Driver 的 `string[]` 契约适配成 binding 的 `{name,key}[]`。
 *
 * kvDriver 用动态 import 引入：driver/kv.ts 需要本模块的
 * sanitizeProxyOrigin，静态互相导入会形成循环依赖。
 */
function createProxyBinding(_origin: string, env: any): any {
  const load = async () => (await import("./driver/kv")).kvDriver

  return {
    async get(key: string): Promise<string | null> {
      return (await load()).get(key, env)
    },

    async put(key: string, value: string): Promise<void> {
      return (await load()).put(key, value, env)
    },

    async delete(key: string): Promise<void> {
      return (await load()).delete(key, env)
    },

    async list(opts: { prefix?: string } = {}): Promise<{ keys: any[] }> {
      const keys = await (await load()).list(opts?.prefix || "", env)
      // 兼容 binding 形态：调用方读取 k.name / k.key 两种写法
      return { keys: keys.map((name) => ({ name, key: name })) }
    },
  }
}

export async function getKvBinding(envCtx?: any): Promise<{
  binding: any
  platform: string
  mode: "binding" | "blob" | "api" | "proxy" | "none"
}> {
  if (envCtx) {
    jsonEnvCtx = envCtx
  }
  const env =
    envCtx || jsonEnvCtx || (typeof process !== "undefined" ? process.env : {})
  const g = typeof globalThis !== "undefined" ? (globalThis as any) : {}

  /**
   * 原生 KV binding 探测。
   *
   * 三点必须注意：
   *  1. env 与 globalThis 需独立检查 —— env 为真值时不会回退到 globalThis，
   *     而 EdgeOne Edge Functions 把绑定名注入为全局标识符。
   *  2. 必须做接口形态校验：EdgeOne Node 云函数也会注入名为 `KV` 的对象，
   *     但那是 Redis/RESP 客户端（TCP socket），不是 KV Web API。
   *     它同样有 get/set，所以判定里必须**显式排除 RESP 客户端**
   *     （见 ./kv-binding）。否则它会以 binding 身份被选中，
   *     之后每次读写都抛 `Not connected`。
   *  3. 绑定名统一为 `KV`（KV namespace binding 的通用约定名）。
   */
  const nativeKv = probeWebKvBinding([env?.KV, g?.KV])

  // 0. EdgeOne Node 云函数：显式 DB_DRIVER=kv 且无原生 binding → 走 HTTP 代理。
  //    放在 Blob 之前，确保用户显式选择的 KV 优先于自动探测出的 Blob。
  const kvPreferred =
    String(env?.DB_DRIVER || "").trim().toLowerCase() === "kv"
  if (kvPreferred && !nativeKv) {
    let origin: any
    try {
      origin = env?.EO_KV_URLS || env?.__requestOrigin
    } catch {
      origin = undefined
    }
    const safeOrigin = sanitizeProxyOrigin(origin, env)
    if (safeOrigin) {
      console.log("[DB] getKvBinding: using EdgeOne KV via Edge Function proxy")
      return {
        binding: createProxyBinding(safeOrigin, env),
        platform: "EdgeOne KV (via Edge Function proxy)",
        mode: "proxy",
      }
    }
    console.warn(
      "[DB] getKvBinding: KV proxy requested but no origin available " +
        "(set EO_KV_URLS or ensure request origin is injected)",
    )
  }

  // 1. EdgeOne Blob SDK (HTTP API — avoids RESP protocol crashes)
  try {
    const blobStore = await getBlobStore()
    if (blobStore) {
      // Blob SDK only initializes inside the EdgeOne Makers runtime
      installRespSafetyNet()
      console.log("[DB] getKvBinding: using EdgeOne Blob storage")
      return {
        binding: blobStore,
        platform: "EdgeOne Blob (@edgeone/pages-blob, strong consistency)",
        mode: "blob",
      }
    }
  } catch (err: any) {
    console.error(
      `[DB] getKvBinding: EdgeOne Blob init failed: ${err?.message || err}`,
      `stack=${err?.stack?.substring(0, 300) || ""}`,
    )
  }

  // 2. KV namespace binding（统一名为 KV）
  if (nativeKv) {
    const isEdgeOne =
      Boolean(env && (env.EDGEONE || env.EO_REGION)) ||
      Boolean(g.EDGEONE || typeof g.EdgeOne !== "undefined")
    if (isEdgeOne) installRespSafetyNet()
    const platformName = isEdgeOne
      ? "EdgeOne KV (KV)"
      : "Cloudflare / EdgeOne KV (KV)"
    console.log(`[DB] getKvBinding: found KV binding: ${platformName}`)
    return { binding: nativeKv, platform: platformName, mode: "binding" }
  }

  // 3. Cloudflare REST API 模式（显式 DB_DRIVER=cfkv 或凭据齐全时自动启用）
  {
    const cfAccountId =
      env.CF_ACCOUNT ||
      (typeof process !== "undefined" ? process.env.CF_ACCOUNT : "")
    const cfNamespaceId =
      env.CF_KV_UUID ||
      (typeof process !== "undefined" ? process.env.CF_KV_UUID : "")
    const cfApiToken =
      env.CF_API_KEY ||
      (typeof process !== "undefined" ? process.env.CF_API_KEY : "")

    if (cfAccountId && cfNamespaceId && cfApiToken) {
      console.log("[DB] getKvBinding: using Cloudflare KV REST API")
      return {
        binding: {
          type: "cf_rest",
          accountId: cfAccountId,
          namespaceId: cfNamespaceId,
          token: cfApiToken,
        },
        platform: "Cloudflare KV (REST API)",
        mode: "api",
      }
    }
  }

  console.warn(
    "[DB] getKvBinding: no KV storage found, using memory-only mode (data will not persist)",
  )
  return { binding: null, platform: "Memory", mode: "none" }
}

async function readFromKv(
  kvInfo: Awaited<ReturnType<typeof getKvBinding>>,
  key = "openlist_config",
): Promise<any | null> {
  const { binding, mode } = kvInfo
  if (mode === "none" || !binding) return null

  try {
    if (mode === "blob") {
      // @edgeone/pages-blob SDK: get(key, { type: "json" }) returns parsed object
      const val = await binding.get(key, { type: "json" })
      if (val) return val
      // Fallback: get as text and parse
      const text = await binding.get(key)
      if (text) {
        return typeof text === "string" ? JSON.parse(text) : text
      }
    } else if (mode === "binding" || mode === "proxy") {
      let val: any = null
      try {
        // Cloudflare KV 支持 (key, "text")，EdgeOne KV 支持 (key)
        val = await binding.get(key, "text")
      } catch {
        val = await binding.get(key)
      }
      if (val === undefined || val === null) {
        val = await binding.get(key)
      }
      if (val) {
        return typeof val === "string" ? JSON.parse(val) : val
      }
    } else if (binding.type === "cf_rest") {
      const url = `https://api.cloudflare.com/client/v4/accounts/${binding.accountId}/storage/kv/namespaces/${binding.namespaceId}/values/${key}`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${binding.token}` },
      })
      if (res.ok) {
        const text = await res.text()
        return JSON.parse(text)
      }
    }
  } catch (err) {
    console.error("[KV/Blob Store] Error reading key:", key, err)
  }
  return null
}

async function saveToKv(
  kvInfo: Awaited<ReturnType<typeof getKvBinding>>,
  key: string,
  data: any,
): Promise<boolean> {
  const { binding, mode } = kvInfo
  if (mode === "none" || !binding) {
    console.warn(`[KV/Blob Store] saveToKv: mode="${mode}", binding=${!!binding}, skipping write`)
    return false
  }

  const valStr = JSON.stringify(data)
  console.log(`[KV/Blob Store] saveToKv: key="${key}", mode="${mode}", size=${valStr.length} bytes`)

  try {
    if (mode === "blob") {
      // @edgeone/pages-blob SDK: setJSON(key, value) for structured data
      if (typeof binding.setJSON === "function") {
        const result = (await binding.setJSON(key, data)) !== false
        console.log(`[KV/Blob Store] blob.setJSON result=${result}`)
        return result
      }
      // Fallback: set(key, stringified)
      if (typeof binding.set === "function") {
        const result = (await binding.set(key, valStr)) !== false
        console.log(`[KV/Blob Store] blob.set result=${result}`)
        return result
      }
    } else if (mode === "binding" || mode === "proxy") {
      // NOTE: only an explicit `false` counts as failure. Cloudflare KV's
      // put() resolves to void, so `undefined` must stay a success —
      // otherwise every normal write would be reported as failed.
      // proxy 模式复用同一分支：适配器已实现 put/get/delete/list。
      if (typeof binding.put === "function") {
        const putResult = await binding.put(key, valStr)
        const result = putResult !== false
        console.log(`[KV/Blob Store] binding.put result=${putResult}, success=${result}`)
        return result
      }
      if (typeof binding.set === "function") {
        const result = (await binding.set(key, valStr)) !== false
        console.log(`[KV/Blob Store] binding.set result=${result}`)
        return result
      }
    } else if (binding.type === "cf_rest") {
      const url = `https://api.cloudflare.com/client/v4/accounts/${binding.accountId}/storage/kv/namespaces/${binding.namespaceId}/values/${key}`
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${binding.token}`,
          "Content-Type": "text/plain",
        },
        body: valStr,
      })
      console.log(`[KV/Blob Store] cf_rest PUT status=${res.status}`)
      return res.ok
    }
  } catch (err: any) {
    console.error(
      `[KV/Blob Store] Error writing key="${key}", mode="${mode}", dataSize=${valStr.length}:`,
      err?.message || err,
      `stack=${err?.stack?.substring(0, 300) || ""}`,
    )
  }
  console.warn(`[KV/Blob Store] saveToKv: no valid method found for mode="${mode}"`)
  return false
}

export async function getKvStatus(envCtx?: any) {
  const kvInfo = await getKvBinding(envCtx)
  const isConfigured = kvInfo.mode !== "none"
  let connected = false
  let error: string | null = null

  if (isConfigured) {
    try {
      const testVal = await readFromKv(kvInfo, "openlist_config")
      connected = true
      return {
        configured: true,
        connected: true,
        platform: kvInfo.platform,
        mode: kvInfo.mode,
        hasData: !!testVal,
        error: null,
      }
    } catch (err: any) {
      error = err.message || String(err)
    }
  }

  return {
    configured: isConfigured,
    connected,
    platform: kvInfo.platform,
    mode: kvInfo.mode,
    hasData: false,
    error,
  }
}

// ───────────────────────── 持久化密钥管理 ─────────────────────────
//
// 密钥（JWT 签名密钥、字段加密密钥）需要跨实例、跨冷启动保持一致，
// 因此必须持久化。设计原则：
//
//   1. 生成只发生在初始化（setup）阶段，且仅当键不存在时。
//   2. 一旦写入，永不覆盖 —— 覆盖会导致已加密数据无法解密。
//   3. 非初始化阶段只读；读不到就是故障，绝不重新生成。
//   4. 判定依据是「键是否存在」，而不是「读取是否成功」。
//
// 键名与数据库中的实体隔离，避免被通用 list(prefix) 误扫。

/** 从持久化后端读取密钥，不存在或失败返回 null */
export async function readPersistedSecret(
  env: any,
  key: string,
): Promise<string | null> {
  try {
    const kvInfo = await getKvBinding(env)
    if (kvInfo.mode === "none" || !kvInfo.binding) return null
    const { binding, mode } = kvInfo

    let val: any = null
    if (mode === "blob") {
      val = await binding.get(key)
    } else {
      try {
        val = await binding.get(key, "text")
      } catch {
        val = await binding.get(key)
      }
    }
    if (val && typeof val.text === "function") val = await val.text()
    if (val === null || val === undefined) return null
    const str = String(val).trim()
    return str || null
  } catch (e) {
    console.warn(`[Secret] read "${key}" failed:`, e)
    return null
  }
}

/**
 * 写入密钥。
 *
 * 调用方需自行保证「仅在不存在时调用」，本函数不检查现有值
 * （见上方设计原则第 2 条）。
 */
export async function writePersistedSecret(
  env: any,
  key: string,
  secret: string,
): Promise<boolean> {
  try {
    const kvInfo = await getKvBinding(env)
    if (kvInfo.mode === "none" || !kvInfo.binding) {
      console.warn(
        `[Secret] cannot persist "${key}": no storage backend available`,
      )
      return false
    }
    const { binding, mode } = kvInfo

    if (mode === "blob") {
      if (typeof binding.set === "function") await binding.set(key, secret)
      else if (typeof binding.put === "function") await binding.put(key, secret)
      else return false
    } else {
      if (typeof binding.put === "function") await binding.put(key, secret)
      else if (typeof binding.set === "function") await binding.set(key, secret)
      else return false
    }
    return true
  } catch (e) {
    console.warn(`[Secret] write "${key}" failed:`, e)
    return false
  }
}

/**
 * 生成一个 64 位十六进制随机密钥，与 middlewares.ts 中的生成方式一致。
 */
export function generateSecret(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}
