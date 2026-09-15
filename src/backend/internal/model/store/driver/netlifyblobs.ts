/**
 * Netlify Blobs 驱动（KV 语义，仅 Netlify）。
 *
 * Netlify Blobs 是 Netlify 平台的原生键值/对象存储，Functions、Edge Functions、
 * Build Plugins 都能访问。本驱动直接走其 REST API（api.netlify.com，强一致模式），
 * 不依赖 @netlify/blobs 的 SDK，因此可在任意能发 fetch 的边缘运行时使用。
 *
 * 凭据 / 配置（环境变量）：
 *   - NETLIFY_SITE_ID        站点 ID（必填）
 *   - NETLIFY_TOKEN          Personal Access Token（必填）
 *   - NETLIFY_BLOBS_STORE    存储命名空间，默认 openlist
 *   - NETLIFY_BLOBS_CONTEXT  可选，SDK 约定的 base64(JSON) 上下文，含 token/siteID/apiURL
 *
 * 仅支持 map / key 格式（对象存储无 SQL）。推荐 DB_FORMAT=map（整库单键，无需 list）。
 *
 * 参考：https://docs.netlify.app/build/data-and-storage/netlify-blobs/
 */
import type { Driver } from "../types"

const API_BASE = "https://api.netlify.com/api/v1/blobs"

interface NetlifyCtx {
  apiURL?: string
  edgeURL?: string
  token?: string
  siteID?: string
}

function resolveCtx(env?: any): NetlifyCtx | null {
  const e = env || (typeof process !== "undefined" ? process.env : {}) || {}

  // 1. 显式变量
  const siteID = e?.NETLIFY_SITE_ID || e?.SITE_ID
  const token = e?.NETLIFY_TOKEN || e?.NETLIFY_API_TOKEN
  if (siteID && token) {
    return { apiURL: API_BASE, token, siteID }
  }

  // 2. NETLIFY_BLOBS_CONTEXT（SDK 约定，base64 JSON）
  const ctxRaw = e?.NETLIFY_BLOBS_CONTEXT
  if (ctxRaw) {
    try {
      const parsed = JSON.parse(
        typeof ctxRaw === "string" && ctxRaw.trim().startsWith("{")
          ? ctxRaw
          : Buffer.from(ctxRaw, "base64").toString("utf8"),
      ) as NetlifyCtx
      if (parsed?.siteID && parsed?.token) return parsed
    } catch {
      // ignore malformed context
    }
  }

  return null
}

function storeName(env?: any): string {
  const e = env || (typeof process !== "undefined" ? process.env : {}) || {}
  return e?.NETLIFY_BLOBS_STORE || "openlist"
}

function buildHeaders(ctx: NetlifyCtx): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${ctx.token}`,
    "Netlify-Blobs-Store": storeName(),
  }
  return headers
}

function blobUrl(ctx: NetlifyCtx, key: string): string {
  const base = ctx.apiURL || API_BASE
  return `${base}?site_id=${encodeURIComponent(ctx.siteID!)}&key=${encodeURIComponent(key)}`
}

export const netlifyBlobsDriver: Driver = {
  name: "netlifyblobs",

  async isAvailable(env?: any): Promise<boolean> {
    return resolveCtx(env) != null
  },

  async init(): Promise<void> {},

  async get(key: string, env?: any): Promise<string | null> {
    const ctx = resolveCtx(env)
    if (!ctx) throw new Error("Netlify Blobs context not configured")

    const res = await fetch(blobUrl(ctx, key), {
      method: "GET",
      headers: buildHeaders(ctx),
    })
    if (res.status === 404) return null
    if (!res.ok) {
      throw new Error(`Netlify Blobs GET failed: ${res.status}`)
    }
    return await res.text()
  },

  async put(key: string, value: string, env?: any): Promise<void> {
    const ctx = resolveCtx(env)
    if (!ctx) throw new Error("Netlify Blobs context not configured")

    const res = await fetch(blobUrl(ctx, key), {
      method: "PUT",
      headers: { ...buildHeaders(ctx), "Content-Type": "application/json" },
      body: value,
    })
    if (!res.ok) {
      throw new Error(`Netlify Blobs PUT failed: ${res.status}`)
    }
  },

  async delete(key: string, env?: any): Promise<void> {
    const ctx = resolveCtx(env)
    if (!ctx) throw new Error("Netlify Blobs context not configured")

    const res = await fetch(blobUrl(ctx, key), {
      method: "DELETE",
      headers: buildHeaders(ctx),
    })
    if (!res.ok && res.status !== 404) {
      throw new Error(`Netlify Blobs DELETE failed: ${res.status}`)
    }
  },

  async list(prefix: string, env?: any): Promise<string[]> {
    const ctx = resolveCtx(env)
    if (!ctx) throw new Error("Netlify Blobs context not configured")

    const base = ctx.apiURL || API_BASE
    const url = `${base}?site_id=${encodeURIComponent(ctx.siteID!)}`
    const res = await fetch(url, { method: "GET", headers: buildHeaders(ctx) })
    if (!res.ok) {
      throw new Error(`Netlify Blobs LIST failed: ${res.status}`)
    }
    const data: any = await res.json().catch(() => [])
    const entries: any[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.blobs)
        ? data.blobs
        : []
    return entries
      .map((e) => (typeof e === "string" ? e : e?.key))
      .filter((k): k is string => typeof k === "string" && k.startsWith(prefix))
  },

  async health(env?: any): Promise<any> {
    const ctx = resolveCtx(env)
    if (!ctx) {
      return {
        configured: false,
        connected: false,
        platform: "Netlify Blobs",
        mode: "netlifyblobs",
        error: "Netlify Blobs not configured (expected NETLIFY_SITE_ID + NETLIFY_TOKEN)",
      }
    }
    try {
      // 用一次 list 探测连通性（空前缀）
      await this.list("", env)
      return {
        configured: true,
        connected: true,
        platform: "Netlify Blobs",
        mode: "netlifyblobs",
        note: "Object storage: DB_FORMAT=sql is not supported; use map or key.",
      }
    } catch (err: any) {
      return {
        configured: true,
        connected: false,
        platform: "Netlify Blobs",
        mode: "netlifyblobs",
        error: err?.message || String(err),
      }
    }
  },
}
