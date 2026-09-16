import assert from "node:assert/strict"
import { test } from "node:test"

import {
  etagForFileItem,
  evaluateReadPreconditions,
  evaluateWritePreconditions,
  parseHttpDate,
} from "./precondition"

/**
 * 这些用例直接对应上游两个 issue 的验收表：
 *   - #3065 WebDAV 服务器不兼容 RFC 9110（ETag / Preconditions）
 *   - #3067 S3 服务器不兼容 RFC 9110（Preconditions）
 * 两边的期望行为一致，所以共用同一套判定逻辑。
 */

// ---------------------------------------------------------------------------
// ETag 派生
// ---------------------------------------------------------------------------

test("RFC9110: 驱动能给出内容哈希时优先用哈希做 ETag", () => {
  const etag = etagForFileItem({
    name: "a.bin",
    size: 10,
    modified: "2026-01-01T00:00:00.000Z",
    hashes: { md5: "D41D8CD98F00B204E9800998ECF8427E" },
  })
  // 统一小写，避免大小写差异导致同一文件算出两个 ETag
  assert.equal(etag, '"d41d8cd98f00b204e9800998ecf8427e"')
})

test("RFC9110: 没有哈希时退化为 size + mtime", () => {
  const item = { name: "a.bin", size: 10, modified: "2026-01-01T00:00:00.000Z" }
  const first = etagForFileItem(item)
  const second = etagForFileItem({ ...item })
  assert.equal(first, second, "相同元数据必须得到相同 ETag")
  assert.match(first, /^"[0-9a-f]+-[0-9a-f]+"$/)
})

test("RFC9110: 内容变更后 ETag 必须变化（issue #3065 核心诉求）", () => {
  const base = { name: "a.bin", size: 10, modified: "2026-01-01T00:00:00.000Z" }
  const sameContent = etagForFileItem(base)
  const sizeChanged = etagForFileItem({ ...base, size: 11 })
  const mtimeChanged = etagForFileItem({
    ...base,
    modified: "2026-01-02T00:00:00.000Z",
  })

  assert.notEqual(sameContent, sizeChanged, "大小变化必须换 ETag")
  assert.notEqual(sameContent, mtimeChanged, "修改时间变化必须换 ETag")
})

test("RFC9110: 缺时间戳时 ETag 仍然确定（不能每次请求都变）", () => {
  const a = etagForFileItem({ name: "x", size: 0, modified: "" })
  const b = etagForFileItem({ name: "x", size: 0, modified: "" })
  assert.equal(a, b)
})

test("RFC9110: parseHttpDate 解析三种 HTTP-date 格式", () => {
  const imf = parseHttpDate("Sun, 06 Nov 1994 08:49:37 GMT")
  assert.equal(imf, Date.UTC(1994, 10, 6, 8, 49, 37))
  assert.equal(parseHttpDate("not a date"), null)
  assert.equal(parseHttpDate(null), null)
})

// ---------------------------------------------------------------------------
// 写预条件（对应 issue 表格里「实际行为」那一列的反面）
// ---------------------------------------------------------------------------

const CURRENT = '"a1b2c3"'

test("RFC9110/#3065: 新建对象携带 If-None-Match: * 必须允许", () => {
  const res = evaluateWritePreconditions(
    { ifNoneMatch: "*" },
    { exists: false, etag: null },
  )
  assert.equal(res.ok, true)
})

test("RFC9110/#3065: 已存在对象携带 If-None-Match: * 必须 412（旧实现会覆盖）", () => {
  const res = evaluateWritePreconditions(
    { ifNoneMatch: "*" },
    { exists: true, etag: CURRENT },
  )
  assert.equal(res.ok, false)
  assert.equal(res.status, 412)
})

test("RFC9110/#3065: If-Match 携带当前 ETag 允许更新", () => {
  const res = evaluateWritePreconditions(
    { ifMatch: CURRENT },
    { exists: true, etag: CURRENT },
  )
  assert.equal(res.ok, true)
})

test("RFC9110/#3065: If-Match 携带错误 ETag 必须 412（旧实现会覆盖）", () => {
  const res = evaluateWritePreconditions(
    { ifMatch: '"deadbeef"' },
    { exists: true, etag: CURRENT },
  )
  assert.equal(res.ok, false)
  assert.equal(res.status, 412)
})

test("RFC9110/#3065: 更新后用旧 ETag 再写必须 412（乐观锁）", () => {
  const stale = '"oldold"'
  const updated = '"newnew"'
  // 携带旧 ETag 去写已经变过版本的对象
  const res = evaluateWritePreconditions(
    { ifMatch: stale },
    { exists: true, etag: updated },
  )
  assert.equal(res.ok, false)
  assert.equal(res.status, 412)
})

