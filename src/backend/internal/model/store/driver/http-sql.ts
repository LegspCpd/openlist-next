/**
 * 基于 HTTP 的 SQL 驱动工厂。
 *
 * 背景：Cloudflare Workers / EdgeOne / ESA 等边缘运行时**没有裸 TCP**，
 * 传统的 `mysql2` / `pg` 无法使用。要在边缘直连外部数据库，唯一可行路径是
 * 数据库厂商或自建网关提供的 **HTTP 查询接口**。
 *
 * 这些后端的差异只在「怎么把一条 SQL 送出去、怎么把结果收回来」，
 * 而围绕 SQL 的其余逻辑完全一致：
 *   - 建表（DDL，按方言生成）
 *   - KV 表读写（供 map/key 格式）
 *   - query / execute / batch
 *   - `?` 占位符 → 方言占位符转换
 *   - init 幂等、health 报告
 *
 * 因此把这些共性抽成工厂，各厂商驱动只需提供 `resolve/query/execute`
 * 三个钩子（约 80 行），避免每个驱动复制 200 行样板。
 */
import type { Driver } from "../types"
import { buildDdl, kvSchema } from "../schema"
import { toDialectPlaceholders, dialectOps, type Dialect } from "../dialect"

/** 厂商适配钩子。 */
export interface HttpSqlAdapter {
  /** 驱动名（也是 DB_DRIVER 的取值）。 */
  name: string
  /** SQL 方言，决定 DDL、引号与 UPSERT 语法。 */
  dialect: Dialect
  /** health 展示用的平台名。 */
  platform: string
  /**
   * 探测配置。返回 null 表示「未配置」，驱动随即不可用。
   * 必须是**零网络**的：只读取 env 中的连接串/绑定，不要发请求，
   * 否则每次 auto 探测都会产生一次外部网络往返。
   */
  resolve(env?: any): any | null
  /** 执行查询并返回行数组（非查询语句返回空数组即可）。 */
  query(cfg: any, sql: string, params: any[], env?: any): Promise<any[]>
  /** 执行写语句。 */
  execute(cfg: any, sql: string, params: any[], env?: any): Promise<void>
  /**
   * 可选的批量执行（默认逐条 execute）。
   * 支持事务或多语句请求的后端应实现它，能显著降低往返次数。
   */
  batch?(
    cfg: any,
    statements: Array<{ sql: string; params: any[] }>,
    env?: any,
  ): Promise<void>
  /** 连接串中不应泄漏到日志/健康检查里的字段（用于脱敏）。 */
  redact?(cfg: any): any
}

/** 配置 → 已建表标记（幂等，按配置指纹缓存）。 */
const schemaReady = new Map<string, Promise<void>>()

function configKey(cfg: any): string {
  try {
    return JSON.stringify(cfg)
  } catch {
    return String(Math.random())
  }
}

