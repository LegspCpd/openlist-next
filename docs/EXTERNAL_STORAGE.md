# 外部存储配置指南

OpenList Next 允许把配置数据（存储挂载、用户、分享、设置）存到**任意外部数据库**，
而不是被绑死在部署平台的原生 KV 上。本文覆盖全部支持组合。

> 官方上游版本中，`mysql` 驱动只能跑在 Node 容器里 —— Cloudflare Workers 没有裸 TCP，
> 一旦部署到边缘就只能退回平台 KV。OpenList Next 补上了这条链路：**全部外部数据库
> 驱动基于 `fetch`，可在任何边缘运行时直连。**

---

## 1. 核心概念：驱动 × 格式

持久化由两个正交的维度决定：

| 变量 | 含义 | 取值 |
|---|---|---|
| `DB_DRIVER` | 数据存在**哪里** | `auto` `kv` `d1` `r2` `blob` `cfkv` `do` `mysql` `neon` `turso` `pgrest` `pghttp` `mysqlhttp` `upstash` `s3` |
| `DB_FORMAT` | 数据**怎么组织** | `map` `key` `sql` |

`DB_DRIVER=auto`（默认）时会自动探测，**外部数据库的优先级高于平台原生绑定** ——
因为连接串是用户明确填的，而平台 KV/D1 常常是模板顺手创建的空库。

### 三种格式怎么选

| 格式 | 存储形态 | 适用 | 备注 |
|---|---|---|---|
| `map` | 整个数据库序列化成**一个** JSON 值 | KV / 对象存储 / Redis | 最通用、最快（一次读写），推荐默认 |
| `key` | 每个实体一条记录 | KV | 按需读取，实体多时比 `map` 省 |
| `sql` | 关系表，与 Go 后端 schema 完全一致 | D1 / Neon / Turso / MySQL | 可索引；**可与 Go 版 OpenList 共享同一个库** |

> 想要 Go 版和本版共用一套数据：用 `DB_FORMAT=sql`，两边表结构已对齐（前缀 `x_`）。

---

## 2. 驱动能力矩阵

| 驱动 | 运行环境 | map | key | sql | 说明 |
|---|:--:|:--:|:--:|:--:|---|
| `neon` | 任意（HTTP） | ✅ | ✅ | ✅ | Neon Serverless Postgres |
| `turso` | 任意（HTTP） | ✅ | ✅ | ✅ | Turso / libSQL，批量走单次流水线 |
| `pghttp` | 任意（HTTP） | ✅ | ✅ | ✅ | 经网关访问任意 Postgres 系 |
| `mysqlhttp` | 任意（HTTP） | ✅ | ✅ | ✅ | 经网关访问 MySQL / MariaDB |
| `mysql` | **仅 Node 容器** | ✅ | ✅ | ✅ | TCP 直连，无需网关 |
| `d1` | Cloudflare | ✅ | ✅ | ✅ | SQLite |
| `do` | Cloudflare | ✅ | ✅ | ✅ | Durable Objects + SQLite |
| `kv` | CF / EO / ESA | ✅ | ✅ | ❌ | 平台 KV 绑定 |
| `blob` | EdgeOne / ESA | ✅ | ✅ | ❌ | 平台 Blob |
| `cfkv` | 任意（REST） | ✅ | ✅ | ❌ | 远程 Cloudflare KV |
| `r2` | Cloudflare | ✅ | ✅ | ❌ | R2 对象存储 |
| `s3` | 任意（HTTP） | ✅ | ✅ | ❌ | S3 / MinIO / B2 |
| `upstash` | 任意（REST） | ✅ | ✅ | ❌ | Upstash Redis |
| `pgrest` | 任意（REST） | ✅ | ✅ | ❌ | Supabase / PostgREST |

---

## 3. 最省事的用法：一条连接串

只填 `DATABASE_URL`，保持 `DB_DRIVER=auto`，驱动会自动识别：

| 连接串 | 自动选中 |
|---|---|
| `postgres://user:pass@ep-xxx.neon.tech/neondb` | `neon` |
| `postgresql://postgres:pw@db.xxx.supabase.co:5432/postgres` | `pgrest`（需另填 `SUPABASE_KEY`） |
| `libsql://my-db-myorg.turso.io` | `turso`（需另填 `TURSO_AUTH_TOKEN`） |
| `mysql://user:pass@host:3306/openlist` | `mysqlhttp`（需另填 `MYSQL_HTTP_URL`） |
| `redis://xxx.upstash.io` | `upstash` |
| `https://my-presto.example.com/sql` | `pghttp` |

