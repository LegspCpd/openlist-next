/**
 * HTTP 预条件（RFC 9110 §13）——WebDAV 与 S3 网关共用。
 *
 * 背景：上游 OpenList 的 WebDAV / S3 服务器都不做条件判定，`If-Match`、
 * `If-None-Match` 一律被忽略，于是多个客户端并发写同一路径时后写的会静默
 * 覆盖先写的（上游 issue #3065 / #3067）。乐观锁缺失还会让 rclone、Windows
 * 资源管理器、Synology CloudSync 这类客户端把「本应失败」的写入当成成功。
 *
 * 本模块只做两件事：
 *   1. 给一个文件项派生一个稳定的 ETag；
 *   2. 按 RFC 9110 判定写请求的预条件是否通过。
 */

/** RFC 9110 §8.8.3：弱校验标记 */
const WEAK_PREFIX = /^W\//

/** 去掉可选的 `W/` 前缀，保留带引号的 opaque-tag 部分 */
function opaqueTag(value: string): string {
  return value.trim().replace(WEAK_PREFIX, "").trim()
}

/** 把一个（可能含 `W/`、可能不带引号的）ETag 规整成可比较的 opaque-tag */
function normalizeTag(raw: string | null | undefined): string {
  if (!raw) return ""
  let v = raw.trim()
  // 有些客户端会把多个 ETag 用逗号分隔放在一个头里
  const comma = v.indexOf(",")
  if (comma > 0) v = v.slice(0, comma).trim()
  v = opaqueTag(v)
  // 容忍客户端回传时不带引号
  if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) {
    return v.slice(1, -1)
  }
  return v
}

/**
 * 从 FileItem 派生 ETag。
 *
 * 优先级：
 *   1. 驱动能提供内容哈希（md5/sha1/sha256）→ 直接用它，这是真正意义上的强 ETag；
 *   2. 否则退化为 `size-mtime`（与 nginx / Caddy 等服务器的做法一致）。
 *
 * 关于「强 / 弱」的取舍：RFC 9110 要求 `If-Match` 用强比较，而弱 ETag 永远
 * 匹配不上强比较，会让 `If-Match` 无条件失败。因此这里即便退化值也不是逐字节
 * 强校验，仍然以强 ETag 形式输出——这是绝大多数 WebDAV 服务端的实际做法，
 * 保证客户端（Windows 资源管理器、rclone 等）的乐观锁能正常工作。
 *
 * 只要文件内容变了，size 或 mtime 至少有一个会变，所以「内容变更后 ETag 不变」
 * 的问题不会再出现。
 */
export function etagForFileItem(item: any): string {
  if (!item) return '"0-0"'

  const hashes = item.hashes || {}
  const contentHash: string | undefined =
    hashes.md5 || hashes.sha1 || hashes.sha256 || item.hash
  if (contentHash && typeof contentHash === "string") {
    const clean = contentHash.trim().toLowerCase()
    if (clean) return `"${clean}"`
  }

  const size = Number(item.size || 0)
  const mtimeMs = toEpochMs(item.modified)
  // 16 进制拼接，避免小数点和负号带来的歧义
  return `"${size.toString(16)}-${mtimeMs.toString(16)}"`
}

/** 把各种时间表示统一成 epoch 毫秒；无法解析时返回 0（保持确定性） */
function toEpochMs(value: any): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (!value) return 0
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : 0
}

/** 解析 HTTP-date（RFC 9110 §5.6.7 三种格式），失败返回 null */
export function parseHttpDate(raw: string | null | undefined): number | null {
  if (!raw) return null
  const t = new Date(String(raw)).getTime()
  return Number.isFinite(t) ? t : null
}

export interface PreconditionInput {
  ifMatch?: string | null
  ifNoneMatch?: string | null
  ifUnmodifiedSince?: string | null
}

