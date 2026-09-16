import { getDb, saveDb } from "../model/db"
import { safeErrorMessage } from "../../pkg/errs"

/**
 * Share path resolution for /@s/{shareId}/... (frontend browsing)
 * and /{shareId}/... (after stripping /sd prefix in raw downloads).
 */

export interface ShareResolveResult {
  ok: boolean
  error?: string
  share?: any
  /** Mapped real storage path (single-file shares or sub-paths) */
  realPath?: string
  /** Multi-file share root — frontend should render a virtual list */
  virtualList?: boolean
}

// FIX(C-3): the old implementation only did filter(Boolean), so ".." segments
// survived verbatim and `/@s/{id}/../../../` escalated a single-file share
// into browsing the entire storage root (verified at runtime).
// Backslashes are normalized first for the same reason as resolvePath (C-2).
const normalize = (p: string) => {
  const stack: string[] = []
  for (const seg of String(p || "")
    .replace(/\\/g, "/")
    .split("/")) {
    if (seg === "" || seg === ".") continue
    if (seg === "..") {
      stack.pop() // clamp at the share root instead of escaping upward
      continue
    }
    stack.push(seg)
  }
  return "/" + stack.join("/")
}

/** 「最大访问次数」的去重窗口：同一访问者在该窗口内只计一次（对齐上游 30 分钟） */
const ACCESS_DEDUPE_TTL_MS = 30 * 60 * 1000
/** 缓存超过这个条数时清理一轮过期项，避免长期运行的实例里无限增长 */
const ACCESS_DEDUPE_MAX_ENTRIES = 4096

/**
 * 去重缓存：key = `${shareId}|${访问者标识}`，value = 首次计入的时间戳。
 *
 * 放在进程内存里，与上游 Go 版一致（Go 用 cache.NewMemCache + 30 分钟 TTL）。
 * 刻意不落库：一是没必要为「去重」往分享记录里加一份访问者名单，二是 shares 表
 * 没有这类列，加列会让已经建好表的 SQL 格式库（DB_FORMAT=sql）写入时报
 * "no such column" —— 而 store 层只有 CREATE TABLE IF NOT EXISTS，没有 ALTER。
 *
 * 代价是每个实例各记一份账：多实例部署时同一访问者可能被计多次（上限偏严），
 * 但不会反向把同一访问者的后续请求拦在门外。
 */
const accessDedupeCache = new Map<string, number>()

let anonSeq = 0

/** 生成一个一次性的匿名访问者标识（部分运行环境没有 crypto.randomUUID） */
function randomToken(): string {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID()
    }
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const b = new Uint8Array(16)
      crypto.getRandomValues(b)
      return Array.from(b)
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("")
    }
  } catch {
    // 落到下面的计数器兜底
  }
  return `anon-${Date.now()}-${++anonSeq}`
}

/** 仅供测试：清空去重缓存。运行时不需要调用。 */
export function resetShareAccessCache(): void {
  accessDedupeCache.clear()
}

/**
 * 判断这次请求是否要占用一个「访问名额」。
 *
 * 全程同步执行：调用方之间不插入 await，就不会出现「并发的两个请求都以为自己是
 * 第一个访问者」的竞态——前端进入分享页时会并行发 /fs/get 与 /fs/list。
 */
function claimAccessSlot(shareId: string, clientKey: string): boolean {
  const now = Date.now()

  if (accessDedupeCache.size > ACCESS_DEDUPE_MAX_ENTRIES) {
    for (const [k, ts] of accessDedupeCache) {
      if (now - ts >= ACCESS_DEDUPE_TTL_MS) accessDedupeCache.delete(k)
    }
  }

  // 拿不到访问者标识时 fail-closed：每次都算新访问者，不能让人靠抹掉 IP 头绕过上限
  const key = clientKey
    ? `${shareId}|${clientKey}`
    : `${shareId}|anon:${randomToken()}`

  const seenAt = accessDedupeCache.get(key)
  if (seenAt !== undefined && now - seenAt < ACCESS_DEDUPE_TTL_MS) return false

  accessDedupeCache.set(key, now)
  return true
}

/**
 * Resolve a share request path.
 * @param reqPath   e.g. `/@s/abc`, `/@s/abc/sub`, or `/abc/sub` (already stripped /sd)
 * @param password  share password from frontend ("" if none)
 * @param clientKey 访问者标识（通常是客户端 IP）。用于「最大访问次数」去重：
 *                  同一个访问者在窗口期内只计一次，否则一次翻页会打好几个接口，
 *                  计数器会被重复累加。留空时按每次请求都算一个新访问者（fail-closed）。
 * @param envCtx    Worker env（读取当前数据库）
 */