厂商专属变量（`NEON_DATABASE_URL`、`TURSO_DATABASE_URL` …）优先级**高于**
`DATABASE_URL`，方便在同一份配置里区分多个来源。

---

## 4. 各数据库详细配置

### 4.1 Neon（推荐，最适合 Workers）

```bash
DATABASE_URL=postgres://user:pass@ep-cool-glade-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
DB_DRIVER=neon
DB_FORMAT=sql          # 也可 map / key
JWT_SECRET=<openssl rand -hex 32>
```

Neon 提供 HTTP 查询端口，**不需要 Hyperdrive，也不需要在 wrangler 里加绑定**。

### 4.2 外部 MySQL / MariaDB（重点）

边缘环境连不了 3306，需要在**能连到数据库**的地方跑一个转发网关。
网关协议极简（收 JSON → 执行 → 回 JSON），参考实现见 [第 5 节](#5-http-网关参考实现)，
约 40 行 Node 代码，可部署到任意 VPS / Railway / Fly.io / Cloud Run。

```bash
# Cloudflare 环境变量
DATABASE_URL=mysql://user:pass@your-mysql-host:3306/openlist
MYSQL_HTTP_URL=https://gateway.example.com/sql
MYSQL_HTTP_TOKEN=<随机串，网关侧校验用>
DB_DRIVER=mysqlhttp
DB_FORMAT=sql
JWT_SECRET=<openssl rand -hex 32>
```

TDSQL-C、PolarDB、RDS、MariaDB、TiDB 同理 —— 只要网关能用对应客户端连上。

> **若部署在 Node 容器**（Vercel Functions、自托管 Docker、`npm start`）：
> 无需网关，直接 `DATABASE_URL=mysql://...` + `DB_DRIVER=mysql` 走 TCP 即可，
> 网关只在边缘运行时才需要。

### 4.3 Supabase / PostgREST

REST 语义，**不支持 `DB_FORMAT=sql`**（用 `map` 或 `key`）。需先建表：

```sql
CREATE TABLE IF NOT EXISTS kv (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

```bash
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=<service_role 或 anon key>
DB_DRIVER=pgrest
DB_FORMAT=map
```

也可以只填 `DATABASE_URL=postgresql://postgres:pw@db.xxxx.supabase.co:5432/postgres`
配合 `SUPABASE_KEY`，宿主机会自动从 `db.xxx` 推导出 REST 地址。

### 4.4 Turso / libSQL

```bash
TURSO_DATABASE_URL=libsql://my-db-myorg.turso.io
TURSO_AUTH_TOKEN=<token>
DB_DRIVER=turso
DB_FORMAT=sql
```

Turso 支持在一个 HTTP 请求里执行多条语句，因此整库保存只走**一次**往返，
是外部数据库中写入最快的选项之一。

### 4.5 Upstash Redis

```bash
UPSTASH_REDIS_REST_URL=https://apn-xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=<token>
DB_DRIVER=upstash
DB_FORMAT=map          # 或 key
```

多实例共用同一 Redis 时建议设 `UPSTASH_PREFIX=openlist:` 隔离键前缀。

### 4.6 S3 / R2 / MinIO

```bash
S3_BUCKET=openlist-data
S3_REGION=auto
S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com   # AWS 官方可省略
S3_ACCESS_KEY_ID=<key>
S3_SECRET_ACCESS_KEY=<secret>
DB_DRIVER=s3
DB_FORMAT=map
```

已手工实现 AWS Signature V4，不依赖任何 SDK。若部署在 Cloudflare 上且已绑定 R2，
直接用 `DB_DRIVER=r2`（读 binding，不需要密钥）更省事。

---

## 5. HTTP 网关参考实现

适用于 `pghttp` / `mysqlhttp`。把它部署到任何能访问数据库的机器上，
然后把地址填到 `*_HTTP_URL`。

### MySQL / MariaDB 版

```js
// gateway.mjs  —— node gateway.mjs
import http from "node:http"
import mysql from "mysql2/promise"

const pool = mysql.createPool(process.env.DATABASE_URL)
const TOKEN = process.env.GATEWAY_TOKEN

http
  .createServer(async (req, res) => {
    if (req.method !== "POST") return res.writeHead(405).end()

    // 鉴权：网关暴露在公网时务必设置 GATEWAY_TOKEN
    if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) {
      return res.writeHead(401).end()
    }

    let raw = ""
    for await (const chunk of req) raw += chunk

    try {
      const { sql, params = [] } = JSON.parse(raw)
      const [rows] = await pool.query(sql, params)
      res.writeHead(200, { "content-type": "application/json" })
      // 字段名必须包含 rows / data / result / results / records 之一
      res.end(JSON.stringify({ rows: Array.isArray(rows) ? rows : [] }))
    } catch (err) {
      res.writeHead(500, { "content-type": "application/json" })
      res.end(JSON.stringify({ error: err.message }))
    }
  })
  .listen(process.env.PORT || 8080)
```

```bash
DATABASE_URL=mysql://user:pass@host:3306/openlist \
GATEWAY_TOKEN=<随机串> \
node gateway.mjs
```

### PostgreSQL 版

```js
import http from "node:http"
import pg from "pg"

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const TOKEN = process.env.GATEWAY_TOKEN

http
  .createServer(async (req, res) => {
    if (req.method !== "POST") return res.writeHead(405).end()
    if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) {
      return res.writeHead(401).end()
    }

    let raw = ""
    for await (const chunk of req) raw += chunk

    try {
      const { sql, params = [] } = JSON.parse(raw)
      // 注意：pghttp 驱动已把 ? 转换成 $1 $2 ...，这里直接传即可
      const result = await pool.query(sql, params)
      res.writeHead(200, { "content-type": "application/json" })
      res.end(JSON.stringify({ rows: result.rows }))
    } catch (err) {
      res.writeHead(500, { "content-type": "application/json" })
      res.end(JSON.stringify({ error: err.message }))
    }
  })
  .listen(process.env.PORT || 8080)
```

> **安全建议**：网关不要裸奔。除 Bearer token 外，还应限制来源 IP、
> 只读账号、以及在网关侧做语句白名单（本项目只会发出固定几种 CRUD/DDL）。

---

## 6. 环境变量速查

```bash
# ── 通用 ────────────────────────────────────────────
DB_DRIVER=auto          # 存储位置
DB_FORMAT=map           # 存储格式
JWT_SECRET=             # 必填，≥16 字符，签名 + 字段加密
ADMIN_PASS=             # 选填，跳过安装向导
ALLOW_URLS=             # 选填，CORS 白名单

# ── 外部数据库（任一即可）────────────────────────────
DATABASE_URL=           # 通用，自动识别驱动
NEON_DATABASE_URL=
TURSO_DATABASE_URL=     TURSO_AUTH_TOKEN=
SUPABASE_URL=           SUPABASE_KEY=
PG_HTTP_URL=            PG_HTTP_TOKEN=
MYSQL_HTTP_URL=         MYSQL_HTTP_TOKEN=
MYSQL_URLS=             # 仅 Node 容器直连用
UPSTASH_REDIS_REST_URL= UPSTASH_REDIS_REST_TOKEN=
S3_BUCKET=              S3_REGION=  S3_ENDPOINT=
S3_ACCESS_KEY_ID=       S3_SECRET_ACCESS_KEY=

# ── 平台绑定专属 ────────────────────────────────────
CF_ACCOUNT=  CF_KV_UUID=  CF_API_KEY=   # cfkv
EO_KV_URLS=                             # EdgeOne KV 代理

# ── 其他 ────────────────────────────────────────────
MAX_UPLOAD=26214400     # 整体上传上限（字节）
MAX_UPPART=16777216     # 分片单片上限（字节）
ASSET_URLS=             # 前端 CDN 地址，支持 $version
ALLOW_SEED=             # 种子数据源白名单
```

---

## 7. 排错

启动后访问 `/api/public/env_check` 或管理面板的「存储状态」可查看当前生效的驱动、
格式与连接结果。

| 现象 | 原因与处理 |
|---|---|
| 报 `No storage backend is available` | serverless 下禁止内存兜底。填 `DATABASE_URL` 或绑定平台 KV/D1 |
| `driver is not available in this runtime` | 显式 `DB_DRIVER` 指定的驱动缺配置。改成 `auto`，或补齐对应变量 |
| MySQL 报 `mysql2 is not available` | 在 Workers 上用了 `DB_DRIVER=mysql`（仅 Node 容器可用）。改用 `mysqlhttp` + 网关 |
| Postgres 语法错误 / 报 `` ` `` 相关错 | 方言未生效（用了 SQLite 的标识符引号）。确认 `DB_DRIVER` 是 `neon` / `pghttp`，而非错配成 `d1` |
| Supabase 报 404 | `kv` 表不存在，先在 SQL Editor 里建表（见 4.3） |
| S3 报 `SignatureDoesNotMatch` | `S3_ENDPOINT` 与 `S3_PATH_STYLE` 不匹配。自建端（MinIO/R2）保持 `S3_PATH_STYLE=true` |
| 数据存进去了但重启后没了 | 落到 `memory` 驱动了。serverless 环境必须配持久化后端 |
