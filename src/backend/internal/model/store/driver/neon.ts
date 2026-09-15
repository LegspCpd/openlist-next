/**
 * Neon Serverless Postgres 驱动（HTTP）。
 *
 * 为什么能跑在 Cloudflare Workers 上：Neon 提供基于 fetch 的 HTTP 查询接口
 * （`/sql`），不需要 TCP，因此绕开了 Workers 无裸 TCP 的限制。这也是在
 * Workers 上使用 Postgres 的推荐方式（另一种是 Hyperdrive binding）。
 *
 * 连接串形态：
 *   postgres://user:pass@ep-xxx.<region>.aws.neon.tech/neondb?sslmode=require
 *
 * 环境变量（任一即可）：
 *   - NEON_DATABASE_URL / NEON_URL / NEON_POSTGRES_URL   （专属，优先）
 *   - DATABASE_URL / POSTGRES_URL                        （host 命中 neon.tech 时）
 */
import type { Driver } from "../types"
import { createHttpSqlDriver, assertOk, normalizeParam } from "./http-sql"
import { parseDsn, envValue, type ParsedDsn } from "../dsn"

/**
 * 探测 Neon 配置。
 *
 * 只接受两类来源：专属变量，或 host 明确属于 neon.tech 的通用变量。
 * 通用 postgres:// 指向其他厂商（如 Supabase 直连、自建库）时不接管，
 * 交给 pgrest / pghttp 驱动处理，避免抢跑导致连错地方。
 */
function resolve(env?: any): ParsedDsn | null {
  const own = envValue(
    env,
    "NEON_DATABASE_URL",
    "NEON_URL",
    "NEON_POSTGRES_URL",
    "NEON_CONNECTION_STRING",
  )
  if (own) {
    const d = parseDsn(own)
    if (d) return d
  }

  const generic = envValue(
    env,
    "DATABASE_URL",
    "OPENLIST_DATABASE_URL",
    "POSTGRES_URL",
    "POSTGRESQL_URL",
  )
  if (generic) {
    const d = parseDsn(generic)
    if (d && /neon\.tech$/i.test(d.host)) return d
  }

  return null
}

/** Neon 的 HTTP SQL 端点：把连接串 host 直接换成 https 即可。 */
function endpoint(cfg: ParsedDsn): string {
  const explicit = cfg.params?.["endpoint"]
  if (explicit) return String(explicit).replace(/\/+$/, "") + "/sql"
  const scheme = cfg.host.includes("localhost") || cfg.host.startsWith("127.") ? "http" : "https"
  return `${scheme}://${cfg.host}${cfg.port ? ":" + cfg.port : ""}/sql`
}

/**
 * 认证头。
 *
 * 优先用连接串整体（`Neon-Connection-String`），因为 Neon 的 JWT/密码解析
 * 依赖完整串（含 user/db/options）；仅在只拿到 API key 时退回 Bearer。
 */
function authHeaders(cfg: ParsedDsn): Record<string, string> {
  const apiKey = cfg.params?.["api_key"] || cfg.params?.["neon_api_key"]
  if (apiKey) return { Authorization: `Bearer ${apiKey}` }
  return { "Neon-Connection-String": cfg.raw }
}

/** Neon arrayMode 返回 [[v1,v2]]，对象模式返回 [{k:v}]，两种都要兼容。 */
function rowsFromNeon(json: any): any[] {
  const fields: string[] = (json?.fields || []).map((f: any) =>
    typeof f === "string" ? f : f?.name,
  )
  const rows: any[] = json?.rows || []
  if (!rows.length) return []

  // 对象模式：直接返回
  if (!Array.isArray(rows[0])) return rows

  // 数组模式：按 fields 位置映射成对象
  if (!fields.length) return []
  return rows.map((r: any[]) => {
    const o: any = {}
    for (let i = 0; i < fields.length; i++) o[fields[i]] = r?.[i]
    return o
  })
}

async function runSql(
  cfg: ParsedDsn,
  sql: string,
  params: any[],
): Promise<any> {
  const res = await fetch(endpoint(cfg), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(cfg),
      // 关掉文本包装，让 JSON/数组类型原样返回，避免数字被转成字符串
      "Neon-Raw-Text-Output": "true",
      "Neon-Array-Mode": "true",
    },
    body: JSON.stringify({
      query: sql,
      params: (params || []).map(normalizeParam),
    }),
  })

  await assertOk(res, "Neon SQL")
  return await res.json()
}

export const neonDriver: Driver = createHttpSqlDriver({
  name: "neon",
  dialect: "postgres",
  platform: "Neon Serverless Postgres",

  resolve,

  async query(cfg: ParsedDsn, sql: string, params: any[], env?: any) {
    const json = await runSql(cfg, sql, params)
    return rowsFromNeon(json)
  },

  async execute(cfg: ParsedDsn, sql: string, params: any[], env?: any) {
    await runSql(cfg, sql, params)
  },

  /**
   * 不覆盖 batch：走工厂默认的逐条执行。
   *
   * Neon 的 HTTP 接口是无状态的（每次请求独立连接），无法像 TCP 连接那样
   * 用 BEGIN/COMMIT 包裹事务；而服务端对多语句批量的支持形态会随版本变化，
   * 一旦我们猜错请求格式，它可能返回 200 却什么都没执行 —— 那是「保存成功
   * 但数据没落库」的静默事故。逐条执行慢一些，但语义确定。
   *
   * 若后续要优化，建议改用整库单键的 `DB_FORMAT=map`（一次 put 搞定），
   * 而不是在这里赌批量协议。
   */

  redact(cfg: ParsedDsn) {
    return { host: cfg.host, database: cfg.database, user: cfg.user }
  },
})
