import { Hono } from "hono"
import { authUserFromReq } from "./auth"
import {
  listItems,
  getItem,
  putItem,
  removeItems,
} from "../internal/op/storage"
import { safeErrorMessage } from "../pkg/errs"
import { mimeForName } from "../pkg/mime"
import {
  etagForFileItem,
  evaluateReadPreconditions,
  evaluateWritePreconditions,
  preconditionsFromHeaders,
  parseHttpDate,
} from "../pkg/precondition"

/**
 * S3 网关（简化版，挂载于 /s3/*）。
 *
 * 协议：支持 ListBuckets / GetObject / HeadObject / PutObject / DeleteObject，
 * 认证采用 Bearer token（与全局 token 一致）；完整 AWS SigV4 签名验证作为
 * 后续增强（Worker 环境 S3 网关性能受限，优先保证 API 契约一致）。
 *
 * URL 结构：/s3/{bucket}/{objectKey}，bucket 映射到存储挂载路径。
 */

export const s3Router = new Hono()

function xmlEscape(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function s3Error(code: string, message: string, status: number) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Error><Code>${xmlEscape(code)}</Code><Message>${xmlEscape(message)}</Message></Error>`
  return new Response(xml, {
    status,
    headers: { "Content-Type": "application/xml", "x-amz-request-id": "-" },
  })
}

/** 从 pathname 剥离 /s3 前缀，解析 { bucket, key } */
function parseS3Path(c: any): { bucket: string; key: string } {
  const pathname = new URL(c.req.url).pathname
  const p = pathname.replace(/^\/s3\/?/, "")
  const parts = p.split("/").filter(Boolean)
  const bucket = parts[0] || ""
  const key = parts.slice(1).map(decodeURIComponent).join("/")
  return { bucket, key }
}

/** bucket 名 → 挂载路径（bucket 即存储挂载点的首段） */
function bucketToPath(bucket: string): string {
  if (!bucket) return "/"
  return "/" + bucket
}

async function authUser(c: any): Promise<any | null> {
  const auth = await authUserFromReq(c)
  return auth ? auth.user : null
}

const getCtx = (c: any) => {
  try {
    const ec = c.executionCtx
    return ec && typeof ec.waitUntil === "function"
      ? { waitUntil: (p: Promise<unknown>) => ec.waitUntil(p) }
      : undefined
  } catch {
    return undefined
  }
}

/**
 * 探测对象当前状态，供条件请求与 ETag 使用。
 * 对象不存在的场景（例如 `If-None-Match: *` 创建）对条件判定是合法结果，
 * 因此这里吞掉异常返回 exists:false —— fail-closed，拿不到 ETag 时
 * `If-Match` 一律判定失败，宁返回 412 也不静默覆盖。
 */
async function statObject(
  virtualPath: string,
  ctx: any,
): Promise<{
  exists: boolean
  etag: string | null
  item: any
  lastModifiedMs: number
}> {
  try {
    const { item } = await getItem(virtualPath, ctx)
    if (!item || item.is_dir) {
      return { exists: false, etag: null, item: null, lastModifiedMs: 0 }
    }
    return {
      exists: true,
      etag: etagForFileItem(item),
      item,
      lastModifiedMs: parseHttpDate(item.modified) || 0,
    }
  } catch {
    return { exists: false, etag: null, item: null, lastModifiedMs: 0 }
  }
}

function s3PreconditionFailed(message: string) {
  return s3Error("PreconditionFailed", message, 412)
}

// GET /s3/ → ListBuckets
s3Router.get("/", async (c) => {
  const user = await authUser(c)
  if (!user) return s3Error("AccessDenied", "Authentication required", 403)
  try {
    const res = await listItems("/", getCtx(c))
    const buckets = (res.content || [])
      .filter((it: any) => it.is_dir)
      .map(
        (it: any) =>
          `  <Bucket><Name>${xmlEscape(it.name)}</Name><CreationDate>${xmlEscape(it.modified || new Date().toISOString())}</CreationDate></Bucket>`,
      )
      .join("\n")
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListAllMyBucketsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Owner><ID>openlist</ID><DisplayName>openlist</DisplayName></Owner>
  <Buckets>
${buckets}
  </Buckets>
</ListAllMyBucketsResult>`
    return new Response(xml, {
      status: 200,
      headers: { "Content-Type": "application/xml" },
    })
  } catch (e: any) {
    return s3Error("InternalError", safeErrorMessage(e), 500)
  }
})

