/**
 * 外部数据库连接串解析与驱动推断。
 *
 * 目标：让人只填一个 `DATABASE_URL` 就能接上外部数据库，不必再记一堆
 * 平台专属变量名。
 *
 *   postgres://user:pass@ep-xxx.neon.tech/neondb   → neon（HTTP，Workers 可用）
 *   postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres → pgrest
 *   libsql://my-db.turso.io                        → turso
 *   mysql://user:pass@host:3306/openlist           → mysqlhttp（边缘）/ mysql（Node）
 *   https://my-gateway.example.com/sql            → pghttp（自建网关）
 *
 * 同时也兼容各家的专属变量名（NEON_DATABASE_URL、TURSO_URL、SUPABASE_URL、
 * SUPABASE_POOLER_URL、KV_REST_API_URL、NILEDB_URL、PRISMA_DATABASE_URL…）
 * 以及 Vercel / Netlify 等平台注入的通用变量（DATABASE_URL、POSTGRES_URL、
 * POSTGRES_URL_NON_POOLING、POSTGRES_PRISMA_URL、DATABASE_URL_UNPOOLED、
 * POSTGRESQL_URL），优先级：专属变量 > 通用 DATABASE_URL。
 * 这样「平台自动注入」与「手工指定」两种用法都能工作。
 *
 * 连接串 scheme 的归一化：postgresql/pg → postgres，mariadb → mysql，
 * rediss → redis，prisma+postgres / prisma → postgres（Prisma Postgres）。
 *
 * Vercel Marketplace「一键连接数据库」注入了哪些变量、对应哪个驱动，
 * 见 docs/ONE_CLICK_DATABASE.md。
 */

export type DsnScheme =
  | "postgres"
  | "postgresql"
  | "mysql"
  | "mariadb"
  | "libsql"
  | "https"
  | "http"
  | "redis"
  | "rediss"
  | "unknown"

export interface ParsedDsn {
  /** 归一化后的 scheme（postgres/postgresql 统一为 postgres）。 */
  scheme: DsnScheme
  host: string
  port: number | null
  user: string | null
  password: string | null
  /** 数据库名（URL path 第一段）。 */
  database: string | null
  /** query 参数（已解码）。 */
  params: Record<string, string>
  /** 原始连接串。 */
  raw: string
}

/** scheme → 归一化名。 */
function normalizeScheme(s: string): DsnScheme {
  const v = String(s || "").toLowerCase()
  if (v === "postgresql" || v === "pg") return "postgres"
  // Prisma Postgres / Prisma Accelerate 的连接串形如
  //   prisma+postgres://accelerate.prisma-data.net/?api_key=xxx
  //   prisma://accelerate.prisma-data.net/?api_key=xxx
  // 底层仍是 Postgres，归一化后交由 host 特征继续判定（best-effort）。
  if (v === "prisma+postgres" || v === "prisma") return "postgres"
  if (v === "mariadb") return "mysql"
  if (v === "https" || v === "http") return v as DsnScheme
  if (v === "rediss") return "redis"
  if (v === "libsql" || v === "libsqls") return "libsql"
  return v as DsnScheme
}

/** 各 scheme 的默认端口。 */
const DEFAULT_PORT: Partial<Record<DsnScheme, number>> = {
  postgres: 5432,
  mysql: 3306,
  redis: 6379,
}

/**
 * 解析连接串。
 *
 * 容错点：`postgres://user:p@ss@host/db` 这类密码含 `@` 的标准 URL 无法用
 * URL 构造器正确解析（会把它当成 host 分隔符）。这里先把「最后一个 @」
 * 之前的部分整体视为 userinfo，再单独拆 user/password。
 */
