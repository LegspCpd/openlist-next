/**
 * Supabase / PostgREST 驱动（REST 语义，仅 KV）。
 *
 * 为什么不是通用 SQL 驱动：PostgREST 把数据库暴露成 REST 资源，**不能执行
 * 任意 SQL**，因此本驱动只实现 KV 四件套（get/put/delete/list），不支持
 * `DB_FORMAT=sql`。对 `map` / `key` 格式完全可用，这也是 Supabase 场景的
 * 推荐搭配。
 *
 * 前置条件：目标库需先建好 KV 表（驱动无法建表）：
 *
 *   CREATE TABLE IF NOT EXISTS kv (
 *     key   TEXT PRIMARY KEY,
 *     value TEXT NOT NULL
 *   );
 *
 * 环境变量：
 *   - SUPABASE_URL + SUPABASE_KEY（或 SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY）
 *   - POSTGREST_URL + POSTGREST_KEY（自建 PostgREST）
 */
import type { Driver } from "../types"
import { envValue, parseDsn } from "../dsn"

interface PgRestConfig {
  baseUrl: string
  key: string
  /** KV 表名，默认 kv */
  table: string
  schema: string
}

function resolve(env?: any): PgRestConfig | null {
  let baseUrl = envValue(env, "SUPABASE_URL", "POSTGREST_URL")

  // 也接受 postgres:// 形态的 Supabase 直连串：db.<ref>.supabase.co → https://<ref>.supabase.co
  if (!baseUrl) {
    const raw = envValue(
      env,
      "DATABASE_URL",
      "OPENLIST_DATABASE_URL",
      "POSTGRES_URL",
      "POSTGRESQL_URL",
    )
    if (raw) {
      const d = parseDsn(raw)
      if (d && /supabase\.(co|in|net)$/i.test(d.host)) {
        const host = d.host.replace(/^db\./i, "")
        baseUrl = `https://${host}`
      }
    }
  }

  if (!baseUrl) return null

  const key = envValue(
    env,
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_KEY",
    "SUPABASE_KEY",
    "SUPABASE_ANON_KEY",
    "POSTGREST_KEY",
    "POSTGREST_TOKEN",
  )
  if (!key) return null

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    key,
    table: envValue(env, "POSTGREST_KV_TABLE") || "kv",
    schema: envValue(env, "POSTGREST_SCHEMA") || "public",
  }
}

function headers(cfg: PgRestConfig, extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: cfg.key,
    Authorization: `Bearer ${cfg.key}`,
    "Content-Type": "application/json",
    ...extra,
  }
}

function tableUrl(cfg: PgRestConfig): string {
  return `${cfg.baseUrl}/rest/v1/${cfg.table}`
}

/** PostgREST 的 eq 过滤值需要 URL 编码（值里可能有 / . , 等）。 */
function eqFilter(col: string, value: string): string {
  return `${col}=eq.${encodeURIComponent(value)}`
}

async function request(
  cfg: PgRestConfig,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${tableUrl(cfg)}${path}`, {
    ...init,
    headers: headers(cfg, (init.headers as Record<string, string>) || {}),
  })
}

export const pgrestDriver: Driver = {
  name: "pgrest",
  // 不走 SQL 通道；声明方言仅为保持一致（实际不会被用到）
  dialect: "postgres",

  async isAvailable(env?: any): Promise<boolean> {
    return resolve(env) != null
  },

  /**
   * 无法建表（PostgREST 只暴露 REST），这里只做连通性确认。
   * 表缺失会在首次读写时以明确的错误暴露出来。
   */
  async init(): Promise<void> {},

  async get(key: string, env?: any): Promise<string | null> {
    const cfg = resolve(env)
    if (!cfg) throw new Error("pgrest is not configured")

    const res = await request(cfg, `?${eqFilter("key", key)}&select=value`)
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(
        `pgrest GET failed: HTTP ${res.status} - ${body.slice(0, 300)}` +
          (res.status === 404
            ? `\nTable "${cfg.table}" may not exist. Create it first:\n` +
              `  CREATE TABLE IF NOT EXISTS ${cfg.table} (key TEXT PRIMARY KEY, value TEXT NOT NULL);`
            : ""),
      )
    }

    const rows: any[] = await res.json()
    return rows?.[0]?.value ?? null
  },

  async put(key: string, value: string, env?: any): Promise<void> {
    const cfg = resolve(env)
    if (!cfg) throw new Error("pgrest is not configured")

    const res = await request(cfg, "", {
      method: "POST",
      headers: {
        // resolution=merge-duplicates → 主键冲突时更新（即 UPSERT）
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify([{ key, value }]),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(`pgrest UPSERT failed: HTTP ${res.status} - ${body.slice(0, 300)}`)
    }
  },

  async delete(key: string, env?: any): Promise<void> {
    const cfg = resolve(env)
    if (!cfg) throw new Error("pgrest is not configured")

    const res = await request(cfg, `?${eqFilter("key", key)}`, { method: "DELETE" })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(`pgrest DELETE failed: HTTP ${res.status} - ${body.slice(0, 300)}`)
    }
  },

  async list(prefix: string, env?: any): Promise<string[]> {
    const cfg = resolve(env)
    if (!cfg) throw new Error("pgrest is not configured")

    // PostgREST 的 like 用 * 作为通配符
    const res = await request(
      cfg,
      `?key=like.${encodeURIComponent(prefix)}*&select=key&order=key`,
    )
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(`pgrest LIST failed: HTTP ${res.status} - ${body.slice(0, 300)}`)
    }

    const rows: any[] = await res.json()
    return rows.map((r: any) => String(r?.key)).filter(Boolean)
  },

  async health(env?: any): Promise<any> {
    const cfg = resolve(env)
    if (!cfg) {
      return {
        configured: false,
        connected: false,
        platform: "Supabase / PostgREST",
        mode: "pgrest",
        error:
          "SUPABASE_URL (or POSTGREST_URL) and a service/anon key are required (SUPABASE_KEY / SUPABASE_ANON_KEY / POSTGREST_KEY)",
      }
    }

    try {
      const res = await request(cfg, "?select=key&limit=1")
      if (!res.ok) {
        return {
          configured: true,
          connected: false,
          platform: "Supabase / PostgREST",
          mode: "pgrest",
          error:
            res.status === 404
              ? `Table "${cfg.table}" not found. Create it in the SQL editor:\n` +
                `  CREATE TABLE IF NOT EXISTS ${cfg.table} (key TEXT PRIMARY KEY, value TEXT NOT NULL);`
              : `HTTP ${res.status} - ${(await res.text().catch(() => "")).slice(0, 200)}`,
        }
      }
      return {
        configured: true,
        connected: true,
        platform: "Supabase / PostgREST",
        mode: "pgrest",
        note: "REST mode: DB_FORMAT=sql is not supported; use map or key.",
      }
    } catch (err: any) {
      return {
        configured: true,
        connected: false,
        platform: "Supabase / PostgREST",
        mode: "pgrest",
        error: err?.message || String(err),
      }
    }
  },
}
