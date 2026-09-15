# 一键连接数据库（Vercel Marketplace）

在 Vercel 上点「一键部署」时，页面下方会出现 **Marketplace Database Providers**
列表。点选其一即可把数据库挂到本项目上，Vercel 会把连接信息**自动注入**为环境
变量。本项目 `DB_DRIVER=auto`（默认）会**自动识别**这些变量并接通，无需手工改
代码。

> 相关实现：`src/backend/internal/model/store/dsn.ts`（环境变量 → 驱动推断）、
> `src/backend/internal/model/store/driver/*`（各驱动）。
> 部署总览见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

---

## 1. 支持矩阵

| Marketplace 数据库 | 类型 | Vercel 自动注入的变量 | 本项目驱动 | 推荐 DB_FORMAT | 状态 |
|---|---|---|---|---|---|
| **Neon** — Serverless Postgres | Postgres / HTTP | `DATABASE_URL`、`POSTGRES_URL`、`POSTGRES_URL_NON_POOLING`、`POSTGRES_PRISMA_URL`、`NEON_DATABASE_URL` | `neon` | `map` | ✅ 完全支持 |
| **Upstash** — Serverless DB | Redis / REST | `KV_REST_API_URL`、`KV_REST_API_TOKEN`、`UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN` | `upstash` | `map` 或 `key` | ✅ 完全支持 |
| **Supabase** — Postgres backend | Postgres | `SUPABASE_URL`（+`SUPABASE_KEY`）、`POSTGRES_URL`、`POSTGRES_PRISMA_URL` | `pgrest` | `map` | ✅ 支持 |
| **Turso** — Serverless SQLite | libSQL / SQLite | `TURSO_DATABASE_URL`、`TURSO_AUTH_TOKEN`、`LIBSQL_URL` | `turso` | `map` | ✅ 完全支持 |
| **Nile** — Postgres for B2B | Postgres | `NILEDB_URL`、`NILE_DATABASE_URL` | `pghttp` | `map` | ⚠️ 需 Postgres-over-HTTP 网关（见下） |
| **Prisma Postgres** — Instant Serverless Postgres | Postgres | `DATABASE_URL`（`prisma+postgres://…`）、`PRISMA_DATABASE_URL` | `pghttp`（尽力而为） | `map` | ⚠️ 已能自动识别（`prisma+postgres://` 会归一化为 Postgres），但需 Postgres-over-HTTP 网关才能真读写 |
| **AWS** — Serverless, reliable, secure | RDS/Aurora（Postgres）/ S3 | `DATABASE_URL` / `S3_*` | `pghttp` / `s3` | `map` | ⚠️ 仅 S3 直连；RDS 需网关 |
| **Redis** — Official Redis for Vercel | Redis / TCP | `REDIS_URL`（`redis://…`） | — | — | ❌ 边缘无裸 TCP；仅在 Node 容器另行接入 |
| **MotherDuck** — Analytics Database | DuckDB | `MOTHERDUCK_TOKEN` | — | — | ❌ 协议不兼容 |
| **Mem0** — Memory layer for AI agents | 记忆层 API | `MEM0_API_KEY` | — | — | ❌ 非持久化存储后端 |
| **Convex** — Reactive database | 私有协议 | `CONVEX_URL` | — | — | ❌ 私有协议，非 SQL/KV |
| **MongoDB Atlas** — Database for Developers | 文档数据库 | `MONGODB_URI` | — | — | ❌ 无 Mongo 驱动 |

**一句话结论**：本项目的边缘 HTTP 存储层天然适配 **Neon / Upstash / Supabase /
Turso**（以及任何提供 Postgres-over-HTTP 网关的库）；纯 TCP（Redis、RDS 直连）
或私有协议（Convex、MongoDB、MotherDuck）在 Serverless 边缘跑不了，需要 Node
容器或用带 HTTP 网关的等价服务。

---

## 2. 一键连接步骤（以 Neon 为例）

1. 在 Vercel 部署页/项目里点 **Marketplace → Neon → Connect**（新建或复用）。
2. Vercel 自动把 `DATABASE_URL`/`POSTGRES_URL` 等注入项目环境变量。
3. 环境变量（可选，通常无需手动设置）：
   ```
   DB_DRIVER=auto     # 默认即可；auto 会识别 Neon 主机名 ep-xxx.neon.tech
   DB_FORMAT=map      # 整库单键，减少往返（大目录推荐）
   JWT_SECRET=<openssl rand -hex 32>
   ```