export function createHttpSqlDriver(adapter: HttpSqlAdapter): Driver {
  const dops = dialectOps(adapter.dialect)
  const q = (s: string) => dops.quote(s)

  /** KV 表的四件套（map/key 格式用）。 */
  const KV = {
    table: q("kv"),
    key: q("key"),
    value: q("value"),
  }

  /**
   * 建表（幂等）。
   *
   * 并发保护：缓存的是 Promise 而非布尔值，避免同一冷启动内多个请求
   * 同时触发建表（在无事务保证的 HTTP 后端上会造成重复 DDL）。
   */
  function ensureSchema(cfg: any, env?: any): Promise<void> {
    const key = configKey(cfg)
    const existing = schemaReady.get(key)
    if (existing) return existing

    const p = (async () => {
      for (const ddl of [...kvSchema(adapter.dialect), ...buildDdl(adapter.dialect, env)]) {
        await adapter.execute(cfg, ddl, [], env)
      }
    })().catch((err) => {
      // 失败必须清缓存，否则本次进程内永远不会重试建表
      schemaReady.delete(key)
      throw err
    })

    schemaReady.set(key, p)
    return p
  }

  /** 统一转换为目标方言的 SQL（Postgres 需要 $1/$2）。 */
  function prep(sql: string): string {
    return toDialectPlaceholders(sql, adapter.dialect)
  }

  const driver: Driver = {
    name: adapter.name,
    dialect: adapter.dialect,

    async isAvailable(env?: any): Promise<boolean> {
      return adapter.resolve(env) != null
    },

    async init(env?: any): Promise<void> {
      const cfg = adapter.resolve(env)
      if (cfg) await ensureSchema(cfg, env)
    },

    async get(key: string, env?: any): Promise<string | null> {
      const cfg = adapter.resolve(env)
      if (!cfg) throw new Error(`${adapter.name} is not configured`)
      await ensureSchema(cfg, env)
      const rows = await adapter.query(
        cfg,
        prep(`SELECT ${KV.value} FROM ${KV.table} WHERE ${KV.key} = ?`),
        [key],
        env,
      )
      const v = rows?.[0]?.value
      return v == null ? null : String(v)
    },

    async put(key: string, value: string, env?: any): Promise<void> {
      const cfg = adapter.resolve(env)
      if (!cfg) throw new Error(`${adapter.name} is not configured`)
      await ensureSchema(cfg, env)
      const upsert = dops.upsert(KV.table, ["key", "value"], "key")
      await adapter.execute(cfg, prep(upsert), [key, value], env)
    },

    async delete(key: string, env?: any): Promise<void> {
      const cfg = adapter.resolve(env)
      if (!cfg) throw new Error(`${adapter.name} is not configured`)
      await ensureSchema(cfg, env)
      await adapter.execute(
        cfg,
        prep(`DELETE FROM ${KV.table} WHERE ${KV.key} = ?`),
        [key],
        env,
      )
    },

    async list(prefix: string, env?: any): Promise<string[]> {
      const cfg = adapter.resolve(env)
      if (!cfg) throw new Error(`${adapter.name} is not configured`)
      await ensureSchema(cfg, env)
      const rows = await adapter.query(
        cfg,
        prep(
          `SELECT ${KV.key} FROM ${KV.table} WHERE ${KV.key} LIKE ? ORDER BY ${KV.key}`,
        ),
        [`${prefix}%`],
        env,
      )
      return (rows || [])
        .map((r: any) => r?.[KV.key.replace(/[`"']/g, "")] ?? r?.key)
        .filter((v: any) => v != null)
        .map((v: any) => String(v))
    },

    async query(sql: string, params: any[], env?: any): Promise<any[]> {
      const cfg = adapter.resolve(env)
      if (!cfg) throw new Error(`${adapter.name} is not configured`)
      await ensureSchema(cfg, env)
      return await adapter.query(cfg, prep(sql), params, env)
    },

    async execute(sql: string, params: any[], env?: any): Promise<void> {
      const cfg = adapter.resolve(env)
      if (!cfg) throw new Error(`${adapter.name} is not configured`)
      await ensureSchema(cfg, env)
      await adapter.execute(cfg, prep(sql), params, env)
    },

    async batch(
      statements: Array<{ sql: string; params: any[] }>,
      env?: any,
    ): Promise<void> {
      const cfg = adapter.resolve(env)
      if (!cfg) throw new Error(`${adapter.name} is not configured`)
      await ensureSchema(cfg, env)

      const prepared = statements.map((s) => ({
        sql: prep(s.sql),
        params: s.params,
      }))

      if (adapter.batch) {
        await adapter.batch(cfg, prepared, env)
        return
      }
      for (const s of prepared) {
        await adapter.execute(cfg, s.sql, s.params, env)
      }
    },

    async health(env?: any): Promise<any> {
      const cfg = adapter.resolve(env)
      if (!cfg) {
        return {
          configured: false,
          connected: false,
          platform: adapter.platform,
          mode: adapter.name,
          error: `${adapter.name} connection string not found`,
        }
      }

      try {
        await adapter.query(cfg, "SELECT 1", [], env)
        return {
          configured: true,
          connected: true,
          platform: adapter.platform,
          mode: adapter.name,
        }
      } catch (err: any) {
        return {
          configured: true,
          connected: false,
          platform: adapter.platform,
          mode: adapter.name,
          error: err?.message || String(err),
        }
      }
    },
  }

  return driver
}

/**
 * 把 JS 值转成 HTTP SQL 接口友好的形态。
 *
 * 多数 HTTP 网关用 JSON 传参，无法表达 JS 的 undefined/Date/BigInt，
 * 这里统一降级为 null / ISO 字符串 / 数字，避免序列化出 `{}`。
 */
export function normalizeParam(v: any): any {
  if (v === undefined || v === null) return null
  if (v instanceof Date) return v.toISOString()
  if (typeof v === "bigint") return Number(v)
  if (typeof v === "object") return JSON.stringify(v)
  return v
}

/** 统一 fetch 错误处理：把非 2xx 变成带响应体的 Error，便于排障。 */
export async function assertOk(res: Response, ctx: string): Promise<void> {
  if (res.ok) return
  let body = ""
  try {
    body = (await res.text()).slice(0, 500)
  } catch {
    /* 忽略读取失败，保留空 body */
  }
  throw new Error(
    `${ctx} failed: HTTP ${res.status} ${res.statusText}${body ? ` - ${body}` : ""}`,
  )
}
