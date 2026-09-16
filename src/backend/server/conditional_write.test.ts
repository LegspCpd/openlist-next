import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import { Hono } from "hono"

import { saveDb } from "../internal/model/db"
import { webdavRouter } from "./webdav"
import { s3Router } from "./s3"

/**
 * 路由级的条件写入验证，对应上游 issue：
 *   - #3065 WebDAV 服务器不兼容 RFC 9110（ETag / Preconditions）
 *   - #3067 S3 服务器不兼容 RFC 9110（Preconditions）
 *
 * 用一个真实的 local 存储（临时目录）跑真实驱动，端到端确认：
 *   1. ETag 会被返回，且内容变化后会变；
 *   2. 写请求会真的执行预条件判定，而不是无条件覆盖；
 *   3. 覆盖返回 204 / 新建返回 201。
 */

const TOKEN = "ROUTETEST_TOKEN"
const ADMIN = { id: 1, username: "root", password: "", role: 2, permission: 0, base_path: "/", disabled: false }

let tmpRoot = ""
let env: any = {}

const basicAuth = "Basic " + Buffer.from("root:").toString("base64")

async function setup() {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openlist-cond-"))
  env = {}
  await saveDb(
    {
      settings: [{ key: "token", value: TOKEN }],
      users: [ADMIN],
      storages: [
        {
          id: 1,
          mount_path: "/x",
          driver: "local",
          disabled: false,
          modified: "t1",
          addition: JSON.stringify({ root_folder_path: tmpRoot }),
        },
      ],
      shares: [],
    },
    env,
  )
}

const davApp = () => {
  const app = new Hono()
  app.route("/dav", webdavRouter)
  return app
}

const s3App = () => {
  const app = new Hono()
  app.route("/s3", s3Router)
  return app
}

const dav = (method: string, p: string, init: RequestInit = {}) =>
  davApp().request(`/dav${p}`, {
    method,
    headers: { Authorization: basicAuth, ...(init.headers as any) },
    ...init,
  })