export function parseDsn(raw: string): ParsedDsn | null {
  const s = String(raw || "").trim()
  if (!s) return null

  // 先按标准 URL 尝试；失败则退回手工解析（应对密码中的特殊字符）
  let scheme = ""
  let rest = ""
  const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(.*)$/.exec(s)
  if (m) {
    scheme = m[1]
    rest = m[2]
  } else if (/^([a-zA-Z][a-zA-Z0-9+.-]*):/.test(s)) {
    // 无 // 的形式（罕见），交给 URL 处理
    scheme = s.slice(0, s.indexOf(":"))
    rest = s.slice(s.indexOf(":") + 1)
  } else {
    return null
  }

  // 拆 fragment / query
  let query = ""
  const hashIdx = rest.indexOf("#")
  if (hashIdx >= 0) rest = rest.slice(0, hashIdx)
  const qIdx = rest.indexOf("?")
  if (qIdx >= 0) {
    query = rest.slice(qIdx + 1)
    rest = rest.slice(0, qIdx)
  }

  // 拆 userinfo（取最后一个 @，避免密码里的 @ 造成误判）
  let user: string | null = null
  let password: string | null = null
  const atIdx = rest.lastIndexOf("@")
  if (atIdx >= 0) {
    const userinfo = rest.slice(0, atIdx)
    rest = rest.slice(atIdx + 1)
    const colonIdx = userinfo.indexOf(":")
    if (colonIdx >= 0) {
      user = safeDecode(userinfo.slice(0, colonIdx))
      password = safeDecode(userinfo.slice(colonIdx + 1))
    } else {
      user = safeDecode(userinfo)
    }
  }

  // 拆 host[:port]/database
  let host = rest
  let port: number | null = null
  let database: string | null = null

  const slashIdx = rest.indexOf("/")
  if (slashIdx >= 0) {
    host = rest.slice(0, slashIdx)
    database = safeDecode(rest.slice(slashIdx + 1)) || null
  }

  // IPv6 字面量 [::1]:5432
  if (host.startsWith("[")) {
    const close = host.indexOf("]")
    if (close >= 0) {
      const maybePort = host.slice(close + 1)
      host = host.slice(1, close)
      if (maybePort.startsWith(":")) port = Number(maybePort.slice(1)) || null
    }
  } else {
    const parts = host.split(":")
    if (parts.length === 2) {
      host = parts[0]
      port = Number(parts[1]) || null
    }
  }

  const norm = normalizeScheme(scheme)
  if (port == null && DEFAULT_PORT[norm]) port = DEFAULT_PORT[norm]!

  return {
    scheme: norm,
    host,
    port,
    user,
    password,
    database,
    params: parseQuery(query),
    raw: s,
  }
}

function parseQuery(q: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!q) return out
  for (const pair of q.split("&")) {
    if (!pair) continue
    const eq = pair.indexOf("=")
    const k = eq >= 0 ? pair.slice(0, eq) : pair
    const v = eq >= 0 ? pair.slice(eq + 1) : ""
    out[safeDecode(k)] = safeDecode(v)
  }
  return out
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/**
 * 从 env（或 process.env）读取字符串值。
 *
 * 平台差异：Cloudflare Workers 把 secret/vars 放 env；Vercel/Netlify/Node
 * 走 process.env。两者都要覆盖。
 */
export function envValue(env: any, ...keys: string[]): string {
  const sources: any[] = [env]
  if (typeof process !== "undefined" && process.env) sources.push(process.env)
  for (const src of sources) {
    if (!src) continue
    for (const k of keys) {
      const v = src[k]
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        return String(v).trim()
      }
    }
  }
  return ""
}

/** 一组「变量名 → 含义」的探测规则。 */
interface UrlProbe {
  /** 候选变量名，按优先级。 */
  keys: string[]
  /** 命中后推断出的驱动名。 */
  driver: string
  /** scheme 必须匹配（为空则不限）。 */
  scheme?: DsnScheme[]
}

/**
 * 通用连接串变量名（平台自动注入 + 手工指定）。
 *
 * 厂商专属变量见 URL_PROBES，优先级高于本列表；这里只放「通用名」，
 * 因为通用名可能是平台为别的服务注入的，需要靠 scheme/host 再次判定。
 *
 * 覆盖：Neon / Vercel Postgres 集成、Prisma Postgres、Vercel Marketplace
 * （见 docs/ONE_CLICK_DATABASE.md）。
 */
const GENERIC_URL_KEYS = [
  "DATABASE_URL",
  "OPENLIST_DATABASE_URL",
  // Neon / Vercel Postgres 集成注入
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_PRISMA_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRESQL_URL",
  "MYSQL_URL",
  "MARIADB_URL",
]

/**
 * 外部数据库的探测顺序。
 *
 * 顺序即优先级：越靠前越「专属」。专属变量优先于通用 DATABASE_URL，
 * 因为通用变量可能是平台为别的服务注入的。
 */
