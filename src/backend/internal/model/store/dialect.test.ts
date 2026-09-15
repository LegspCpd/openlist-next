/**
 * 方言层测试。
 *
 * 重点覆盖两个容易出错的点：
 *   1. `?` → `$n` 转换必须**跳过字符串字面量与注释内部的问号**，否则
 *      `WHERE path = 'a?b'` 会被改写成 `WHERE path = 'a$1b'`，悄悄产出错误 SQL。
 *   2. 三种方言的标识符引号与 UPSERT 语法各不相同，错一个就是线上事故。
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  toDialectPlaceholders,
  dialectOps,
  DIALECTS,
  DEFAULT_DIALECT,
  escapeLiteral,
} from "./dialect"

test("postgres: converts placeholders positionally", () => {
  assert.equal(
    toDialectPlaceholders("SELECT * FROM t WHERE a = ? AND b = ?", "postgres"),
    "SELECT * FROM t WHERE a = $1 AND b = $2",
  )
})

test("sqlite/mysql keep question marks", () => {
  assert.equal(toDialectPlaceholders("SELECT ? ", "sqlite"), "SELECT ? ")
  assert.equal(toDialectPlaceholders("SELECT ? ", "mysql"), "SELECT ? ")
})

test("postgres: leaves question marks inside string literals alone", () => {
  assert.equal(
    toDialectPlaceholders("INSERT INTO kv VALUES (?, 'a?b')", "postgres"),
    "INSERT INTO kv VALUES ($1, 'a?b')",
  )
})

test("postgres: handles doubled-quote escape inside literals", () => {
  assert.equal(
    toDialectPlaceholders("SELECT ? , 'it''s ? ok'", "postgres"),
    "SELECT $1 , 'it''s ? ok'",
  )
})

test("postgres: leaves question marks inside comments alone", () => {
  assert.equal(
    toDialectPlaceholders("SELECT ? -- why ? here\n, ? /* q? */ , ?", "postgres"),
    "SELECT $1 -- why ? here\n, $2 /* q? */ , $3",
  )
})

test("postgres: leaves question marks inside quoted identifiers alone", () => {
  assert.equal(
    toDialectPlaceholders('SELECT "we?ird" FROM t WHERE k = ?', "postgres"),
    'SELECT "we?ird" FROM t WHERE k = $1',
  )
})

test("postgres: sql without placeholders is unchanged", () => {
  assert.equal(toDialectPlaceholders("SELECT 1", "postgres"), "SELECT 1")
})

test("identifier quoting per dialect", () => {
  assert.equal(dialectOps("sqlite").quote("key"), "`key`")
  assert.equal(dialectOps("mysql").quote("key"), "`key`")
  assert.equal(dialectOps("postgres").quote("key"), '"key"')
})

test("postgres: escapes embedded double quotes in identifiers", () => {
  assert.equal(dialectOps("postgres").quote('we"ird'), '"we""ird"')
})

test("upsert: sqlite uses INSERT OR REPLACE", () => {
  assert.equal(
    dialectOps("sqlite").upsert("kv", ["key", "value"], "key"),
    "INSERT OR REPLACE INTO kv (`key`, `value`) VALUES (?, ?)",
  )
  assert.equal(DIALECTS.sqlite.supportsInsertOrReplace, true)
})

test("upsert: mysql uses ON DUPLICATE KEY UPDATE with VALUES()", () => {
  assert.equal(
    dialectOps("mysql").upsert("kv", ["key", "value"], "key"),
    "INSERT INTO kv (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
  )
})

test("upsert: postgres uses ON CONFLICT with EXCLUDED", () => {
  assert.equal(
    dialectOps("postgres").upsert("kv", ["key", "value"], "key"),
    'INSERT INTO kv ("key", "value") VALUES (?, ?) ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"',
  )
})

test("upsert: primary key is never updated to itself", () => {
  const sql = dialectOps("postgres").upsert("users", ["id", "name"], "id")
  assert.ok(!sql.includes('"id" = EXCLUDED."id"'))
})

test("unknown dialect falls back to default instead of throwing", () => {
  assert.equal(dialectOps("nope").quote("k"), dialectOps(DEFAULT_DIALECT).quote("k"))
})

test("escapeLiteral doubles single quotes", () => {
  assert.equal(escapeLiteral("o'brien"), "'o''brien'")
})
