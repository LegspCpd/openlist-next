/**
 * Cloudflare Hyperdrive 驱动（仅 Cloudflare Workers + nodejs_compat）。
 *
 * Hyperdrive 把 TCP 数据库（MySQL / PostgreSQL）通过边缘代理暴露成一条
 * 连接串，绕开 Workers 无裸 TCP 的限制：业务代码仍用 mysql2/pg 走 TCP，
 * 但连接目标是 Hyperdrive 提供的本地代理。
 *
 * 本驱动聚焦最常见的 MySQL Hyperdrive：读取 `env.HYPERDRIVE.connectionString`
 * （Hyperdrive 绑定自动注入），用 mysql2 连接，复用 mysql.ts 的全部 DDL / KV 逻辑。
 *
 * 可用性：`env.HYPERDRIVE` 绑定存在时即认为可用；其余平台（无该绑定）返回 false，
 * 不会干扰 auto 探测链。
 *
 * 注意：PostgreSQL Hyperdrive 需要 pg 客户端（当前依赖未引入），故本驱动只覆盖
 * MySQL 形态；Postgres 场景建议直接用 `neon` / `turso` / `pghttp` 等 HTTP 驱动。
 */
import type { Driver } from "../types"
import { buildDdl, getTablePrefix, KV_SCHEMA_MYSQL } from "../schema"

function isNode(): boolean {
  return typeof process !== "undefined" && process.release?.name === "node"
}

/** 从 env 取出 Hyperdrive 连接串（绑定或显式变量均可）。 */
function getHyperdriveConfig(env: any): string | null {
  const e = env || (typeof process !== "undefined" ? process.env : {}) || {}
  // 绑定对象：env.HYPERDRIVE.connectionString
  const binding = e?.HYPERDRIVE
  if (binding && (binding.connectionString || binding.databaseUrl)) {
    return binding.connectionString || binding.databaseUrl
  }
  // 兜底：显式变量（自建代理 / 本地调试）
  return e?.HYPERDRIVE_CONNECTION_STRING || null
}

let _pool: any = null
let _poolKey: string | null = null

async function getPool(env: any): Promise<any | null> {
  const connString = getHyperdriveConfig(env)
  if (!connString) return null
  const key = connString
  if (_pool && _poolKey === key) return _pool

  // 动态 import，避免打包到不支持 Hyperdrive 的运行环境
  const { createPool } = await import("mysql2/promise")
  _pool = createPool(connString)
  _poolKey = key
  return _pool
}

let _schemaInitedPrefix: string | null = null

async function ensureSchema(pool: any, env?: any): Promise<void> {
  const prefix = getTablePrefix(env)
  if (_schemaInitedPrefix === prefix) return
  // KV 表（map/key 格式）+ 列式表（sql 格式）一并创建
  for (const ddl of [...KV_SCHEMA_MYSQL, ...buildDdl("mysql", env)]) {
    await pool.query(ddl)
  }
  _schemaInitedPrefix = prefix
}

export const hyperdriveDriver: Driver = {
  name: "hyperdrive",
  dialect: "mysql",

  async isAvailable(env?: any): Promise<boolean> {
    if (!isNode()) return false
    return getHyperdriveConfig(env) != null
  },

  async init(env?: any): Promise<void> {
    const pool = await getPool(env)
    if (pool) await ensureSchema(pool, env)
  },

  async get(key: string, env?: any): Promise<string | null> {
    const pool = await getPool(env)
    if (!pool) throw new Error("Hyperdrive pool not available")
    await ensureSchema(pool, env)
    const [rows]: any[] = await pool.query(
      "SELECT `value` FROM `kv` WHERE `key` = ?",
      [key],
    )
    return rows?.[0]?.value || null
  },

  async put(key: string, value: string, env?: any): Promise<void> {
    const pool = await getPool(env)
    if (!pool) throw new Error("Hyperdrive pool not available")
    await ensureSchema(pool, env)
    await pool.query(
      "INSERT INTO `kv` (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
      [key, value],
    )
  },

  async delete(key: string, env?: any): Promise<void> {
    const pool = await getPool(env)
    if (!pool) throw new Error("Hyperdrive pool not available")
    await ensureSchema(pool, env)
    await pool.query("DELETE FROM `kv` WHERE `key` = ?", [key])
  },

  async list(prefix: string, env?: any): Promise<string[]> {
    const pool = await getPool(env)
    if (!pool) throw new Error("Hyperdrive pool not available")
    await ensureSchema(pool, env)
    const [rows]: any[] = await pool.query(
      "SELECT `key` FROM `kv` WHERE `key` LIKE ? ORDER BY `key`",
      [`${prefix}%`],
    )
    return (rows || []).map((r: any) => r.key)
  },

  async query(sql: string, params: any[], env?: any): Promise<any[]> {
    const pool = await getPool(env)
    if (!pool) throw new Error("Hyperdrive pool not available")
    await ensureSchema(pool, env)
    const [rows]: any[] = await pool.query(sql, params)
    return rows || []
  },

  async execute(sql: string, params: any[], env?: any): Promise<void> {
    const pool = await getPool(env)
    if (!pool) throw new Error("Hyperdrive pool not available")
    await ensureSchema(pool, env)
    await pool.query(sql, params)
  },

  async batch(
    statements: Array<{ sql: string; params: any[] }>,
    env?: any,
  ): Promise<void> {
    const pool = await getPool(env)
    if (!pool) throw new Error("Hyperdrive pool not available")
    await ensureSchema(pool, env)
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      for (const stmt of statements) {
        await conn.query(stmt.sql, stmt.params)
      }
      await conn.commit()
    } catch (err) {
      try {
        await conn.rollback()
      } catch {}
      throw err
    } finally {
      conn.release()
    }
  },

  async health(env?: any): Promise<any> {
    const connString = getHyperdriveConfig(env)
    if (!connString) {
      return {
        configured: false,
        connected: false,
        platform: "Cloudflare Hyperdrive (MySQL)",
        mode: "hyperdrive",
        error:
          "Hyperdrive binding not found (expected env.HYPERDRIVE or HYPERDRIVE_CONNECTION_STRING)",
      }
    }
    if (!isNode()) {
      return {
        configured: true,
        connected: false,
        platform: "Cloudflare Hyperdrive (MySQL)",
        mode: "hyperdrive",
        error: "Hyperdrive requires Node.js compatibility (nodejs_compat)",
      }
    }
    try {
      const pool = await getPool(env)
      await pool.query("SELECT 1")
      return {
        configured: true,
        connected: true,
        platform: "Cloudflare Hyperdrive (MySQL)",
        mode: "hyperdrive",
      }
    } catch (err: any) {
      return {
        configured: true,
        connected: false,
        platform: "Cloudflare Hyperdrive (MySQL)",
        mode: "hyperdrive",
        error: err?.message || String(err),
      }
    }
  },
}
