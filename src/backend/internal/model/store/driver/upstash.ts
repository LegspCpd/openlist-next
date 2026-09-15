/**
 * Upstash Redis 驱动（REST）。
 *
 * Upstash 把 Redis 暴露成 HTTPS 接口，因此在 Cloudflare Workers 上可直接使用
 * —— 这是边缘环境下拿到「低延迟 KV」最简单的方式之一。
 *
 * 仅支持 KV 语义（map / key 格式），Redis 不支持 SQL。
 *
 * 环境变量（按优先级，Vercel / Netlify 集成会自动注入）：
 *   - KV_REST_API_URL + KV_REST_API_TOKEN
 *         （Vercel KV / Vercel Marketplace 的 Upstash 集成）
 *   - UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *         （Upstash 原生变量）
 *
 * 也接受 `redis://` 形态的 DATABASE_URL/REDIS_URL/KV_URL（会转成 https 端点）。
 */
import type { Driver } from "../types"
import { envValue, parseDsn } from "../dsn"

interface UpstashConfig {
  url: string
  token: string
  /** 所有键的统一前缀，避免与同实例上的其他应用冲突 */
  prefix: string
}

function resolve(env?: any): UpstashConfig | null {
  // Vercel KV / Vercel Marketplace 的 Upstash 集成注入 KV_REST_API_URL/TOKEN，
  // 原生 Upstash 注入 UPSTASH_REDIS_REST_URL/TOKEN —— 两套都要认。
  let url = envValue(
    env,
    "KV_REST_API_URL",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_URL",
    "REDIS_HTTP_URL",
  )
  let token = envValue(
    env,
    "KV_REST_API_TOKEN",
    "UPSTASH_REDIS_REST_TOKEN",
    "UPSTASH_TOKEN",
    "REDIS_HTTP_TOKEN",
  )

  if (!url) {
    const raw = envValue(env, "DATABASE_URL", "REDIS_URL", "KV_URL")
    if (!raw) return null
    const d = parseDsn(raw)
    if (!d || (d.scheme !== "redis" && d.scheme !== "https" && d.scheme !== "http")) {
      return null
    }
    if (!/upstash\.io/i.test(d.host) && d.scheme === "redis") return null

    url = d.scheme === "redis" ? `https://${d.host}` : `${d.scheme}://${d.host}`
    token = token || d.password || ""
  }

  if (!url || !token) return null

  return {
    url: url.replace(/\/+$/, ""),
    token,
    prefix: envValue(env, "UPSTASH_PREFIX", "REDIS_PREFIX") || "",
  }
}

/** 执行单条命令，返回 result 字段。 */
async function command(cfg: UpstashConfig, args: any[]): Promise<any> {
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Upstash command failed: HTTP ${res.status} - ${body.slice(0, 300)}`)
  }

  const json: any = await res.json()
  if (json?.error) throw new Error(`Upstash error: ${json.error}`)
  return json?.result
}

/** 批量执行（一次往返跑多条命令）。 */
async function pipeline(cfg: UpstashConfig, commands: any[][]): Promise<any[]> {
  if (commands.length === 0) return []

  const res = await fetch(`${cfg.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Upstash pipeline failed: HTTP ${res.status} - ${body.slice(0, 300)}`)
  }

  const json: any[] = await res.json()
  return json.map((r: any) => {
    if (r?.error) throw new Error(`Upstash error: ${r.error}`)
    return r?.result
  })
}

/**
 * SCAN 游标遍历。
 *
 * 为什么不用 KEYS：KEYS 会阻塞 Redis，在生产实例上是事故级操作。
 * SCAN 分批返回，代价是需要循环到游标归零。这里设了轮数上限，
 * 防止极端数据规模下无限循环拖垮请求。
 */
async function scanKeys(cfg: UpstashConfig, prefix: string): Promise<string[]> {
  const out: string[] = []
  let cursor = "0"
  const match = `${cfg.prefix}${prefix}*`

  for (let i = 0; i < 1000; i++) {
    const [next, keys] = (await command(cfg, [
      "SCAN",
      cursor,
      "MATCH",
      match,
      "COUNT",
      "1000",
    ])) as [string, string[]]

    for (const k of keys || []) out.push(String(k))
    cursor = String(next)
    if (cursor === "0") break
  }

  // 去掉前缀，还原成调用方看到的逻辑键名
  return cfg.prefix
    ? out.map((k) => (k.startsWith(cfg.prefix) ? k.slice(cfg.prefix.length) : k))
    : out
}

export const upstashDriver: Driver = {
  name: "upstash",

  async isAvailable(env?: any): Promise<boolean> {
    return resolve(env) != null
  },

  async init(): Promise<void> {},

  async get(key: string, env?: any): Promise<string | null> {
    const cfg = resolve(env)
    if (!cfg) throw new Error("upstash is not configured")
    const v = await command(cfg, ["GET", cfg.prefix + key])
    return v == null ? null : String(v)
  },

  async put(key: string, value: string, env?: any): Promise<void> {
    const cfg = resolve(env)
    if (!cfg) throw new Error("upstash is not configured")
    await command(cfg, ["SET", cfg.prefix + key, value])
  },

  async delete(key: string, env?: any): Promise<void> {
    const cfg = resolve(env)
    if (!cfg) throw new Error("upstash is not configured")
    await command(cfg, ["DEL", cfg.prefix + key])
  },

  async list(prefix: string, env?: any): Promise<string[]> {
    const cfg = resolve(env)
    if (!cfg) throw new Error("upstash is not configured")
    return await scanKeys(cfg, prefix)
  },

  async health(env?: any): Promise<any> {
    const cfg = resolve(env)
    if (!cfg) {
      return {
        configured: false,
        connected: false,
        platform: "Upstash Redis",
        mode: "upstash",
        error:
          "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or DATABASE_URL=redis://…) are required",
      }
    }

    try {
      await command(cfg, ["PING"])
      return {
        configured: true,
        connected: true,
        platform: "Upstash Redis",
        mode: "upstash",
        note: "KV semantics only: DB_FORMAT=sql is not supported; use map or key.",
      }
    } catch (err: any) {
      return {
        configured: true,
        connected: false,
        platform: "Upstash Redis",
        mode: "upstash",
        error: err?.message || String(err),
      }
    }
  },
}

/** 导出 pipeline 供未来做批量优化（当前先保持逐条语义）。 */
export const _upstashPipeline = pipeline
