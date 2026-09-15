/**
 * HTTP SQL 驱动工厂测试。
 *
 * 用一个「只记录、不真连」的假适配器，验证工厂生成的 **SQL 文本**是否正确。
 * 之所以不断言执行结果：真正的结果取决于远端数据库，而 SQL 拼错（引号用错、
 * 占位符没转换、UPSERT 语法串味）才是这一层最可能出错也最难发现的地方。
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import type { Driver } from "./types"
import { createHttpSqlDriver, normalizeParam } from "./driver/http-sql"

interface LogEntry {
  kind: "query" | "execute"
  sql: string
  params: any[]
}

/** 构造一个记录调用日志的驱动，rows 固定返回 value。 */
let configSeq = 0

/**
 * 注意：每个 driver 必须拿到**唯一**的 config 对象。
 * 工厂用 `JSON.stringify(cfg)` 做建表缓存的 key —— 配置相同就会复用同一次
 * DDL。这在生产里是对的（同一份连接串不必重复建表），但测试里会让多个
 * driver 互相污染，导致「首次调用到底跑没跑 DDL」断言失真。
 */
function uniqueConfig() {
  return { cfg: ++configSeq }
}

function makeDriver(dialect: "sqlite" | "mysql" | "postgres") {
  const log: LogEntry[] = []
  let initDdlCount = 0
  const rowsToReturn: any[] = []
  const cfg = uniqueConfig()

  const driver: Driver = createHttpSqlDriver({
    name: `mock-${dialect}`,
    dialect,
    platform: "Mock",
    resolve: () => cfg,
    async query(_cfg, sql, params) {
      log.push({ kind: "query", sql, params })
      return rowsToReturn
    },
    async execute(_cfg, sql, params) {
      log.push({ kind: "execute", sql, params })
      if (sql.startsWith("CREATE TABLE")) initDdlCount++
    },
  })

  return {
    driver,
    log,
    setRows(r: any[]) {
      rowsToReturn.length = 0
      rowsToReturn.push(...r)
    },
    ddlCount: () => initDdlCount,
    /** 过滤掉建表语句，只看真正的数据操作。 */
    dataOps: () => log.filter((e) => !e.sql.startsWith("CREATE TABLE")),
  }
}

test("reports availability from resolve()", async () => {
  const { driver } = makeDriver("postgres")
  assert.equal(await driver.isAvailable({}), true)
})

test("postgres: put emits ON CONFLICT with numbered placeholders", async () => {
  const { driver, dataOps } = makeDriver("postgres")
  await driver.put("mykey", "myval")

  const ops = dataOps()
  assert.equal(ops.length, 1)
  assert.equal(ops[0].kind, "execute")
  assert.match(ops[0].sql, /^INSERT INTO "kv"/)
  assert.match(ops[0].sql, /ON CONFLICT \("key"\) DO UPDATE SET "value" = EXCLUDED\."value"$/)
  // 占位符必须是 $1/$2，而不是原样的 ?
  assert.ok(!ops[0].sql.includes("?"), `unexpected raw placeholder: ${ops[0].sql}`)
  assert.match(ops[0].sql, /VALUES \(\$1, \$2\)/)
  assert.deepEqual(ops[0].params, ["mykey", "myval"])
})

test("sqlite: put emits INSERT OR REPLACE with ? placeholders", async () => {
  const { driver, dataOps } = makeDriver("sqlite")
  await driver.put("k", "v")

  const sql = dataOps()[0].sql
  assert.match(sql, /^INSERT OR REPLACE INTO `kv`/)
  assert.match(sql, /VALUES \(\?, \?\)/)
  assert.deepEqual(dataOps()[0].params, ["k", "v"])
})

test("mysql: put emits ON DUPLICATE KEY UPDATE with VALUES()", async () => {
  const { driver, dataOps } = makeDriver("mysql")
  await driver.put("k", "v")

  const sql = dataOps()[0].sql
  assert.match(sql, /^INSERT INTO `kv`/)
  assert.match(sql, /ON DUPLICATE KEY UPDATE `value` = VALUES\(`value`\)/)
})

test("postgres: get selects with numbered placeholder", async () => {
  const { driver, dataOps, setRows } = makeDriver("postgres")
  setRows([{ value: "stored" }])

  const value = await driver.get("mykey")
  assert.equal(value, "stored")

  const op = dataOps()[0]
  assert.equal(op.kind, "query")
  assert.equal(op.sql, 'SELECT "value" FROM "kv" WHERE "key" = $1')
  assert.deepEqual(op.params, ["mykey"])
})

test("get returns null when no row exists", async () => {
  const { driver, setRows } = makeDriver("postgres")
  setRows([])
  assert.equal(await driver.get("missing"), null)
})

