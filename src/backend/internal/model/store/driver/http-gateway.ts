/**
 * 通用 SQL-over-HTTP 网关驱动。
 *
 * 解决什么问题：边缘运行时不能开 TCP，但很多外部数据库（自建 Postgres、
 * 外部 MySQL/MariaDB、TiDB、PolarDB…）并不提供官方 HTTP 接口。此时只需在
 * 能连到数据库的地方跑一个极薄网关，把 SQL 通过 HTTP 转发即可。
 *
 * 网关协议（刻意设计得极简，用几十行 Node/Python 就能实现）：
 *
 *   POST <gateway-url>
 *   Authorization: Bearer <token>          （可选，取决于网关是否要求）
 *   Content-Type: application/json
 *
 *   {"sql": "SELECT * FROM kv WHERE key = ?", "params": ["abc"]}
 *
 *   → 200 {"rows": [{"key": "abc", "value": "..."}], "rowCount": 1}
 *
 * 响应容错：不同实现的字段名不同，这里依次尝试 rows / data / result /
 * results / records，或直接是数组。这样用户拿现成的开源网关也能接上。
 *
 * 批量默认逐条执行（语义确定）；网关若支持批量可自行在服务端优化。
 */
import type { Driver } from "../types"
import { createHttpSqlDriver, assertOk, normalizeParam } from "./http-sql"
import { envValue, parseDsn, type DsnScheme } from "../dsn"

export interface GatewayOptions {
  /** 驱动名（DB_DRIVER 取值）。 */
  name: string
  /** SQL 方言。 */
  dialect: "postgres" | "mysql" | "sqlite"
  /** health 展示名。 */
  platform: string
  /** 网关地址的环境变量名（按优先级）。 */
  urlKeys: string[]
  /** 网关 token 的环境变量名。 */
  tokenKeys: string[]
  /** 可接受的连接串 scheme（用于从 DATABASE_URL 自动推断）。 */
  accept: DsnScheme[]
  /** 从通用 DATABASE_URL 接管前的 host 排除规则。 */
  excludeHost?: RegExp
}

interface GatewayConfig {
  url: string
  token: string
  /** 原始连接串（若有），网关可直接透传给数据库 */
  dsn?: string
}

function resolveFactory(opts: GatewayOptions) {
  return function resolve(env?: any): GatewayConfig | null {
    // 1. 显式网关地址
    const url = envValue(env, ...opts.urlKeys)
    if (url) {
      return { url: url.replace(/\/+$/, ""), token: envValue(env, ...opts.tokenKeys) }
    }

    // 2. 通用连接串（scheme 匹配且 host 未被别的驱动认领）
    const raw = envValue(
      env,
      "DATABASE_URL",
      "OPENLIST_DATABASE_URL",
      "POSTGRES_URL",
      "POSTGRESQL_URL",
      "MYSQL_URL",
      "MARIADB_URL",
    )
    if (!raw) return null

    const d = parseDsn(raw)
    if (!d || !opts.accept.includes(d.scheme)) return null
    if (opts.excludeHost?.test(d.host)) return null

    // 走到这里说明没有配置显式网关地址：
    //  - postgres:// / mysql:// 需要网关转发，没有网关就不可用（边缘无 TCP）
    //  - https:// 形态本身就是网关地址，可直接用
    if (d.scheme === "postgres" || d.scheme === "mysql") return null

    return {
      url: raw.replace(/\/+$/, ""),
      token: envValue(env, ...opts.tokenKeys),
      dsn: raw,
    }
  }
}

/** 宽容地取出网关返回的行数组。 */
function rowsFromGateway(json: any): any[] {
  if (Array.isArray(json)) return json
  for (const key of ["rows", "data", "result", "results", "records"]) {
    if (Array.isArray(json?.[key])) return json[key]
  }
  return []
}

export function createGatewayDriver(opts: GatewayOptions): Driver {
  const resolve = resolveFactory(opts)

  async function call(
    cfg: GatewayConfig,
    sql: string,
    params: any[],
  ): Promise<any> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }
    if (cfg.token) headers["Authorization"] = `Bearer ${cfg.token}`

    const res = await fetch(cfg.url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        sql,
        params: (params || []).map(normalizeParam),
        // 带上原始连接串，便于网关按库路由（网关可忽略）
        ...(cfg.dsn ? { dsn: cfg.dsn } : {}),
      }),
    })

    await assertOk(res, `${opts.name} gateway`)
    return await res.json()
  }

  return createHttpSqlDriver({
    name: opts.name,
    dialect: opts.dialect,
    platform: opts.platform,

    resolve,

    async query(cfg: GatewayConfig, sql: string, params: any[]) {
      const json = await call(cfg, sql, params)
      return rowsFromGateway(json)
    },

    async execute(cfg: GatewayConfig, sql: string, params: any[]) {
      await call(cfg, sql, params)
    },

    redact(cfg: GatewayConfig) {
      return { url: cfg.url }
    },
  })
}