export interface PreconditionSubject {
  /** 目标资源当前是否已存在 */
  exists: boolean
  /** 已存在时的当前 ETag（etagForFileItem 的输出） */
  etag?: string | null
  /** 已存在时的最后修改时间（epoch ms），用于 If-Unmodified-Since */
  lastModifiedMs?: number | null
}

export interface PreconditionResult {
  ok: boolean
  /** ok=false 时应当返回的状态码（恒为 412） */
  status?: number
  /** 供日志/排障使用的失败原因 */
  reason?: string
}

/**
 * 判定一次写操作（PUT / 条件写）的预条件。
 *
 * 求值顺序按 RFC 9110 §13.2.2：If-Match → If-Unmodified-Since → If-None-Match。
 * 任一步失败即刻返回 412。
 */
export function evaluateWritePreconditions(
  headers: PreconditionInput,
  subject: PreconditionSubject,
): PreconditionResult {
  const { exists } = subject
  const current = normalizeTag(subject.etag)

  // ---- 1) If-Match：资源必须存在且 ETag 匹配 ----
  if (headers.ifMatch) {
    const raw = headers.ifMatch.trim()
    if (raw === "*") {
      if (!exists) {
        return { ok: false, status: 412, reason: "If-Match: * but resource does not exist" }
      }
    } else {
      if (!exists) {
        return { ok: false, status: 412, reason: "If-Match but resource does not exist" }
      }
      const expected = raw
        .split(",")
        .map((s) => normalizeTag(s))
        .filter(Boolean)
      if (!current || !expected.includes(current)) {
        return { ok: false, status: 412, reason: "If-Match ETag mismatch" }
      }
    }
  }

  // ---- 2) If-Unmodified-Since：资源自该时刻起未被修改 ----
  if (headers.ifUnmodifiedSince) {
    const limit = parseHttpDate(headers.ifUnmodifiedSince)
    if (limit !== null && exists) {
      const mtime = Number(subject.lastModifiedMs || 0)
      // HTTP-date 精度只到秒，比较时放宽 1 秒，避免亚秒误差造成误判
      if (mtime && mtime > limit + 1000) {
        return {
          ok: false,
          status: 412,
          reason: "If-Unmodified-Since violated",
        }
      }
    }
  }

  // ---- 3) If-None-Match：资源必须不存在，或 ETag 不匹配 ----
  if (headers.ifNoneMatch) {
    const raw = headers.ifNoneMatch.trim()
    if (raw === "*") {
      if (exists) {
        return { ok: false, status: 412, reason: "If-None-Match: * but resource exists" }
      }
    } else if (exists) {
      const excluded = raw
        .split(",")
        .map((s) => normalizeTag(s))
        .filter(Boolean)
      if (current && excluded.includes(current)) {
        return { ok: false, status: 412, reason: "If-None-Match ETag matched" }
      }
    }
  }

  return { ok: true }
}

/**
 * 判定读请求（GET / HEAD）的预条件，命中时应当返回 304。
 * 只处理 `If-None-Match`（RFC 9110 §13.1.2）。
 */
export function evaluateReadPreconditions(
  headers: PreconditionInput,
  subject: PreconditionSubject,
): { notModified: boolean } {
  if (!subject.exists || !headers.ifNoneMatch) return { notModified: false }

  const raw = headers.ifNoneMatch.trim()
  if (raw === "*") return { notModified: true }

  const current = normalizeTag(subject.etag)
  if (!current) return { notModified: false }
  const candidates = raw
    .split(",")
    .map((s) => normalizeTag(s))
    .filter(Boolean)
  return { notModified: candidates.includes(current) }
}

/** 从请求头收集预条件字段（Hono context，大小写不敏感由 Hono 处理） */
export function preconditionsFromHeaders(c: any): PreconditionInput {
  return {
    ifMatch: c.req.header("If-Match") || null,
    ifNoneMatch: c.req.header("If-None-Match") || null,
    ifUnmodifiedSince: c.req.header("If-Unmodified-Since") || null,
  }
}