// GET /s3/{bucket}/{key} → GetObject
s3Router.get("/*", async (c) => {
  const user = await authUser(c)
  if (!user) return s3Error("AccessDenied", "Authentication required", 403)
  const { bucket, key } = parseS3Path(c)
  if (!bucket || !key) return s3Error("NoSuchKey", "NoSuchKey", 404)
  const virtualPath = `/${bucket}/${key}`
  try {
    const { item, rawUrl } = await getItem(virtualPath, getCtx(c))
    if (!item) return s3Error("NoSuchKey", "NoSuchKey", 404)
    if (item.is_dir) return s3Error("NoSuchKey", "NoSuchKey", 404)

    // 旧实现直接 302，从不返回 ETag，客户端拿不到可比较的版本标识
    // （上游 issue #3067 里「GET / HEAD 的 ETag 均为空」就是这个原因）
    const etag = etagForFileItem(item)
    const lastModifiedMs = parseHttpDate(item.modified) ?? Date.now()
    const validators: Record<string, string> = {
      ETag: etag,
      "Last-Modified": new Date(lastModifiedMs).toUTCString(),
    }

    const { notModified } = evaluateReadPreconditions(preconditionsFromHeaders(c), {
      exists: true,
      etag,
      lastModifiedMs,
    })
    if (notModified) return new Response(null, { status: 304, headers: validators })

    if (rawUrl) {
      // 直接构造 Response：Hono 的 c.redirect() 只接受 (location, status)，
      // 无法同时带上 ETag / Last-Modified
      return new Response(null, {
        status: 302,
        headers: { ...validators, Location: rawUrl },
      })
    }
    return s3Error("NoSuchKey", "NoSuchKey", 404)
  } catch (e: any) {
    return s3Error("NoSuchKey", safeErrorMessage(e), 404)
  }
})

// HEAD /s3/{bucket}/{key} → HeadObject
s3Router.on("HEAD", "/*", async (c) => {
  const user = await authUser(c)
  if (!user) return s3Error("AccessDenied", "Authentication required", 403)
  const { bucket, key } = parseS3Path(c)
  if (!bucket || !key) return s3Error("NoSuchKey", "NoSuchKey", 404)
  try {
    const { item } = await getItem(`/${bucket}/${key}`, getCtx(c))
    if (!item || item.is_dir) return s3Error("NoSuchKey", "NoSuchKey", 404)
    const headers: Record<string, string> = {
      "Content-Length": String(item.size || 0),
      // 旧实现把 FileItem.type（数字枚举：1=FOLDER/2=VIDEO…）当 MIME 输出，
      // 于是响应里出现 `Content-Type: 2` 这种非法值
      "Content-Type": mimeForName(item.name),
      "Last-Modified": new Date(parseHttpDate(item.modified) ?? Date.now()).toUTCString(),
      ETag: etagForFileItem(item),
      "Accept-Ranges": "bytes",
    }
    return new Response(null, { status: 200, headers })
  } catch {
    return s3Error("NoSuchKey", "NoSuchKey", 404)
  }
})

// PUT /s3/{bucket}/{key} → PutObject
s3Router.put("/*", async (c) => {
  const user = await authUser(c)
  if (!user) return s3Error("AccessDenied", "Authentication required", 403)
  const { bucket, key } = parseS3Path(c)
  if (!bucket || !key) return s3Error("InvalidArgument", "Invalid bucket/key", 400)
  const virtualPath = `/${bucket}/${key}`
  try {
    // 条件写入（S3 Conditional Writes / RFC 9110 §13）。
    // 旧实现无条件覆盖，`If-None-Match: *` 与 `If-Match` 全部被忽略，
    // 于是「仅当不存在时写入」的语义在服务端形同虚设。
    const before = await statObject(virtualPath, getCtx(c))
    const pre = evaluateWritePreconditions(preconditionsFromHeaders(c), {
      exists: before.exists,
      etag: before.etag,
      lastModifiedMs: before.lastModifiedMs,
    })
    if (!pre.ok) {
      return s3PreconditionFailed(pre.reason || "Precondition Failed")
    }

    const buffer = Buffer.from(await c.req.arrayBuffer())
    await putItem(virtualPath, buffer, getCtx(c))

    // 回读一次拿真实 size/mtime，使 ETag 与后续 GET/HEAD 完全一致；
    // 旧实现用的是 `Date.now()`，与内容毫无关系，无法用于乐观锁
    const after = await statObject(virtualPath, getCtx(c))
    const etag =
      after.etag ||
      etagForFileItem({ size: buffer.byteLength, modified: new Date().toISOString() })

    return new Response(null, {
      status: 200,
      headers: { ETag: etag },
    })
  } catch (e: any) {
    return s3Error("InternalError", safeErrorMessage(e), 500)
  }
})

// DELETE /s3/{bucket}/{key} → DeleteObject
s3Router.delete("/*", async (c) => {
  const user = await authUser(c)
  if (!user) return s3Error("AccessDenied", "Authentication required", 403)
  const { bucket, key } = parseS3Path(c)
  if (!bucket || !key) return s3Error("InvalidArgument", "Invalid bucket/key", 400)
  const idx = key.lastIndexOf("/")
  const dir = idx >= 0 ? `/${bucket}/${key.slice(0, idx)}` : `/${bucket}`
  const name = idx >= 0 ? key.slice(idx + 1) : key
  try {
    await removeItems(dir, [name], getCtx(c))
    return new Response(null, { status: 204 })
  } catch (e: any) {
    return s3Error("NoSuchKey", safeErrorMessage(e), 404)
  }
})
