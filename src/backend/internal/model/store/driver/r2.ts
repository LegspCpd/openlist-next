/**
 * Cloudflare R2 对象存储驱动（KV 语义）。
 *
 * 把 R2 当成一个大 KV 桶用：每个配置项是一个 object，值为字符串。
 * 适合不想用 KV/D1、或已有 R2 桶的场景（R2 免出流量费）。
 *
 * 绑定：在 wrangler 里绑定一个 R2 bucket，变量名取下列之一
 *   - BUCKET（默认）
 *   - R2_BUCKET
 *   - OPENLIST_BUCKET
 *
 * 可选：R2_PREFIX 给所有键加前缀（多应用共用桶时使用）。
 *
 * 仅支持 map / key 格式（对象存储无 SQL）。
 */
import type { Driver } from "../types"
import { envValue } from "../dsn"

const BINDING_NAMES = ["BUCKET", "R2_BUCKET", "OPENLIST_BUCKET", "OPENLIST_R2"]

/** R2 桶的鸭子类型判定（Workers 上没有可 import 的 R2Bucket 类型）。 */
function isR2Like(b: any): boolean {
  return !!b && typeof b === "object" && typeof b.get === "function" && typeof b.put === "function"
}

function getBucket(env?: any): any | null {
  const g = globalThis as any
  for (const name of BINDING_NAMES) {
    const fromEnv = env?.[name]
    if (isR2Like(fromEnv)) return fromEnv
    const fromGlobal = g?.[name]
    if (isR2Like(fromGlobal)) return fromGlobal
  }
  return null
}

export const r2Driver: Driver = {
  name: "r2",

  async isAvailable(env?: any): Promise<boolean> {
    return getBucket(env) != null
  },

  async init(): Promise<void> {},

  async get(key: string, env?: any): Promise<string | null> {
    const bucket = getBucket(env)
    if (!bucket) throw new Error("R2 binding not found")

    const prefix = envValue(env, "R2_PREFIX")
    const obj = await bucket.get(prefix + key)
    if (!obj) return null
    return await obj.text()
  },

  async put(key: string, value: string, env?: any): Promise<void> {
    const bucket = getBucket(env)
    if (!bucket) throw new Error("R2 binding not found")

    const prefix = envValue(env, "R2_PREFIX")
    await bucket.put(prefix + key, value)
  },

  async delete(key: string, env?: any): Promise<void> {
    const bucket = getBucket(env)
    if (!bucket) throw new Error("R2 binding not found")

    const prefix = envValue(env, "R2_PREFIX")
    await bucket.delete(prefix + key)
  },

  async list(prefix: string, env?: any): Promise<string[]> {
    const bucket = getBucket(env)
    if (!bucket) throw new Error("R2 binding not found")

    const globalPrefix = envValue(env, "R2_PREFIX")
    const fullPrefix = globalPrefix + prefix
    const out: string[] = []
    let cursor: string | undefined = undefined

    // R2 list 每次最多 1000 个 key，需按 cursor 翻页。
    // listed 显式标注为 any：R2Bucket 的类型（来自 workers-types）在无绑定时不参与检查，
    // 而此处 cursor 与 listed 互相引用，省略注解会让 TS 报循环推断 (TS7022)。
    do {
      const listed: any = await bucket.list({
        prefix: fullPrefix,
        ...(cursor ? { cursor } : {}),
      })
      for (const o of listed.objects || []) out.push(String(o.key))
      cursor = listed.truncated ? listed.cursor : undefined
    } while (cursor)

    return globalPrefix
      ? out.map((k) => (k.startsWith(globalPrefix) ? k.slice(globalPrefix.length) : k))
      : out
  },

  async health(env?: any): Promise<any> {
    const bucket = getBucket(env)
    if (!bucket) {
      return {
        configured: false,
        connected: false,
        platform: "Cloudflare R2",
        mode: "r2",
        error: `R2 binding not found (expected one of: ${BINDING_NAMES.join(", ")})`,
      }
    }

    try {
      await bucket.list({ limit: 1 })
      return {
        configured: true,
        connected: true,
        platform: "Cloudflare R2",
        mode: "r2",
        note: "Object storage: DB_FORMAT=sql is not supported; use map or key.",
      }
    } catch (err: any) {
      return {
        configured: true,
        connected: false,
        platform: "Cloudflare R2",
        mode: "r2",
        error: err?.message || String(err),
      }
    }
  },
}
