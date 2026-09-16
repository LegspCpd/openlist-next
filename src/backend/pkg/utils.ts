import { Context } from "hono"
import { getDb } from "../internal/model/db"

/**
 * Common utilities for OpenList backend services.
 */

export * from "./xml"
export * from "./mime"
export * from "./errs"
export * from "./generic"
export * from "./http"
export * from "./crypto"
export * from "./stream"

// Format byte sizes to human-readable strings
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
}

/**
 * 解析真实客户端 IP。
 *
 * 边缘运行时里 socket 地址没有意义，必须读平台注入的头。顺序：
 * CF-Connecting-IP（Cloudflare）→ EO-Connecting-IP（EdgeOne）→ X-Real-IP
 * （阿里云 ESA / nginx）→ X-Forwarded-For 第一段。
 *
 * 注意：这些头都可以被客户端伪造，只适用于「区分访问者 / 限流去重」
 * 这类尽力而为的场景，不能当作可信身份。
 */
export function clientIpOf(c: any): string {
  const h = (name: string) => {
    try {
      return c?.req?.header?.(name) || ""
    } catch {
      return ""
    }
  }
  return (
    h("CF-Connecting-IP") ||
    h("EO-Connecting-IP") ||
    h("X-Real-IP") ||
    h("x-forwarded-for")?.split(",")[0]?.trim() ||
    h("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  )
}

// Check administrator authorization from context
export async function checkAdminAuth(c: Context): Promise<boolean> {
  // 静态 API token（settings.token）
  if (await isStaticApiToken(c)) return true

  const authHeader = c.req.header("Authorization")
  if (!authHeader) return false
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.substring(7)
    : authHeader

  // JWT：管理员登录用户也视为管理员（登录用户变管理员判定）
  try {
    const { verify } = await import("hono/jwt")
    const { getJwtSecret } = await import("../server/middlewares")
    const secret = await getJwtSecret(c)
    const payload: any = await verify(token, secret, "HS256")
    if (payload && payload.role === 2) {
      // 确认该用户存在于 DB 且未被禁用
      const db = await getDb(c.env)
      const user = (db.users || []).find(
        (u: any) => u.id === payload.id || u.username === payload.username,
      )
      return !!(user && !user.disabled)
    }
  } catch {}
  return false
}

/**
 * 仅判断请求是否携带匹配的静态 API token（settings.token）。
 * 与 checkAdminAuth 不同：不含 JWT 判定，供身份解析（getUserFromContext）
 * 区分「静态 token 调用方」与「登录用户」，避免 JWT 管理员被误判为 api-token。
 */
export async function isStaticApiToken(c: Context): Promise<boolean> {
  const authHeader = c.req.header("Authorization")
  if (!authHeader) return false
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.substring(7)
    : authHeader
  const db = await getDb(c.env)
  const tokenSetting = db.settings.find((s: any) => s.key === "token")
  if (!tokenSetting || !tokenSetting.value) return false
  const tokenBytes = new TextEncoder().encode(token)
  const expectedBytes = new TextEncoder().encode(String(tokenSetting.value))
  if (tokenBytes.length !== expectedBytes.length) return false
  let match = 0
  for (let i = 0; i < tokenBytes.length; i++) {
    match |= tokenBytes[i] ^ expectedBytes[i]
  }
  return match === 0
}