test("RFC9110/#3065: 对不存在的对象用 If-Match 必须 412（旧实现会创建成功）", () => {
  const res = evaluateWritePreconditions(
    { ifMatch: CURRENT },
    { exists: false, etag: null },
  )
  assert.equal(res.ok, false)
  assert.equal(res.status, 412)
})

test("RFC9110/#3065: If-None-Match 命中当前 ETag 必须 412", () => {
  const res = evaluateWritePreconditions(
    { ifNoneMatch: CURRENT },
    { exists: true, etag: CURRENT },
  )
  assert.equal(res.ok, false)
  assert.equal(res.status, 412)
})

test("RFC9110/#3065: If-None-Match 携带不同 ETag 时允许覆盖", () => {
  const res = evaluateWritePreconditions(
    { ifNoneMatch: '"other"' },
    { exists: true, etag: CURRENT },
  )
  assert.equal(res.ok, true)
})

test("RFC9110: 不带任何预条件头时行为不变（向后兼容）", () => {
  assert.equal(
    evaluateWritePreconditions({}, { exists: true, etag: CURRENT }).ok,
    true,
  )
  assert.equal(
    evaluateWritePreconditions({}, { exists: false, etag: null }).ok,
    true,
  )
})

test("RFC9110: If-Match: * 只要求资源存在", () => {
  assert.equal(
    evaluateWritePreconditions({ ifMatch: "*" }, { exists: true, etag: CURRENT }).ok,
    true,
  )
  assert.equal(
    evaluateWritePreconditions({ ifMatch: "*" }, { exists: false, etag: null }).ok,
    false,
  )
})

test("RFC9110: If-Unmodified-Since 早于修改时间必须 412", () => {
  const mtime = Date.UTC(2026, 0, 2, 0, 0, 0)
  const tooOld = new Date(Date.UTC(2026, 0, 1, 0, 0, 0)).toUTCString()
  const fresh = new Date(Date.UTC(2026, 0, 3, 0, 0, 0)).toUTCString()

  assert.equal(
    evaluateWritePreconditions(
      { ifUnmodifiedSince: tooOld },
      { exists: true, etag: CURRENT, lastModifiedMs: mtime },
    ).ok,
    false,
  )
  assert.equal(
    evaluateWritePreconditions(
      { ifUnmodifiedSince: fresh },
      { exists: true, etag: CURRENT, lastModifiedMs: mtime },
    ).ok,
    true,
  )
})

test("RFC9110: 客户端回传弱 ETag / 不带引号时仍应匹配（互操作性）", () => {
  // Windows 资源管理器与部分 rclone 版本会原样回传服务端给的标签，
  // 但也有客户端会加上 W/ 前缀或去掉引号，这里做容错比较。
  assert.equal(
    evaluateWritePreconditions(
      { ifMatch: 'W/"a1b2c3"' },
      { exists: true, etag: CURRENT },
    ).ok,
    true,
  )
  assert.equal(
    evaluateWritePreconditions(
      { ifMatch: "a1b2c3" },
      { exists: true, etag: CURRENT },
    ).ok,
    true,
  )
})

test("RFC9110: 逗号分隔的 ETag 列表按任意一个命中算匹配", () => {
  assert.equal(
    evaluateWritePreconditions(
      { ifMatch: '"x", "a1b2c3", "y"' },
      { exists: true, etag: CURRENT },
    ).ok,
    true,
  )
})

// ---------------------------------------------------------------------------
// 读预条件（304）
// ---------------------------------------------------------------------------

test("RFC9110: GET 命中 If-None-Match 时应返回 304", () => {
  assert.equal(
    evaluateReadPreconditions(
      { ifNoneMatch: CURRENT },
      { exists: true, etag: CURRENT },
    ).notModified,
    true,
  )
  assert.equal(
    evaluateReadPreconditions(
      { ifNoneMatch: '"other"' },
      { exists: true, etag: CURRENT },
    ).notModified,
    false,
  )
  assert.equal(
    evaluateReadPreconditions({}, { exists: true, etag: CURRENT }).notModified,
    false,
  )
  // 资源不存在时不存在「未修改」的说法
  assert.equal(
    evaluateReadPreconditions(
      { ifNoneMatch: "*" },
      { exists: false, etag: null },
    ).notModified,
    false,
  )
})

test("RFC9110: GET 的 If-None-Match: * 在资源存在时应返回 304", () => {
  assert.equal(
    evaluateReadPreconditions(
      { ifNoneMatch: "*" },
      { exists: true, etag: CURRENT },
    ).notModified,
    true,
  )
})