const s3 = (method: string, p: string, init: RequestInit = {}) =>
  s3App().request(`/s3${p}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(init.headers as any) },
    ...init,
  })

// ---------------------------------------------------------------------------
// WebDAV
// ---------------------------------------------------------------------------

test("#3065 WebDAV: PUT 新建返回 201 并回传 ETag", async () => {
  await setup()
  const res = await dav("PUT", "/x/a.txt", { body: "hello" })
  assert.equal(res.status, 201)
  const etag = res.headers.get("ETag")
  assert.ok(etag, "PUT 必须返回 ETag")
  assert.notEqual(etag, '""')

  assert.equal(await fs.readFile(path.join(tmpRoot, "a.txt"), "utf8"), "hello")
})

test("#3065 WebDAV: PUT 覆盖已有文件返回 204（旧实现一律 201）", async () => {
  await setup()
  await dav("PUT", "/x/a.txt", { body: "v1" })
  const res = await dav("PUT", "/x/a.txt", { body: "v2" })
  assert.equal(res.status, 204)
})

test("#3065 WebDAV: 内容变化后 ETag 必须变化", async () => {
  await setup()
  const first = await dav("PUT", "/x/a.txt", { body: "v1" })
  const second = await dav("PUT", "/x/a.txt", { body: "v2-longer" })
  assert.notEqual(
    first.headers.get("ETag"),
    second.headers.get("ETag"),
    "强 ETag 相同意味着表示逐字节相同，内容变了就必须换",
  )
})

test("#3065 WebDAV: 已存在文件携带 If-None-Match: * 必须 412（旧实现会覆盖）", async () => {
  await setup()
  await dav("PUT", "/x/a.txt", { body: "original" })

  const res = await dav("PUT", "/x/a.txt", {
    body: "attacker",
    headers: { "If-None-Match": "*" },
  })
  assert.equal(res.status, 412)
  assert.equal(
    await fs.readFile(path.join(tmpRoot, "a.txt"), "utf8"),
    "original",
    "预条件失败时不得落盘",
  )
})

test("#3065 WebDAV: 不存在的文件携带 If-None-Match: * 应当创建成功", async () => {
  await setup()
  const res = await dav("PUT", "/x/new.txt", {
    body: "fresh",
    headers: { "If-None-Match": "*" },
  })
  assert.equal(res.status, 201)
})

test("#3065 WebDAV: If-Match 携带过期 ETag 必须 412（乐观锁）", async () => {
  await setup()
  const first = await dav("PUT", "/x/a.txt", { body: "v1" })
  const staleEtag = first.headers.get("ETag")!

  await dav("PUT", "/x/a.txt", { body: "v2" }) // 别人先改了

  const res = await dav("PUT", "/x/a.txt", {
    body: "v3",
    headers: { "If-Match": staleEtag },
  })
  assert.equal(res.status, 412, "旧版本号不能覆盖新版本")
  assert.equal(await fs.readFile(path.join(tmpRoot, "a.txt"), "utf8"), "v2")
})

test("#3065 WebDAV: If-Match 携带当前 ETag 允许更新", async () => {
  await setup()
  const first = await dav("PUT", "/x/a.txt", { body: "v1" })
  const res = await dav("PUT", "/x/a.txt", {
    body: "v2",
    headers: { "If-Match": first.headers.get("ETag")! },
  })
  assert.equal(res.status, 204)
})

test("#3065 WebDAV: 对不存在的资源用 If-Match 必须 412（旧实现会创建成功）", async () => {
  await setup()
  const res = await dav("PUT", "/x/ghost.txt", {
    body: "x",
    headers: { "If-Match": '"whatever"' },
  })
  assert.equal(res.status, 412)
})

test("#3065 WebDAV: PROPFIND 必须输出 getetag，且与 PUT 返回的一致", async () => {
  await setup()
  const put = await dav("PUT", "/x/a.txt", { body: "hello" })
  const etag = put.headers.get("ETag")!

  const res = await dav("PROPFIND", "/x", { headers: { Depth: "1" } })
  assert.equal(res.status, 207)
  const xml = await res.text()
  assert.match(xml, /<d:getetag>/, "PROPFIND 必须带 getetag，否则客户端无法做条件请求")
  assert.ok(
    xml.includes(etag.replace(/"/g, "")) || xml.includes(etag),
    `PROPFIND 里的 ETag 应与 PUT 返回的一致\nxml=${xml}`,
  )
})

test("#3065 WebDAV: PROPFIND Depth: 0 只返回集合自身", async () => {
  await setup()
  await dav("PUT", "/x/a.txt", { body: "hello" })
  await dav("PUT", "/x/b.txt", { body: "world" })

  const res = await dav("PROPFIND", "/x", { headers: { Depth: "0" } })
  const xml = await res.text()
  assert.equal(
    (xml.match(/<d:response>/g) || []).length,
    1,
    "Depth: 0 不应列出子项",
  )
})

test("#3065 WebDAV: HEAD 返回 ETag 与真实大小，GET 命中 If-None-Match 返回 304", async () => {
  await setup()
  await dav("PUT", "/x/a.txt", { body: "hello" })

  const head = await dav("HEAD", "/x/a.txt")
  assert.equal(head.status, 200)
  const etag = head.headers.get("ETag")
  assert.ok(etag, "HEAD 必须返回 ETag")
  assert.equal(head.headers.get("Content-Length"), "5")
  assert.match(head.headers.get("Content-Type") || "", /^text\/plain/)

  const notModified = await dav("GET", "/x/a.txt", {
    headers: { "If-None-Match": etag! },
  })
  assert.equal(notModified.status, 304)

  const changed = await dav("GET", "/x/a.txt", {
    headers: { "If-None-Match": '"stale"' },
  })
  assert.equal(changed.status, 302, "ETag 不匹配时应照常重定向到下载端点")
})

test("#3065 WebDAV: DELETE 不存在的资源返回 404（旧实现一律 204）", async () => {
  await setup()
  const res = await dav("DELETE", "/x/ghost.txt")
  assert.equal(res.status, 404)
})

test("#3065 WebDAV: MKCOL 对已存在的目录返回 405", async () => {
  await setup()
  const first = await dav("MKCOL", "/x/dir")
  assert.equal(first.status, 201)
  const second = await dav("MKCOL", "/x/dir")
  assert.equal(second.status, 405)
})

// ---------------------------------------------------------------------------
// S3
// ---------------------------------------------------------------------------

test("#3067 S3: PutObject 回传与内容相关的 ETag", async () => {
  await setup()
  const first = await s3("PUT", "/x/a.txt", { body: "v1" })
  assert.equal(first.status, 200)
  const etag1 = first.headers.get("ETag")
  assert.ok(etag1)

  const second = await s3("PUT", "/x/a.txt", { body: "v2-longer" })
  const etag2 = second.headers.get("ETag")
  assert.notEqual(etag1, etag2, "旧实现用 Date.now() 当 ETag，与内容无关")
})

test("#3067 S3: HeadObject 返回 ETag 与真实 MIME（旧实现返回数字 type）", async () => {
  await setup()
  await s3("PUT", "/x/clip.mp4", { body: "not-really-a-video" })

  const res = await s3("HEAD", "/x/clip.mp4")
  assert.equal(res.status, 200)
  assert.ok(res.headers.get("ETag"), "HEAD 必须返回 ETag")
  assert.equal(
    res.headers.get("Content-Type"),
    "video/mp4",
    "Content-Type 必须是 MIME，不能是 FileItem.type 数字枚举",
  )
})

test("#3067 S3: 已存在对象携带 If-None-Match: * 必须 412", async () => {
  await setup()
  await s3("PUT", "/x/a.txt", { body: "original" })

  const res = await s3("PUT", "/x/a.txt", {
    body: "overwrite",
    headers: { "If-None-Match": "*" },
  })
  assert.equal(res.status, 412)
  assert.match(await res.text(), /PreconditionFailed/)
  assert.equal(await fs.readFile(path.join(tmpRoot, "a.txt"), "utf8"), "original")
})

test("#3067 S3: If-Match 携带错误 ETag 必须 412", async () => {
  await setup()
  await s3("PUT", "/x/a.txt", { body: "v1" })
  const res = await s3("PUT", "/x/a.txt", {
    body: "v2",
    headers: { "If-Match": '"deadbeef"' },
  })
  assert.equal(res.status, 412)
  assert.equal(await fs.readFile(path.join(tmpRoot, "a.txt"), "utf8"), "v1")
})

test("#3067 S3: GetObject 命中 If-None-Match 返回 304", async () => {
  await setup()
  const put = await s3("PUT", "/x/a.txt", { body: "v1" })
  const etag = put.headers.get("ETag")!

  const res = await s3("GET", "/x/a.txt", { headers: { "If-None-Match": etag } })
  assert.equal(res.status, 304)
})

test("#3067 S3: GetObject 未命中时应带上 ETag 后重定向", async () => {
  await setup()
  const put = await s3("PUT", "/x/a.txt", { body: "v1" })
  const res = await s3("GET", "/x/a.txt", {
    headers: { "If-None-Match": '"stale"' },
  })
  assert.equal(res.status, 302)
  assert.equal(res.headers.get("ETag"), put.headers.get("ETag"))
})
