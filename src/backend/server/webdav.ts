import { Hono } from "hono"
import { authUserFromReq, getOrInitUsers, verifyUserPassword } from "./auth"
import { can, PermissionBit } from "../pkg/permission"
import {
  listItems,
  getItem,
  putItem,
  makeDirectory,
  removeItems,
  moveItems,
  copyItems,
} from "../internal/op/storage"
import { buildWebDavPropfindResponse } from "../internal/webdav/webdav"
import { mimeForName } from "../pkg/mime"
import {
  etagForFileItem,
  evaluateReadPreconditions,
  evaluateWritePreconditions,
  preconditionsFromHeaders,
  parseHttpDate,
} from "../pkg/precondition"
import { safeErrorMessage } from "../pkg/errs"

/**
 * WebDAV 协议服务（挂载于 /dav/*）。
 *
 * 认证：Basic Auth（用户名/密码）或 Bearer token（全局 token）。
 * 权限：WEBDAV_READ（读/列目录）与 WEBDAV_MANAGE（写/删/移动/复制）按位校验。
 * 支持方法：OPTIONS / PROPFIND / GET / HEAD / PUT / MKCOL / DELETE / MOVE / COPY。
 */

export const webdavRouter = new Hono()

const getStorageRequestContext = (c: any) => {
  try {
    const executionCtx = c.executionCtx
    if (!executionCtx || typeof executionCtx.waitUntil !== "function") {
      return undefined
    }
    return { 
      waitUntil: (p: Promise<unknown>) => executionCtx.waitUntil(p),
      env: c.env, // 传递 env 用于请求级 KV 缓存复用
    }
  } catch {
    return undefined
  }
}

/** Basic Auth 或 Bearer token 认证，返回用户对象（未认证返回 null） */
async function webdavAuth(c: any): Promise<any> {
  const authHeader = c.req.header("Authorization") || ""
  if (authHeader.startsWith("Basic ")) {
    try {
      const decoded = atob(authHeader.substring(6).trim())
      const idx = decoded.indexOf(":")
      if (idx < 0) return null
      const username = decoded.substring(0, idx)
      const password = decoded.substring(idx + 1)
      const { users } = await getOrInitUsers(c.env)
      const user = users.find((u: any) => u.username === username && !u.disabled)
      if (!user) return null
      // 空密码用户（guest）：Basic Auth 下若未提供密码则允许（与 AList 一致）
      if (!user.password) {
        return password === "" ? user : null
      }
      if (await verifyUserPassword(user, password)) return user
      return null
    } catch {
      return null
    }
  }
  if (authHeader.startsWith("Bearer ")) {
    const auth = await authUserFromReq(c)
    return auth ? auth.user : null
  }
  return null
}

/** 从 URL pathname 中剥离 /dav 前缀，得到虚拟文件路径 */
function davPathOf(c: any): string {
  const pathname = new URL(c.req.url).pathname
  let p = pathname.replace(/^\/dav/, "")
  if (!p) p = "/"
  try {
    return decodeURIComponent(p)
  } catch {
    return p
  }
}

/** 拆分虚拟路径为 { dir, name } */
function splitPath(p: string): { dir: string; name: string } {
  const clean = p.startsWith("/") ? p : "/" + p
  const parts = clean.split("/").filter(Boolean)
  const name = parts.pop() || ""
  const dir = "/" + parts.join("/")
  return { dir, name }
}

/**
 * 探测目标资源当前状态，供条件请求使用。
 *
 * 找不到资源时驱动通常直接抛错，而「不存在」对条件判定来说是一个合法结果
 * （例如 `If-None-Match: *` 创建新文件），所以这里吞掉异常并返回
 * `exists: false`——这也是 fail-closed：拿不到当前 ETag 时 `If-Match` 必然
 * 判定失败，宁可返回 412 也不静默覆盖。
 */
async function statItem(
  davPath: string,
  ctx: any,
): Promise<{
  exists: boolean
  isDir: boolean
  etag: string | null
  item: any
  lastModifiedMs: number
}> {
  const missing = {
    exists: false,
    isDir: false,
    etag: null,
    item: null,
    lastModifiedMs: 0,
  }
  try {
    const { item } = await getItem(davPath, ctx)
    if (!item) return missing
    return {
      exists: true,
      isDir: !!item.is_dir,
      // 集合不参与文件级 ETag 比较，但仍要如实报告「存在」
      etag: item.is_dir ? null : etagForFileItem(item),
      item,
      lastModifiedMs: parseHttpDate(item.modified) || 0,
    }
  } catch {
    return missing
  }
}