export async function resolveShare(
  reqPath: string,
  password: string,
  clientKey: string,
  envCtx?: any,
): Promise<ShareResolveResult> {
  const clean = normalize(reqPath)
  const parts = clean.split("/").filter(Boolean)
  if (parts.length < 1) {
    return { ok: false, error: "Invalid share path" }
  }

  // Strip leading "@s" segment if present
  let shareId: string
  let rest: string[]
  if (parts[0] === "@s") {
    if (parts.length < 2) return { ok: false, error: "Invalid share path" }
    shareId = parts[1]
    rest = parts.slice(2)
  } else {
    shareId = parts[0]
    rest = parts.slice(1)
  }

  const db = await getDb(envCtx)
  const share = (db.shares || []).find((s: any) => s.id === shareId)
  if (!share) return { ok: false, error: "share not found" }
  if (share.disabled) return { ok: false, error: "share has been disabled" }
  if (share.expires && new Date(share.expires) < new Date()) {
    return { ok: false, error: "share has expired" }
  }

  // ---------------------------------------------------------------------------
  // 最大访问次数（FIX: 上游 issue #2143）
  //
  // 旧实现每次调用都自增 accessed，并用 `accessed >= max_accessed` 拦截。
  // 但一次「访问」在实际链路里会打多个接口（/fs/get + /fs/list，点开文件还会走
  // 下载端点），于是计数器一次访问涨好几点：max=3 差不多一次就用完，max=1 则
  // 第一个请求就把自己拦掉，表现为「第一次访问就提示分享已失效」。
  //
  // 正确语义是「最多被 N 个访问者打开」。所以计数放在口令/内容校验之后：
  // 校验没过的请求不该占用名额（否则口令传错几次就把分享刷废了）。
  // ---------------------------------------------------------------------------
  if (share.pwd && share.pwd !== password) {
    return { ok: false, error: "wrong password" }
  }
  if (!share.files || share.files.length === 0) {
    return { ok: false, error: "share is empty" }
  }

  // 同一访问者在窗口期内只占一次名额；上限判定只针对「新占名额」的请求 ——
  // 同一访问者的后续请求（翻页、下载）必须放行，否则会被自己的计数拦掉。
  const isNewVisitor = claimAccessSlot(shareId, clientKey)
  if (
    isNewVisitor &&
    share.max_accessed > 0 &&
    (share.accessed || 0) >= share.max_accessed
  ) {
    return { ok: false, error: "share access count exceeded" }
  }

  // 只在真的新增了访问者时才写库。旧实现每个请求都无条件 saveDb，
  // 匿名分享页的每一次接口调用都会触发一次完整 DB 写入。
  if (isNewVisitor) {
    share.accessed = (share.accessed || 0) + 1
    saveDb(db, envCtx).catch(() => {})
  }

  // Multi-file share root → virtual list
  if (share.files.length > 1 && rest.length === 0) {
    return { ok: true, share, virtualList: true }
  }

  // FIX(C-3): containment check. Whatever normalize() produces, the result
  // must stay inside one of the explicitly shared paths.
  const allowedRoots: string[] = (share.files || []).map((f: string) =>
    normalize(f),
  )
  const withinShare = (p: string) =>
    allowedRoots.some((a) => p === a || p.startsWith(a === "/" ? "/" : a + "/"))

  // Single-file share: one file has no sub-paths, so trailing segments are
  // always suspicious — reject instead of concatenating them.
  if (share.files.length === 1) {
    if (rest.length > 0) return { ok: false, error: "path not found in share" }
    return { ok: true, share, realPath: normalize(share.files[0]) }
  }

  // Multi-file share, sub-path: match by basename
  const subName = rest[0]
  const match = share.files.find((f: string) => {
    const segs = String(f).split("/").filter(Boolean)
    return segs[segs.length - 1] === subName
  })
  if (!match) return { ok: false, error: "path not found in share" }
  const real = normalize([normalize(match), ...rest.slice(1)].join("/"))
  if (!withinShare(real)) return { ok: false, error: "path not found in share" }
  return { ok: true, share, realPath: real }
}

/** Extract the share id from a path like `/@s/abc/sub` or `/abc/sub` */
export function extractShareId(reqPath: string): string | null {
  const parts = normalize(reqPath).split("/").filter(Boolean)
  if (parts.length === 0) return null
  if (parts[0] === "@s") return parts[1] || null
  return parts[0]
}

// ---------------------------------------------------------------------------
// 分享上下文的错误脱敏（上游 issue #2153）
//
// 分享访问复用普通路径的驱动调用，于是驱动异常（例如
// `failed get obj: stat /share/apk/xxx.apk/yy: not a directory`）会被
// safeErrorMessage 原样回显给匿名访问者，把真实物理路径泄出去——
// 上游的复现方式就是在分享链接后面随便加几个字符。
//
// 处理方式：进入分享分支时打标记，之后所有对外错误统一泛化。
// ---------------------------------------------------------------------------

/** 分享请求对外唯一可见的失败文案 */
export const SHARE_PATH_ERROR = "path not found in share"

const SHARE_CTX_KEY = "__openlist_share_ctx"

/** 标记当前请求是「分享上下文」——此后不得回显下游错误 */
export function markShareContext(c: any): void {
  try {
    c?.set?.(SHARE_CTX_KEY, true)
  } catch {
    // 非 Hono context（部分内部调用）忽略即可
  }
}

/** 当前请求是否处于分享上下文 */
export function isShareContext(c: any): boolean {
  try {
    return c?.get?.(SHARE_CTX_KEY) === true
  } catch {
    return false
  }
}

/** 分享上下文里把错误泛化，其余情况沿用 safeErrorMessage */
export function safeShareAwareMessage(c: any, err: any, fallback?: string): string {
  if (isShareContext(c)) return SHARE_PATH_ERROR
  return safeErrorMessage(err, fallback)
}
