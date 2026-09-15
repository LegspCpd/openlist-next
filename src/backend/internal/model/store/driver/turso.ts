/**
 * Turso / libSQL 驱动（HTTP）。
 *
 * Turso 是 SQLite 的分布式分支，提供 HTTP 查询端口（sqld 的 pipeline API），
 * 因此可以在 Cloudflare Workers 上直接用 fetch 访问，无需 TCP。
 *
 * 连接串形态：
 *   libsql://my-db-myorg.turso.io
 *   https://my-db-myorg.turso.io
 *
 * 凭据（二选一）：
 *   - 连接串 query 参数：?authToken=xxx
 *   - 环境变量：TURSO_AUTH_TOKEN
 *
 * 方言：SQLite（支持 INSERT OR REPLACE、`?` 占位符）。
 */
import type { Driver } from "../types"
import { createHttpSqlDriver, assertOk } from "./http-sql"
import { parseDsn, envValue, type ParsedDsn } from "../dsn"

interface TursoConfig extends ParsedDsn {
  token: string
  baseUrl: string
}

function resolve(env?: any): TursoConfig | null {
  const raw =
    envValue(env, "TURSO_DATABASE_URL", "TURSO_URL", "LIBSQL_URL") ||
    envValue(env, "DATABASE_URL", "OPENLIST_DATABASE_URL")

  if (!raw) return null
  const d = parseDsn(raw)
  if (!d) return null

  // 只接管 libsql / http(s) 形态；postgres:// 等交给各自驱动
  if (d.scheme !== "libsql" && d.scheme !== "https" && d.scheme !== "http") {
    return null
  }
  // 明确的排除项：这些 host 属于别的驱动
  if (/neon\.tech/i.test(d.host) || /supabase\.(co|in|net)/i.test(d.host)) {
    return null
  }

  const token =
    d.params?.["authToken"] ||
    d.params?.["auth_token"] ||
    envValue(env, "TURSO_AUTH_TOKEN", "LIBSQL_AUTH_TOKEN")
  if (!token) return null

  const scheme = d.scheme === "http" || d.host.startsWith("127.") || d.host.includes("localhost")
    ? "http"
    : "https"
  const baseUrl = `${scheme}://${d.host}${d.port ? ":" + d.port : ""}`

  return { ...d, token, baseUrl }
}

/** JS 值 → libSQL 参数（值一律字符串化，避免大整数精度丢失）。 */
function toArg(v: any): any {
  if (v === undefined || v === null) return { type: "null" }
  if (typeof v === "boolean") return { type: "integer", value: v ? "1" : "0" }
  if (typeof v === "number") {
    return Number.isInteger(v)
      ? { type: "integer", value: String(v) }
      : { type: "float", value: v }
  }
  if (v instanceof Date) return { type: "text", value: v.toISOString() }
  if (typeof v === "object") return { type: "text", value: JSON.stringify(v) }
  return { type: "text", value: String(v) }
}

/** libSQL 行 → 普通对象。 */
function rowsFromResult(result: any): any[] {
  const cols: any[] = result?.cols || []
  const rows: any[] = result?.rows || []
  const names = cols.map((c: any) => (typeof c === "string" ? c : c?.name))

  return rows.map((r: any) => {
    const out: any = {}
    const types: string[] = r?.type || []
    const values: any[] = r?.value || []
    for (let i = 0; i < names.length; i++) {
      const name = names[i]
      if (!name) continue
      const t = types[i]
      const v = values[i]
      // integer/float 在 libSQL 里以字符串传输，这里还原成数字
      out[name] = t === "integer" || t === "float" ? Number(v) : v
    }
    return out
  })
}

interface PipelineResponse {
  results: Array<{
    type: "ok" | "error"
    response?: { type: string; result?: any }
    error?: { message?: string; code?: string }
  }>
}

/**
 * 执行一个 pipeline。
 *
 * 一个 HTTP 请求可以承载多条语句，这是 Turso 相比其他 HTTP SQL 后端最大的
 * 优势：整库保存（数十条 UPSERT）只需一次往返。
 */
async function pipeline(
  cfg: TursoConfig,
  statements: Array<{ sql: string; args?: any[] }>,
): Promise<PipelineResponse> {
  const res = await fetch(`${cfg.baseUrl}/v2/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        ...statements.map((s) => ({
          type: "execute",
          stmt: { sql: s.sql, args: (s.args || []).map(toArg) },
        })),
        { type: "close" },
      ],
    }),
  })

  await assertOk(res, "Turso pipeline")
  return (await res.json()) as PipelineResponse
}

/** 从 pipeline 结果里取出第一条 error（若有）。 */
function firstError(p: PipelineResponse): string | null {
  for (const r of p?.results || []) {
    if (r?.type === "error") {
      return r?.error?.message || `Turso error (${r?.error?.code || "unknown"})`
    }
  }
  return null
}

export const tursoDriver: Driver = createHttpSqlDriver({
  name: "turso",
  dialect: "sqlite",
  platform: "Turso / libSQL",

  resolve,

  async query(cfg: TursoConfig, sql: string, params: any[]) {
    const p = await pipeline(cfg, [{ sql, args: params }])
    const err = firstError(p)
    if (err) throw new Error(err)

    const first = (p.results || []).find((r) => r?.response?.type === "execute")
    return rowsFromResult(first?.response?.result)
  },

  async execute(cfg: TursoConfig, sql: string, params: any[]) {
    const p = await pipeline(cfg, [{ sql, args: params }])
    const err = firstError(p)
    if (err) throw new Error(err)
  },

  /**
   * 批量：把整批语句包进 BEGIN … COMMIT，在**一个 HTTP 请求**里提交。
   *
   * 失败时补发 ROLLBACK（尽力而为），再抛错。相比逐条执行，这里既减少了
   * 数十次往返，也保证了「要么全成功、要么全回滚」。
   */
  async batch(
    cfg: TursoConfig,
    statements: Array<{ sql: string; params: any[] }>,
  ) {
    if (!statements.length) return

    const p = await pipeline(cfg, [
      { sql: "BEGIN" },
      ...statements.map((s) => ({ sql: s.sql, args: s.params })),
      { sql: "COMMIT" },
    ])

    const err = firstError(p)
    if (!err) return

    try {
      await pipeline(cfg, [{ sql: "ROLLBACK" }])
    } catch {
      /* 回滚失败也无所谓，事务会随会话结束自动释放 */
    }
    throw new Error(err)
  },

  redact(cfg: TursoConfig) {
    return { host: cfg.host, database: cfg.database }
  },
})