test("delete targets the key column", async () => {
  const { driver, dataOps } = makeDriver("postgres")
  await driver.delete("gone")

  assert.equal(dataOps()[0].sql, 'DELETE FROM "kv" WHERE "key" = $1')
  assert.deepEqual(dataOps()[0].params, ["gone"])
})

test("list uses LIKE prefix and returns key strings", async () => {
  const { driver, dataOps, setRows } = makeDriver("postgres")
  setRows([{ key: "users_1" }, { key: "users_2" }])

  const keys = await driver.list("users_")
  assert.deepEqual(keys, ["users_1", "users_2"])

  const op = dataOps()[0]
  assert.equal(op.sql, 'SELECT "key" FROM "kv" WHERE "key" LIKE $1 ORDER BY "key"')
  assert.deepEqual(op.params, ["users_%"])
})

test("schema is created once and cached per config", async () => {
  const { driver, ddlCount } = makeDriver("postgres")
  await driver.put("a", "1")
  const afterFirst = ddlCount()
  await driver.put("b", "2")
  await driver.get("a")

  assert.ok(afterFirst > 0, "expected DDL to run on first use")
  assert.equal(ddlCount(), afterFirst, "DDL must not re-run on subsequent calls")
})

test("query passes SQL through with dialect placeholders applied", async () => {
  const { driver, dataOps, setRows } = makeDriver("postgres")
  setRows([{ id: 1 }])

  // Driver 接口把 query/batch 声明为可选（部分驱动不支持 SQL），
  // 但 createHttpSqlDriver 产出的驱动必然实现了它们，故此处断言非空。
  const rows = await driver.query!("SELECT * FROM x WHERE a = ? AND b = ?", [1, 2], {})
  assert.deepEqual(rows, [{ id: 1 }])
  assert.equal(dataOps()[0].sql, "SELECT * FROM x WHERE a = $1 AND b = $2")
})

test("batch falls back to sequential execute when adapter omits it", async () => {
  const { driver, dataOps } = makeDriver("postgres")
  await driver.batch!(
    [
      { sql: "INSERT INTO t VALUES (?)", params: [1] },
      { sql: "INSERT INTO t VALUES (?)", params: [2] },
    ],
    {},
  )

  const ops = dataOps()
  assert.equal(ops.length, 2, "each statement must be sent")
  assert.equal(ops[0].sql, "INSERT INTO t VALUES ($1)")
  assert.deepEqual(ops[1].params, [2])
})

test("batch prefers adapter-provided implementation", async () => {
  let usedCustomBatch = false
  const calls: string[] = []

  const driver: Driver = createHttpSqlDriver({
    name: "mock-batch",
    dialect: "postgres",
    platform: "Mock",
    resolve: () => ({}),
    async query() {
      return []
    },
    async execute(_c, sql) {
      calls.push(sql)
    },
    async batch(_c, statements) {
      usedCustomBatch = true
      for (const s of statements) calls.push(s.sql)
    },
  })

  await driver.batch!([{ sql: "SELECT ?", params: [1] }], {})
  assert.equal(usedCustomBatch, true, "adapter batch should take precedence")
})

test("health reports healthy when query succeeds", async () => {
  const { driver } = makeDriver("postgres")
  const h = await driver.health({})
  assert.equal(h.configured, true)
  assert.equal(h.connected, true)
  assert.equal(h.mode, "mock-postgres")
})

test("health reports unhealthy with the error message", async () => {
  const driver: Driver = createHttpSqlDriver({
    name: "mock-broken",
    dialect: "postgres",
    platform: "Mock",
    resolve: () => ({}),
    async query() {
      throw new Error("connection refused")
    },
    async execute() {
      throw new Error("connection refused")
    },
  })

  const h = await driver.health({})
  assert.equal(h.configured, true)
  assert.equal(h.connected, false)
  assert.match(h.error, /connection refused/)
})

test("unconfigured health explains what is missing", async () => {
  const driver: Driver = createHttpSqlDriver({
    name: "mock-unconfigured",
    dialect: "postgres",
    platform: "Mock",
    resolve: () => null,
    async query() {
      return []
    },
    async execute() {},
  })

  const h = await driver.health({})
  assert.equal(h.configured, false)
  assert.equal(await driver.isAvailable({}), false)
})

// ── 参数归一化 ────────────────────────────────────────────────────────────

test("normalizeParam converts JS values to wire-safe primitives", () => {
  assert.equal(normalizeParam(undefined), null)
  assert.equal(normalizeParam(null), null)
  const d = new Date("2024-01-01T00:00:00.000Z")
  assert.equal(normalizeParam(d), "2024-01-01T00:00:00.000Z")
  assert.equal(normalizeParam(42n), 42)
  assert.equal(normalizeParam({ a: 1 }), '{"a":1}')
  assert.equal(normalizeParam("plain"), "plain")
})