const URL_PROBES: UrlProbe[] = [
  { keys: ["NEON_DATABASE_URL", "NEON_URL", "NEON_POSTGRES_URL"], driver: "neon", scheme: ["postgres"] },
  { keys: ["TURSO_DATABASE_URL", "TURSO_URL", "LIBSQL_URL"], driver: "turso", scheme: ["libsql", "https", "http"] },
  // Supabase：直连 / 连接池 / PostgREST 三种注入形态
  {
    keys: [
      "SUPABASE_URL",
      "SUPABASE_DB_URL",
      "SUPABASE_REST_URL",
      "SUPABASE_POOLER_URL",
      "POSTGREST_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
    ],
    driver: "pgrest",
    scheme: ["https", "http", "postgres"],
  },
  // Vercel Marketplace：Upstash 集成 / Vercel KV 会注入 KV_REST_API_URL + KV_REST_API_TOKEN
  { keys: ["KV_REST_API_URL", "UPSTASH_REDIS_REST_URL", "UPSTASH_URL", "REDIS_HTTP_URL", "REDIS_URL"], driver: "upstash", scheme: ["https", "http", "redis", "rediss"] },
  // Nile：Postgres 重新实现，Vercel 集成注入 NILEDB_URL / NILE_DATABASE_URL（Postgres 连接串）
  { keys: ["NILEDB_URL", "NILE_DATABASE_URL", "NILE_URL"], driver: "pghttp", scheme: ["postgres", "https", "http"] },
  // Prisma Postgres（Vercel Marketplace）：prisma+postgres:// / prisma:// → 归一化为 postgres
  { keys: ["PRISMA_DATABASE_URL", "PRISMA_POSTGRES_URL"], driver: "pghttp", scheme: ["postgres"] },
  { keys: ["PG_HTTP_URL", "POSTGRES_HTTP_URL", "PSQL_HTTP_URL"], driver: "pghttp", scheme: ["https", "http", "postgres"] },
  { keys: ["MYSQL_HTTP_URL", "MYSQL_GATEWAY_URL", "MARIADB_HTTP_URL"], driver: "mysqlhttp", scheme: ["https", "http"] },
]

/**
 * 由连接串 + 显式声明推断驱动。
 *
 * 判定顺序：
 *   1. 显式 `DB_DRIVER`（最高优先级，不做任何推断）
 *   2. 厂商专属变量（NEON_* / TURSO_* / SUPABASE_* / UPSTASH_* / *_HTTP_URL）
 *   3. 通用 `DATABASE_URL` / `POSTGRES_URL` / `MYSQL_URL` → 按 scheme + host 特征推断
 *
 * @returns 推断出的驱动名；无法判定返回 null（交由调用方继续既有探测链）
 */
export function inferDriverFromEnv(env: any): string | null {
  // 1. 显式指定优先
  const explicit = envValue(env, "DB_DRIVER").toLowerCase()
  if (explicit && explicit !== "auto") return explicit

  // 2. 厂商专属变量
  for (const probe of URL_PROBES) {
    const url = envValue(env, ...probe.keys)
    if (!url) continue
    const dsn = parseDsn(url)
    if (dsn && probe.scheme && !probe.scheme.includes(dsn.scheme)) continue
    return probe.driver
  }

  // 3. 通用变量
  const generic = envValue(env, ...GENERIC_URL_KEYS)
  if (generic) return inferFromUrl(generic)

  return null
}

/**
 * 仅凭连接串推断驱动（按 scheme + host 特征）。
 */
export function inferFromUrl(url: string): string | null {
  const dsn = parseDsn(url)
  if (!dsn) return null

  switch (dsn.scheme) {
    case "postgres":
      // Neon 的 endpoint 形如 ep-xxx.<region>.aws.neon.tech
      if (/neon\.tech$/i.test(dsn.host)) return "neon"
      // Supabase 直连 db.<project>.supabase.co，或连接池 *.pooler.supabase.com
      if (/supabase\.(co|in|net|com)$/i.test(dsn.host)) return "pgrest"
      // 其余 postgres:// 走 HTTP 网关（Workers 无裸 TCP）
      return "pghttp"

    case "libsql":
      return "turso"

    case "mysql":
      return "mysqlhttp"

    case "redis":
      return "upstash"

    case "https":
    case "http":
      if (/neon\.tech/i.test(dsn.host)) return "neon"
      if (/supabase\.(co|in|net|com)/i.test(dsn.host)) return "pgrest"
      if (/upstash\.io/i.test(dsn.host)) return "upstash"
      if (/turso\.io/i.test(dsn.host)) return "turso"
      return "pghttp"

    default:
      return null
  }
}

/**
 * 取出「当前应当使用的外部数据库连接串」。
 *
 * 供驱动自身读取配置：驱动传入自己的候选变量名，这里按
 * 「专属变量 → 通用 DATABASE_URL（scheme 匹配才行）」的顺序返回。
 */
export function resolveConnectionUrl(
  env: any,
  keys: string[],
  accept: DsnScheme[],
): string | null {
  const own = envValue(env, ...keys)
  if (own) {
    const dsn = parseDsn(own)
    if (dsn && accept.includes(dsn.scheme)) return own
    // 专属变量即便 scheme 不匹配也信任（例如 supabase.co 的 https URL）
    if (dsn) return own
  }

  const generic = envValue(env, ...GENERIC_URL_KEYS)
  if (generic) {
    const dsn = parseDsn(generic)
    if (dsn && accept.includes(dsn.scheme)) return generic
  }

  return null
}
