/**
 * SQL 方言抽象。
 *
 * 为什么要这一层：项目原本只支持 SQLite（D1/DO）与 MySQL 两种方言，且
 * 在 `schema.ts` / `format/sql.ts` 里用「反引号 + `driver.name === "mysql"`」
 * 硬编码。接入 PostgreSQL 系（Neon / Supabase / Hyperdrive / libSQL 兼容层）
 * 后，三处差异无法再用布尔分支表达：
 *
 *   1. 标识符引号：SQLite/MySQL 用反引号 `` `col` ``，Postgres 用双引号 `"col"`
 *   2. 参数占位符：SQLite/MySQL 用 `?`，Postgres 用 `$1 $2 ...`
 *   3. UPSERT 语法：`INSERT OR REPLACE` / `ON DUPLICATE KEY UPDATE` /
 *      `ON CONFLICT ... DO UPDATE`
 *
 * 因此把方言收敛成一张表，由 `Driver.dialect` 声明，上层（schema.ts 的 DDL
 * 生成、format/sql.ts 的读写语句）按方言取用，新增方言只需在这里加一项。
 *
 * 占位符策略：上层 SQL **统一书写 `?`**，由驱动在执行前调用
 * `toDialectPlaceholders()` 转换为目标方言。这样上层完全无需感知 Postgres
 * 的 `$n`，也避免同一条 SQL 在两种方言间重复实现。
 */

export type Dialect = "sqlite" | "mysql" | "postgres"

/**
 * 驱动未声明方言时的兜底。
 *
 * 早期驱动（kv/blob/cfkv/memory）不执行 SQL，无需方言；d1/do 虽执行 SQLite
 * 但历史代码未声明。返回 sqlite 可保持与既有行为一致。
 */
export const DEFAULT_DIALECT: Dialect = "sqlite"

export interface DialectOps {
  /** 包裹标识符（表名、列名）。 */
  quote(name: string): string
  /** UPSERT：主键冲突时覆盖非主键列。 */
  upsert(table: string, columns: string[], pkColumn: string): string
  /** 该方言是否支持 `INSERT OR REPLACE`。 */
  readonly supportsInsertOrReplace: boolean
}

function quoteBacktick(name: string): string {
  return "`" + name + "`"
}

function quoteDouble(name: string): string {
  return '"' + String(name).replace(/"/g, '""') + '"'
}

/**
 * Postgres / SQLite（3.24+）通用的 UPSERT：ON CONFLICT ... DO UPDATE。
 *
 * 与 MySQL 的 `VALUES(col)` 不同，这两者用 `EXCLUDED.col` 引用待插入值。
 */
function upsertOnConflict(
  quote: (s: string) => string,
  table: string,
  columns: string[],
  pkColumn: string,
): string {
  const cols = columns.map(quote).join(", ")
  const placeholders = columns.map(() => "?").join(", ")
  const updates = columns
    .filter((c) => c !== pkColumn)
    .map((c) => `${quote(c)} = EXCLUDED.${quote(c)}`)
    .join(", ")
  return updates
    ? `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) ON CONFLICT (${quote(
        pkColumn,
      )}) DO UPDATE SET ${updates}`
    : `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) ON CONFLICT (${quote(
        pkColumn,
      )}) DO NOTHING`
}

export const DIALECTS: Record<Dialect, DialectOps> = {
  sqlite: {
    quote: quoteBacktick,
    supportsInsertOrReplace: true,
    upsert: (table, columns) => {
      const cols = columns.map(quoteBacktick).join(", ")
      const placeholders = columns.map(() => "?").join(", ")
      return `INSERT OR REPLACE INTO ${table} (${cols}) VALUES (${placeholders})`
    },
  },

  mysql: {
    quote: quoteBacktick,
    supportsInsertOrReplace: false,
    upsert: (table, columns, pkColumn) => {
      const cols = columns.map(quoteBacktick).join(", ")
      const placeholders = columns.map(() => "?").join(", ")
      const updates = columns
        .filter((c) => c !== pkColumn)
        .map((c) => `${quoteBacktick(c)} = VALUES(${quoteBacktick(c)})`)
        .join(", ")
      return updates
        ? `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`
        : `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`
    },
  },

  postgres: {
    quote: quoteDouble,
    supportsInsertOrReplace: false,
    upsert: (table, columns, pkColumn) =>
      upsertOnConflict(quoteDouble, table, columns, pkColumn),
  },
}

/**
 * 取方言操作集（未知方言回退 sqlite，保证老驱动不炸）。
 */
export function dialectOps(dialect?: Dialect | string): DialectOps {
  const d = String(dialect || DEFAULT_DIALECT) as Dialect
  return DIALECTS[d] || DIALECTS[DEFAULT_DIALECT]
}

/**
 * 把统一书写的 `?` 占位符转换为目标方言的占位符。
 *
 * Postgres 需要位置编号（`$1` `$2` …），且编号必须与参数顺序一致。
 * 转换时必须**跳过字符串字面量与标识符内部的问号**，否则
 * `WHERE path = 'a?b'` 会被错误改写。
 *
 * 已处理：
 *   - 单引号字符串（含 SQL 标准的 `''` 转义）
 *   - 双引号标识符（含 `""` 转义）
 *   - 行注释（-- 开头）与块注释（slash-star 形式）
 */
export function toDialectPlaceholders(
  sql: string,
  dialect?: Dialect | string,
): string {
  if (String(dialect || DEFAULT_DIALECT) !== "postgres") return sql

  let out = ""
  let index = 0
  let i = 0
  const n = sql.length

  while (i < n) {
    const ch = sql[i]

    // 行注释：吞到行尾
    if (ch === "-" && sql[i + 1] === "-") {
      while (i < n && sql[i] !== "\n") {
        out += sql[i]
        i++
      }
      continue
    }

    // 块注释：吞到 */
    if (ch === "/" && sql[i + 1] === "*") {
      out += sql[i]
      out += sql[i + 1]
      i += 2
      while (i < n && !(sql[i] === "*" && sql[i + 1] === "/")) {
        out += sql[i]
        i++
      }
      if (i < n) {
        out += sql[i]
        out += sql[i + 1]
        i += 2
      }
      continue
    }

    // 单引号字符串：连续两个单引号是转义，不代表字符串结束
    if (ch === "'") {
      out += ch
      i++
      while (i < n) {
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            out += "''"
            i += 2
            continue
          }
          out += "'"
          i++
          break
        }
        out += sql[i]
        i++
      }
      continue
    }

    // 双引号标识符（Postgres 语义）：连续两个双引号是转义
    if (ch === '"') {
      out += ch
      i++
      while (i < n) {
        if (sql[i] === '"') {
          if (sql[i + 1] === '"') {
            out += '""'
            i += 2
            continue
          }
          out += '"'
          i++
          break
        }
        out += sql[i]
        i++
      }
      continue
    }

    if (ch === "?") {
      index++
      out += "$" + index
      i++
      continue
    }

    out += ch
    i++
  }

  return out
}

/**
 * 字符串字面量转义（供驱动在无参数化通道时兜底拼接）。
 *
 * 注意：仅用于 DDL 之类无法参数化的场景，业务数据必须走参数化。
 */
export function escapeLiteral(value: string): string {
  return "'" + String(value).replace(/'/g, "''") + "'"
}
