import assert from "node:assert/strict"
import { test } from "node:test"

import { getDb, saveDb } from "../model/db"
import { resetShareAccessCache, resolveShare } from "./share"

/**
 * 「最大访问次数」语义（上游 issue #2143）。
 *
 * 上游表现：max_accessed=3 时第 3 次访问就失效；max_accessed=1 时**第 1 次**
 * 访问就失效。根因是计数器按「请求」而不是按「访问者」自增——一次翻页会打
 * /fs/get + /fs/list，点开文件还会走下载端点，计数器一次访问涨好几点。
 *
 * 这里的期望语义：max=N 表示最多被 N 个访问者打开，同一访问者在窗口期内
 * 可以持续浏览（不会被自己的计数拦掉）。
 */

let seq = 0
/**
 * 去重缓存是模块级的（与上游一致，进程内记账），用例之间要清空，
 * 否则上一个用例里的「10.0.0.1 访问过 abc」会让下一个用例的首个请求不再计数。
 */
const freshEnv = () => {
  resetShareAccessCache()
  return { __testId: ++seq }
}

const seed = (
  env: any,
  opts: { maxAccessed?: number; accessed?: number; pwd?: string; files?: string[] } = {},
) =>
  saveDb(
    {
      settings: [],
      users: [],
      storages: [],
      shares: [
        {
          id: "abc",
          files: opts.files || ["/data/secret.txt"],
          pwd: opts.pwd || "",
          disabled: false,
          expires: null,
          max_accessed: opts.maxAccessed ?? 0,
          accessed: opts.accessed ?? 0,
        },
      ],
    },
    env,
  )

const readAccessed = async (env: any) =>
  (await getDb(env)).shares.find((s: any) => s.id === "abc") as any

/** 只取数值快照：readAccessed 返回的是活引用，会被后续计数就地改写 */
const accessedCount = async (env: any) => Number((await readAccessed(env)).accessed)

test("#2143: max_accessed=1 时第一次访问必须成功（旧实现第一次就失效）", async () => {
  const env = freshEnv()
  await seed(env, { maxAccessed: 1 })

  const r = await resolveShare("/@s/abc", "", "10.0.0.1", env)
  assert.equal(r.ok, true, "第一个访问者必须能看到内容")
  assert.equal(r.realPath, "/data/secret.txt")
})

test("#2143: 同一次访问打多个接口只算一次", async () => {
  const env = freshEnv()
  await seed(env, { maxAccessed: 1 })

  // 模拟一次真实翻页：拿元信息 → 列目录 → 点开文件下载（串行）
  for (let i = 0; i < 3; i++) {
    const r = await resolveShare("/@s/abc", "", "10.0.0.1", env)
    assert.equal(r.ok, true, "同一访问者不应被自己的计数拦掉")
  }

  assert.equal(
    await accessedCount(env),
    1,
    "3 次接口调用只能把计数加到 1",
  )
})

test("#2143: 同一访问者并发请求也不能被自己的计数拦掉", async () => {
  const env = freshEnv()
  await seed(env, { maxAccessed: 1 })

  // 前端进入分享页时会并行发出 /fs/get 与 /fs/list，这两个请求必须都成功，
  // 否则 max_accessed=1 的分享对第一个访问者就是坏页面。
  const results = await Promise.all([
    resolveShare("/@s/abc", "", "10.0.0.1", env),
    resolveShare("/@s/abc", "", "10.0.0.1", env),
  ])

  for (const r of results) {
    assert.equal(r.ok, true, `并发的同访问者请求都必须成功：${r.error || ""}`)
  }
  assert.equal(await accessedCount(env), 1, "并发也只计一次")
})

test("#2143: max_accessed=3 时第 3 个访问者仍然可用，第 4 个才被拦", async () => {
  const env = freshEnv()
  await seed(env, { maxAccessed: 3 })

  for (const ip of ["10.0.0.1", "10.0.0.2", "10.0.0.3"]) {
    const r = await resolveShare("/@s/abc", "", ip, env)
    assert.equal(r.ok, true, `${ip} 应当是有效的第 N 次访问`)
  }

  const r4 = await resolveShare("/@s/abc", "", "10.0.0.4", env)
  assert.equal(r4.ok, false)
  assert.equal(r4.error, "share access count exceeded")

  assert.equal(await accessedCount(env), 3)
})

