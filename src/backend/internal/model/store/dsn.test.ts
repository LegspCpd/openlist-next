/**
 * 连接串解析与驱动推断测试。
 *
 * 连接串是用户最容易填错的东西，而且错法很隐蔽（比如密码里带 @），
 * 因此这里把各种形态都钉死。
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { parseDsn, inferFromUrl, inferDriverFromEnv, envValue } from "./dsn"

test("parses standard postgres URL", () => {
  const d = parseDsn("postgres://user:p%40ss@ep-cool.us-east-2.aws.neon.tech/neondb?sslmode=require")!
  assert.equal(d.host, "ep-cool.us-east-2.aws.neon.tech")
  assert.equal(d.database, "neondb")
  assert.equal(d.scheme, "postgres")
  assert.equal(d.user, "user")
  assert.equal(d.port, 5432)
})

test("password containing @ is parsed correctly", () => {
  // 标准 URL 构造器会把 p@ss@word 里的第一个 @ 当成分隔符，导致 host 解析错误。
  // 这里必须取「最后一个 @」之前的部分整体作为 userinfo。
  const d = parseDsn("mysql://root:p@ss@word@127.0.0.1:3307/openlist")!
  assert.equal(d.user, "root")
  assert.equal(d.password, "p@ss@word")
  assert.equal(d.host, "127.0.0.1")
  assert.equal(d.port, 3307)
  assert.equal(d.database, "openlist")
})

test("applies per-scheme default ports", () => {
  assert.equal(parseDsn("postgres://u:p@h/db")!.port, 5432)
  assert.equal(parseDsn("mysql://u:p@h/db")!.port, 3306)
})

test("normalizes scheme aliases", () => {
  assert.equal(parseDsn("postgresql://u:p@h/db")!.scheme, "postgres")
  assert.equal(parseDsn("mariadb://u:p@h/db")!.scheme, "mysql")
  assert.equal(parseDsn("rediss://u:p@h")!.scheme, "redis")
  assert.equal(parseDsn("libsql://x.turso.io")!.scheme, "libsql")
})

test("parses https URLs used as gateway endpoints", () => {
  const d = parseDsn("https://xxx.supabase.co")!
  assert.equal(d.scheme, "https")
  assert.equal(d.host, "xxx.supabase.co")
  assert.equal(d.database, null)
})

test("returns null for malformed or empty input", () => {
  assert.equal(parseDsn(""), null)
  assert.equal(parseDsn("not a url"), null)
})

test("parses IPv6 literal hosts", () => {
  const d = parseDsn("postgres://u:p@[::1]:5433/db")!
  assert.equal(d.host, "::1")
  assert.equal(d.port, 5433)
})

// ── 驱动推断 ──────────────────────────────────────────────────────────────

test("infers neon by host", () => {
  assert.equal(inferFromUrl("postgres://u:p@ep-1.aws.neon.tech/db"), "neon")
})

test("infers supabase/pgrest by host", () => {
  assert.equal(
    inferFromUrl("postgres://postgres:p@db.abc.supabase.co:5432/postgres"),
    "pgrest",
  )
})

test("routes plain postgres to HTTP gateway (no bare TCP on edge)", () => {
  assert.equal(inferFromUrl("postgres://u:p@myhost:5432/db"), "pghttp")
})

test("infers turso and mysql", () => {
  assert.equal(inferFromUrl("libsql://x.turso.io"), "turso")
  assert.equal(inferFromUrl("mysql://u:p@h:3306/db"), "mysqlhttp")
})

test("infers upstash from https host", () => {
  assert.equal(inferFromUrl("https://apn-1.upstash.io"), "upstash")
})

test("explicit DB_DRIVER wins over URL inference", () => {
  const env = {
    DB_DRIVER: "d1",
    DATABASE_URL: "postgres://u:p@ep-1.aws.neon.tech/db",
  }
  assert.equal(inferDriverFromEnv(env), "d1")
})

test("auto DB_DRIVER falls through to URL inference", () => {
  const env = {
    DB_DRIVER: "auto",
    DATABASE_URL: "postgres://u:p@ep-1.aws.neon.tech/db",
  }
  assert.equal(inferDriverFromEnv(env), "neon")
})

test("vendor-specific variable beats generic DATABASE_URL", () => {
  const env = {
    DATABASE_URL: "postgres://u:p@myhost:5432/db", // 会被推断成 pghttp
    TURSO_DATABASE_URL: "libsql://x.turso.io", // 专属变量优先
  }
  assert.equal(inferDriverFromEnv(env), "turso")
})

test("returns null when nothing is configured", () => {
  assert.equal(inferDriverFromEnv({}), null)
})

// ── 环境变量读取 ──────────────────────────────────────────────────────────

test("envValue respects key priority order", () => {
  assert.equal(envValue({ A: "", B: "yes" }, "A", "B"), "yes")
  assert.equal(envValue({ A: "first", B: "second" }, "A", "B"), "first")
  assert.equal(envValue({}, "MISSING"), "")
})

test("envValue treats whitespace-only values as empty", () => {
  assert.equal(envValue({ A: "   " }, "A"), "")
})