/** 资源不存在 / 预条件失败时的 WebDAV 错误响应 */
function davPreconditionFailed(c: any, reason: string) {
  // RFC 9110 §15.5.13：412 可以带正文说明，但 WebDAV 客户端只看状态码
  return c.text(reason || "Precondition Failed", 412)
}

webdavRouter.all("/*", async (c) => {
  const user = await webdavAuth(c)
  if (!user) {
    return c.text("Unauthorized", 401, {
      "WWW-Authenticate": 'Basic realm="OpenList"',
    })
  }
  const canRead = can(user, PermissionBit.WEBDAV_READ)
  const canManage = can(user, PermissionBit.WEBDAV_MANAGE)
  if (!canRead && !canManage) {
    return c.text("Forbidden", 403)
  }

  const method = c.req.method.toUpperCase()
  const davPath = davPathOf(c)
  const ctx = getStorageRequestContext(c)

  try {
    switch (method) {
      case "OPTIONS": {
        c.header("DAV", "1, 2")
        c.header("Allow", "OPTIONS, PROPFIND, GET, HEAD, PUT, MKCOL, DELETE, MOVE, COPY")
        c.header("MS-Author-Via", "DAV")
        return c.body(null, 200)
      }

      case "PROPFIND": {
        if (!canRead) return c.text("Forbidden", 403)
        const depthHeader = (c.req.header("Depth") || "1").trim().toLowerCase()
        // RFC 4918 §9.1：Depth 只能是 0、1 或 infinity；缺省视为 infinity，
        // 但这里按 1 处理（绝大多数客户端只发 0/1，无限递归对云盘驱动代价过高）
        const depth = depthHeader === "0" ? "0" : "1"

        const selfStat = await statItem(davPath, ctx)
        const href = davPath === "/" ? "/" : davPath.endsWith("/") ? davPath : davPath + "/"

        let items: any[] = []
        if (depth !== "0") {
          try {
            const res = await listItems(davPath, ctx)
            items = (res.content || []).map((it: any) => ({
              name: it.name,
              size: it.size || 0,
              isFolder: !!it.is_dir,
              modified: it.modified || new Date(0).toISOString(),
              etag: it.is_dir ? undefined : etagForFileItem(it),
              contentType: it.is_dir ? undefined : mimeForName(it.name),
            }))
          } catch (e: any) {
            // 目录列不出来通常意味着路径不存在
            const msg = safeErrorMessage(e)
            if (/not found|not a (dir|folder)|storage not found/i.test(msg)) {
              return c.text("Not Found", 404)
            }
            throw e
          }
        }

        const xml = buildWebDavPropfindResponse(href, items, {
          modified: selfStat.item?.modified,
          etag: selfStat.etag || undefined,
        })
        return c.body(xml, 207, {
          "Content-Type": "application/xml; charset=utf-8",
        })
      }

      case "GET":
      case "HEAD": {
        if (!canRead) return c.text("Forbidden", 403)
        const { item, rawUrl } = await getItem(davPath, ctx)
        if (!item) return c.text("Not found", 404)
        if (item.is_dir) return c.text("Is a directory", 400)

        const etag = etagForFileItem(item)
        const lastModified =
          parseHttpDate(item.modified) ?? Date.now()
        const validators = {
          ETag: etag,
          "Last-Modified": new Date(lastModified).toUTCString(),
        }

        // 条件 GET：命中 If-None-Match 直接 304，省掉一次真实下载
        const { notModified } = evaluateReadPreconditions(
          preconditionsFromHeaders(c),
          { exists: true, etag, lastModifiedMs: lastModified },
        )
        if (notModified) {
          return c.body(null, 304, validators)
        }

        if (method === "HEAD") {
          // HEAD 不再 302：客户端需要看到真实的大小/类型/ETag 才能做条件请求
          return c.body(null, 200, {
            ...validators,
            "Content-Length": String(item.size || 0),
            "Content-Type": mimeForName(item.name),
            "Accept-Ranges": "bytes",
          })
        }

        // GET 仍走 rawRouter（/api/p/*）完成实际传输，但把校验头带上，
        // 便于中间缓存与客户端复用。这里直接构造 Response：Hono 的
        // c.redirect() 只接受 (location, status)，塞不下额外响应头。
        return new Response(null, {
          status: 302,
          headers: {
            ...validators,
            "Cache-Control": "no-cache",
            Location:
              rawUrl || `/api/p${davPath.startsWith("/") ? "" : "/"}${davPath}`,
          },
        })
      }

      case "PUT": {
        if (!canManage) return c.text("Forbidden", 403)

        // RFC 9110 §13：先判定预条件，再落盘。旧实现无条件覆盖，
        // 导致 If-Match / If-None-Match 全部被忽略（上游 issue #3065）
        const before = await statItem(davPath, ctx)
        const pre = evaluateWritePreconditions(preconditionsFromHeaders(c), {
          exists: before.exists,
          etag: before.etag,
          lastModifiedMs: before.lastModifiedMs,
        })
        if (!pre.ok) {
          return davPreconditionFailed(c, pre.reason || "Precondition Failed")
        }

        const buffer = Buffer.from(await c.req.arrayBuffer())
        await putItem(davPath, buffer, ctx)

        // RFC 4918 §9.7.1：新建返回 201，覆盖已有资源返回 204
        const created = !before.exists

        // 回读一次拿到新的大小/修改时间，保证 ETag 与后续 GET/PROPFIND 一致
        const after = await statItem(davPath, ctx)
        const etag =
          after.etag ||
          etagForFileItem({ size: buffer.byteLength, modified: new Date().toISOString() })

        return c.body(null, created ? 201 : 204, { ETag: etag })
      }

      case "MKCOL": {
        if (!canManage) return c.text("Forbidden", 403)
        // RFC 4918 §9.3.1：目标已存在时返回 405，而不是静默成功
        const exists = await statItem(davPath, ctx)
        if (exists.exists) return c.text("Method Not Allowed", 405)
        try {
          await makeDirectory(davPath, ctx)
        } catch (e: any) {
          const msg = safeErrorMessage(e)
          // 部分驱动在目录已存在时抛错；此时按 405 处理
          if (/already exists/i.test(msg)) return c.text("Method Not Allowed", 405)
          throw e
        }
        return c.body(null, 201)
      }

      case "DELETE": {
        if (!canManage) return c.text("Forbidden", 403)
        const { dir, name } = splitPath(davPath)
        if (!name) return c.text("Forbidden", 403)
        try {
          await removeItems(dir, [name], ctx)
        } catch (e: any) {
          // 目标不存在时如实返回 404，而不是像旧实现那样一律 204
          const msg = safeErrorMessage(e)
          if (/not found|storage not found/i.test(msg)) {
            return c.text("Not Found", 404)
          }
          throw e
        }
        return c.body(null, 204)
      }

      case "MOVE": {
        if (!canManage) return c.text("Forbidden", 403)
        const destRaw = c.req.header("Destination") || ""
        let dest = destRaw
        try {
          dest = decodeURIComponent(new URL(destRaw, c.req.url).pathname).replace(/^\/dav/, "")
        } catch {}
        const src = splitPath(davPath)
        const dst = splitPath(dest)
        await moveItems(src.dir, dst.dir, [src.name], ctx)
        return c.body(null, 201)
      }

      case "COPY": {
        if (!canManage) return c.text("Forbidden", 403)
        const destRaw = c.req.header("Destination") || ""
        let dest = destRaw
        try {
          dest = decodeURIComponent(new URL(destRaw, c.req.url).pathname).replace(/^\/dav/, "")
        } catch {}
        const src = splitPath(davPath)
        const dst = splitPath(dest)
        await copyItems(src.dir, dst.dir, [src.name], ctx)
        return c.body(null, 201)
      }

      case "LOCK":
      case "UNLOCK":
        // 简化实现：声明不支持锁，客户端通常可继续无锁操作
        return c.text("Locking not supported", 405)

      default:
        return c.text("Method Not Allowed", 405)
    }
  } catch (e: any) {
    const msg = safeErrorMessage(e)
    if (msg.includes("not found") || msg.includes("storage not found")) {
      return c.text("Not Found", 404)
    }
    return c.text(msg, 500)
  }
})