4. Redeploy，然后访问 `GET /api/public/env_check`，`driver` 应显示 `neon`。

**Upstash / Vercel KV**：点 Connect 后注入 `KV_REST_API_URL` +
`KV_REST_API_TOKEN`，`auto` 会识别为 `upstash`（仅 KV 语义，用 `map`/`key`，
不要用 `sql`）。

**Turso**：注入 `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` → 识别为 `turso`。

**Supabase**：注入 `SUPABASE_URL` → 识别为 `pgrest`；若只给 `POSTGRES_URL`
（含 `.pooler.supabase.com` 连接池主机），也会被识别为 `pgrest`。

---

## 3. 自动识别是怎么工作的

`DB_DRIVER=auto`（默认）时，`inferDriverFromEnv()` 按以下顺序判断：

1. **显式 `DB_DRIVER`**（非 `auto`）——最高优先级，不做推断。
2. **厂商专属变量**：
   - `NEON_DATABASE_URL` / `NEON_URL` → `neon`
   - `TURSO_DATABASE_URL` / `LIBSQL_URL` → `turso`
   - `SUPABASE_URL` / `SUPABASE_DB_URL` / `SUPABASE_POOLER_URL` /
     `SUPABASE_REST_URL` / `NEXT_PUBLIC_SUPABASE_URL` → `pgrest`
   - `KV_REST_API_URL`（Vercel KV / Upstash 集成）/ `UPSTASH_REDIS_REST_URL` → `upstash`
   - `NILEDB_URL` / `NILE_DATABASE_URL` → `pghttp`
   - `PRISMA_DATABASE_URL` / `PRISMA_POSTGRES_URL` → `pghttp`
   - `PG_HTTP_URL` / `MYSQL_HTTP_URL` 等自建网关 → `pghttp` / `mysqlhttp`
3. **通用连接串**：`DATABASE_URL` / `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING` /
   `POSTGRES_PRISMA_URL` / `DATABASE_URL_UNPOOLED` / `MYSQL_URL` → 按 scheme +
   主机特征推断
   （`*.neon.tech` → neon；`*.supabase.co` / `*.pooler.supabase.com` → pgrest；
   `libsql://` → turso；`redis://` → upstash；其余 `postgres://` → pghttp）。

**scheme 归一化**：`postgresql`/`pg` → `postgres`，`mariadb` → `mysql`，
`rediss` → `redis`，`prisma+postgres`/`prisma` → `postgres`。
所以 Prisma Postgres 那种 `prisma+postgres://accelerate.prisma-data.net/?api_key=…`
也能被识别（否则会被当成未知 scheme 直接跳过）。

平台原生绑定（Cloudflare KV/D1/R2、EdgeOne KV/Blob、Netlify Blobs）始终排在
**外部数据库之后**——只要你接了外部库，就一定优先用外部库。

---

## 4. 部署后确认（别只看「部署成功」）

部署成功不代表存储接通了 —— 最坏情况是驱动悄悄回退到 `memory`，
站点能打开、能登录，但**一重启所有数据就没了**。用统一脚本确认：

```bash
pnpm run deploy:vercel -- --no-deploy --url https://<你的域名>
```

输出会告诉你：

- `storage.driver` —— 实际生效的驱动（应为 `neon` / `upstash` / `pgrest` / `turso` / …）；
- 是否 `memory`（**必须处理**）与驱动健康状态；
- `jwt.ready` —— `JWT_SECRET` 是否配好（不配的话加密字段解不开）。

退出码 `0` = 存储已就绪，`2` = 未就绪。也可以直接访问
`https://<你的域名>/api/public/env_check` 看同样内容。

---

## 5. 自定义（非 Marketplace 的）数据库

任何数据库只要暴露 **HTTPS 查询接口**都能接：

```
DB_DRIVER=pghttp
PG_HTTP_URL=https://your-postgres-http-gateway/query
PG_HTTP_AUTH=Bearer <token>
```
或自建 MySQL HTTP 网关：
```
DB_DRIVER=mysqlhttp
MYSQL_HTTP_URL=https://your-mysql-gateway/query
```

详见 [EXTERNAL_STORAGE.md](./EXTERNAL_STORAGE.md)。