test("#2143: max_accessed=0 表示不限制", async () => {
  const env = freshEnv()
  await seed(env, { maxAccessed: 0 })

  for (let i = 1; i <= 20; i++) {
    const r = await resolveShare("/@s/abc", "", `10.0.1.${i}`, env)
    assert.equal(r.ok, true)
  }
  assert.equal(await accessedCount(env), 20)
})

test("#2143: 口令错误不应消耗访问次数", async () => {
  const env = freshEnv()
  await seed(env, { maxAccessed: 1, pwd: "s3cret" })

  const bad = await resolveShare("/@s/abc", "wrong", "10.0.0.1", env)
  assert.equal(bad.ok, false)
  assert.equal(bad.error, "wrong password")

  assert.equal(
    await accessedCount(env),
    0,
    "口令错误不能占用配额（否则可被恶意刷掉）",
  )

  const good = await resolveShare("/@s/abc", "s3cret", "10.0.0.1", env)
  assert.equal(good.ok, true, "正确口令的首次访问必须仍然可用")
  assert.equal(await accessedCount(env), 1)
})

test("#2143: 计数器里不会留下访问者标识（去重状态只在内存里）", async () => {
  const env = freshEnv()
  await seed(env)
  await resolveShare("/@s/abc", "", "203.0.113.77", env)

  const share = await readAccessed(env)
  assert.equal(share.accessed, 1)
  assert.equal(
    JSON.stringify(share).includes("203.0.113.77"),
    false,
    "访问者标识不能落库（分享记录里不该出现 IP，也不该多出额外字段）",
  )
  assert.deepEqual(
    Object.keys(share).filter((k) => k.startsWith("accessed")),
    ["accessed"],
    "分享记录里只该有 accessed 这一个计数字段",
  )
})

test("#2143: 同一访问者在窗口内只计一次，换一个访问者才继续计数", async () => {
  const env = freshEnv()
  await seed(env)

  await resolveShare("/@s/abc", "", "10.0.0.1", env)
  await resolveShare("/@s/abc", "", "10.0.0.1", env)
  await resolveShare("/@s/abc", "", "10.0.0.2", env)
  await resolveShare("/@s/abc", "", "10.0.0.1", env)

  const share = await readAccessed(env)
  assert.equal(share.accessed, 2)
})

test("#2143: 重复访问不改变分享记录（旧实现每次都无条件写库）", async () => {
  const env = freshEnv()
  await seed(env)

  const before = await accessedCount(env)
  await resolveShare("/@s/abc", "", "10.0.0.1", env) // 首次访问，会计数
  const afterFirst = await accessedCount(env)
  assert.equal(afterFirst, before + 1)

  const snapshot = JSON.stringify(await readAccessed(env))
  await resolveShare("/@s/abc", "", "10.0.0.1", env) // 同一访问者，不计数
  assert.equal(
    JSON.stringify(await readAccessed(env)),
    snapshot,
    "重复访问不应改变分享记录",
  )
})

test("#2143: 未登录访问者（无 clientKey）按每次请求计数，不能绕过限制", async () => {
  const env = freshEnv()
  await seed(env, { maxAccessed: 1 })

  const first = await resolveShare("/@s/abc", "", "", env)
  assert.equal(first.ok, true)

  // 拿不到访问者标识时必须 fail-closed：把每次请求都当成新访问者
  const second = await resolveShare("/@s/abc", "", "", env)
  assert.equal(second.ok, false)
  assert.equal(second.error, "share access count exceeded")
})

test("#2143: 分享范围校验与访问计数互不影响（回归）", async () => {
  const env = freshEnv()
  await seed(env, { files: ["/data/dir1/a.txt", "/data/dir2/b.txt"] })

  const ok = await resolveShare("/@s/abc/a.txt", "", "10.0.0.1", env)
  assert.equal(ok.ok, true)
  assert.equal(ok.realPath, "/data/dir1/a.txt")

  const bad = await resolveShare("/@s/abc/nope.txt", "", "10.0.0.1", env)
  assert.equal(bad.ok, false)
  assert.equal(bad.error, "path not found in share")
})
