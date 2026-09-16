<div align="center">

# OpenList Next

**官方全部存储驱动 · 任意平台直连外部数据库 · 六个平台可部署**

<a href="./LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue.svg" alt="License" /></a>
<a href="https://github.com/LegspCpd/openlist-next/issues"><img src="https://img.shields.io/github/issues/LegspCpd/openlist-next" alt="Issues" /></a>

</div>

本仓库是 **LegspCpd 独立开发维护**的社区分支，以官方 [OpenList-Worker](https://github.com/OpenListTeam/OpenList-Worker) 为技术基线（保留其全部存储驱动与 API 契约），重点补上「**在任意边缘运行时直连外部数据库**」这一环：新增 8 个纯 `fetch` 实现的存储驱动，一条 `DATABASE_URL` 就能接上 Neon / Supabase / Turso / Upstash / 外部 MySQL / S3，不再被迫使用平台自带 KV。

| 相比上游 | 变化 |
|---|---|
| 存储驱动 | 7 → **15** 个（新增 neon / turso / pgrest / pghttp / mysqlhttp / upstash / r2 / s3） |
| SQL 方言 | 2 种（SQLite、MySQL）→ **3 种**（新增 PostgreSQL，含 `$n` 占位符） |
| 网盘驱动 | 78 → **81** 个（补齐 `123_link`、`ilanzou`、`halalcloud`） |
| 部署平台 | CF / EdgeOne / ESA → 增加 **Vercel**、**Netlify**、**Node 容器** |

📖 [多平台部署指南](./docs/DEPLOYMENT.md) · 🗄️ [外部存储配置](./docs/EXTERNAL_STORAGE.md) · 🔌 [一键连接数据库](./docs/ONE_CLICK_DATABASE.md) · ⚖️ [归属与许可](./NOTICE.md)

> [!WARNING]
> 本项目**不是 OpenList 官方发布物**，与 OpenListTeam 无任何隶属、授权或背书关系。
> 有问题请在本仓库提 Issue，**不要在官方仓库反馈本分支的问题**。代码来源与许可证说明见 [NOTICE.md](./NOTICE.md)。

---

## 一键部署

<div align="center">

| Cloudflare Workers | Vercel | EdgeOne 国际站 | EdgeOne 国内站 | Netlify |
| :---: | :---: | :---: | :---: | :---: |
| [![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/LegspCpd/openlist-next) | [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/LegspCpd/openlist-next) | [![使用 EdgeOne Makers 部署](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository-url=https%3A%2F%2Fgithub.com%2FLegspCpd%2Fopenlist-next&project-name=openlist-next&install-command=pnpm%20install%20--no-frozen-lockfile&build-command=pnpm%20run%20build&output-directory=dist&env=JWT_SECRET&env-description=JWT%20signing%20secret%2C%20%3E%3D16%20chars%2C%20e.g.%20openssl%20rand%20-hex%2032&env-link=https%3A%2F%2Fgithub.com%2FLegspCpd%2Fopenlist-next%2Fblob%2Fmain%2Fdocs%2FDEPLOYMENT.md) | [![使用 EdgeOne Makers 部署](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://console.cloud.tencent.com/edgeone/makers/new?repository-url=https%3A%2F%2Fgithub.com%2FLegspCpd%2Fopenlist-next&project-name=openlist-next&install-command=pnpm%20install%20--no-frozen-lockfile&build-command=pnpm%20run%20build&output-directory=dist&env=JWT_SECRET&env-description=JWT%20signing%20secret%2C%20%3E%3D16%20chars%2C%20e.g.%20openssl%20rand%20-hex%2032&env-link=https%3A%2F%2Fgithub.com%2FLegspCpd%2Fopenlist-next%2Fblob%2Fmain%2Fdocs%2FDEPLOYMENT.md) | [![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/LegspCpd/openlist-next) |

*EdgeOne 国际站 = <https://edgeone.ai/> · 国内站 = <https://console.cloud.tencent.com/edgeone> · 阿里云 ESA 无部署按钮，走控制台导入（[见下](#4-阿里云-esa)）*

</div>

| 平台 | 存储方案 | 说明 |
|---|---|---|
| **Cloudflare Workers** | KV（默认自动预配）/ D1 / R2 / DO / 外部库 | 支持最完整，推荐首选 |
| **腾讯云 EdgeOne Makers** | **KV 优先 → Blob 零配置兜底** / 外部库 | 部署时自动探测，无需手工指定 |
| **Vercel** | 必须接外部库（Marketplace 一键连接） | 无平台级 KV |
| **阿里云 ESA** | EdgeKV / Blob binding / 外部库 | 走 `esa-cli` 提交与部署 |
| **Netlify** | 外部库（Neon / Supabase / Upstash） | 函数限 10s，大目录易超时 |
| **Node / Docker** | 全部驱动，含 TCP 直连 MySQL | 唯一能用 `DB_DRIVER=mysql` 的场景 |

> [!IMPORTANT]
> **部署成功 ≠ 存储可用。** 最坏的情况是驱动悄悄退回 `memory`：站点能打开、能登录，但**一重启数据全丢**。
> 部署完请务必做一次下面的检查。

---

## 部署后必做：确认存储真的可用

```bash
# 直接访问（任何平台通用，权威结论）
curl https://<你的域名>/api/public/env_check

# 或用统一脚本：构建 → 部署 → 探测 → 给出下一步，一条命令完成
pnpm run deploy:edgeone -- --url https://<你的域名> --deep   # EdgeOne
pnpm run deploy:esa     -- --url https://<你的域名>          # 阿里云 ESA
pnpm run deploy:vercel  -- --url https://<你的域名>          # Vercel

# 只探测、不重新部署（部署完成后随时可跑）
pnpm run deploy:vercel -- --no-deploy --url https://<你的域名>
```

输出怎么读：

| 字段 | 期望值 | 说明 |
|---|---|---|
| `storage.driver` | `kv` / `d1` / `neon` / `blob` … | **实际生效**的驱动。显示 `memory` 表示数据**不会持久化**，必须处理 |
| `jwt.ready` | `true` | `JWT_SECRET` 已配置，否则加密字段解不开 |
| `ready` | `true` | 综合就绪 |

退出码 `0` = 存储已就绪；`2` = 未就绪。EdgeOne 上还会额外读取 `/storage-probe`，输出 KV / Blob 的可用性与推荐驱动。

---

## 手动部署

所有平台共用同一套环境变量，差异只在「配置入口」和「存储绑定方式」。

### 0. 通用前置

```bash
# Node.js 22.x（与 package.json engines 及各平台运行时一致）
corepack enable
corepack prepare pnpm@9.15.4 --activate

git clone https://github.com/LegspCpd/openlist-next.git
cd openlist-next
pnpm install
```

> **构建会先拉官方前端**：`pnpm run build` = `scripts/fetch-frontend.mjs`（克隆官方 `OpenList-Frontend` 并编译出 `dist/`）+ `scripts/build-edge.mjs`（编译后端到 `dist-server/`）。
> 依赖里有 2 个 GitHub 源依赖（`@hope-ui/solid`、`mpegts.js`），首次安装较慢属正常。
> 已有前端产物时可用 `FRONTEND_DIST=/path/to/dist pnpm run build` 跳过克隆。

---

### 1. Cloudflare Workers

**方式 A · 一键部署按钮**

点上方按钮 → 平台会读 `wrangler.jsonc` 与 `.dev.vars.example` 生成 Secret 输入项 → 填入 `JWT_SECRET` → 创建。
自动执行 `pnpm run build`，KV 由 wrangler 自动预配，无需任何手工绑定。

> 若提示「无法获取存储库内容」，先 **Fork** 本仓库，再用「连接到 GitHub 仓库」的方式部署。

**方式 B · Wrangler CLI**

```bash
npx wrangler login
openssl rand -hex 32 | npx wrangler secret put JWT_SECRET   # 生产密钥，务必与开发环境不同

pnpm run build          # ⚠️ 必须先构建，见下方说明
pnpm run deploy:worker  # 等价于 wrangler deploy --yes
# 或：pnpm run deploy   # 等价于 scripts/deploy.js（构建 + 部署）
```

**方式 C · 接入 Git 自动部署**

Dashboard → **Workers & Pages → Create → 连接 Git 仓库**，构建命令 `pnpm run build`，输出目录不用填（wrangler 读 `wrangler.jsonc`）。

> [!CAUTION]
> **`wrangler deploy` / `wrangler dev` 之前必须先 `pnpm run build`。**
> `wrangler.jsonc` 的 `assets.directory` 指向 `./dist`，而 `dist` 默认不存在（已被 `.gitignore` 忽略），
> 直接跑会报 `The directory specified by the "assets.directory" field ... does not exist` 并中止。
> 用一键部署按钮或方式 C 时平台会自动 build，不受此限制。

**存储绑定**

| 方案 | 怎么配 | 建议 `DB_FORMAT` |
|---|---|---|
| **KV（默认已启用）** | `wrangler.jsonc` 里 `kv_namespaces: [{ "binding": "KV" }]` —— **省略 `id` 字段**，首次部署自动创建 `openlist-next-kv` 并绑定，二次部署自动复用 | `map` / `key` |
| **D1** | 取消 `wrangler.jsonc` 中 `d1_databases` 的注释，绑定名 `DB` | `sql` |
| **R2** | 取消 `r2_buckets` 注释，绑定名 `BUCKET` | `map` / `key` |
| **Durable Objects** | 取消 `durable_objects` + `migrations` 注释（需迁移，删除成本高） | `sql` |
| **外部数据库** | 设 Secret `DATABASE_URL`，保持 `DB_DRIVER=auto` | 见 [EXTERNAL_STORAGE.md](./docs/EXTERNAL_STORAGE.md) |

> [!CAUTION]
> 不要把 `id` 写成 `"id": ""`（wrangler 校验会拒绝空字符串）。
> 也不要手动 `wrangler kv namespace create KV` —— wrangler 的预配链路无法按 title 复用已有命名空间，会另建一个并留下孤儿资源。

**环境变量**

```bash
npx wrangler secret put JWT_SECRET     # 必填
npx wrangler secret put ADMIN_PASS     # 可选，设置后跳过安装向导
npx wrangler secret put DATABASE_URL   # 可选，一条连接串自动识别驱动
```

非敏感变量（`DB_DRIVER` / `DB_FORMAT`）写在 `wrangler.jsonc` 的 `vars` 里。

| 变量 | 说明 |
|---|---|
| `JWT_SECRET` | 必填，签名会话 + 加密挂载凭据 |
| `ADMIN_PASS` | 可选，设置后跳过安装向导 |
| `DB_DRIVER` | `auto`（默认）/ `kv` / `d1` / `cfkv` / `blob` / `r2` / `do` / `neon` / `turso` / `pgrest` / `pghttp` / `mysqlhttp` / `upstash` / `s3` |
| `DB_FORMAT` | `map`（默认）/ `key` / `sql` |
| `DATABASE_URL` | 可选，一条连接串自动识别外部数据库 |

> [!CAUTION]
> **不要配 `DB_DRIVER=mysql`** —— Workers 没有裸 TCP，MySQL 驱动不可用。
> 外部 MySQL/MariaDB 请走 `mysqlhttp`（HTTP 网关），或改用 `neon` / `turso`。

**排障：部署成功但打不开（Error 1101）**

Error 1101 = Worker 运行时抛了未捕获异常，不是网络问题。

```bash
curl https://<你的域名>/healthz   # 看 persistence.checks 的报错说明
npx wrangler tail                # 实时日志
```

| 症状 | 原因 | 处理 |
|---|---|---|
| `No storage backend is available` | 一个存储绑定都没配 | `wrangler.jsonc` 已默认绑定 KV，加回它，或配 `DATABASE_URL` |
| 能登录但重启后掉线 / 凭据无法解密 | `JWT_SECRET` 未设或前后不一致 | `npx wrangler secret put JWT_SECRET`，各环境用各自的值 |
| 配了外部数据库却仍读写平台 KV | `DB_DRIVER` 被显式写成了平台驱动 | 改回 `auto`；外部数据库探测优先级高于平台绑定 |

---

### 2. 腾讯云 EdgeOne Makers

**国际站**：<https://edgeone.ai/> ｜ **国内站**：<https://console.cloud.tencent.com/edgeone>

EdgeOne 的 Edge Functions 只把 KV/Blob 注入**边缘函数**，Node 云函数拿不到。因此本项目在 EdgeOne 上有**两个入口，缺一不可**：

| 文件 | 作用 |
|---|---|
| `api/_makers.ts` → 构建产出 `cloud-functions/[[default]].js` | Node 云函数入口（后端主体） |
| `functions/*` | 边缘函数：KV 代理（`kv-get/put/delete/list`）+ 存储探测（`storage-probe`） |
| `middleware.js` | 根目录边缘中间件，负责 SPA 回退重写 |

**方式 A · 一键部署按钮**

点上方「EdgeOne 国际站 / 国内站」按钮 → 进入控制台，仓库、项目名、安装/构建命令、输出目录、`JWT_SECRET` 输入项都已预填。

**方式 B · 控制台接入 Git 仓库**

创建项目 → 导入 Git 仓库 → 构建命令 `pnpm run build`，输出目录 `dist`。`edgeone.json` 会覆盖控制台里填的配置。

> [!IMPORTANT]
> `cloud-functions/[[default]].js` 是构建产物，但 **EdgeOne 部署时从仓库读取，必须提交进仓库**，不要加进 `.gitignore`。
> 缺失会报 `No server-handler detected` 并退化成纯静态项目。
> 仓库里的 `EdgeOne Artifact Guard` 工作流会在产物过期时自动重建并提交，无需手工维护。

**方式 C · Makers CLI**

```bash
EO_PAGES_PROJECT=openlist-next \
EO_PAGES_API_TOKEN=<控制台获取的 Token> \
pnpm run deploy:edgeone -- --url https://<你的域名> --deep
```

Makers CLI 一次同步静态资源 + 边缘函数 + KV + 定时触发器，随后自动调用 `/storage-probe` 与 `/api/public/env_check` 报告实际生效的存储。

**存储自动探测**（`DB_DRIVER=auto`，默认）

| 优先级 | 方案 | 配置方式 |
|---|---|---|
| 1 | 外部数据库 | 设 `DATABASE_URL=postgres://…@ep-xxx.neon.tech/…` |
| 2 | **KV（优先于 Blob）** | 控制台「KV 存储」创建命名空间 → **绑定到边缘函数**（不是 Node 云函数），**绑定变量名填 `KV`**；再设 `EO_KV_URLS` + `JWT_SECRET`（经 `functions/kv-*` 代理给云函数） |
| 3 | **Blob（零配置兜底）** | 无需任何控制台操作，`@edgeone/pages-blob` 首次写入即自动建库 |

```bash
JWT_SECRET=<openssl rand -hex 32>   # 必填
# EO_KV_URLS=https://your-project.edgeone.app   # 跨域或本地调试才需显式设置，同部署自调用可留空
```

也可显式写 `DB_DRIVER=kv` 或 `DB_DRIVER=blob`（显式指定则不做回退）。随时确认当前用的是哪个：

```bash
node scripts/deploy-platform.mjs edgeone --no-deploy --url https://<你的域名>
# 加 ?deep=1 需带上 X-Internal-Call: <JWT_SECRET>，会做一次 KV 写/读/删往返验证可写性
```

> [!CAUTION]
> **`edgeone.json` 的三个坑**（本项目已修正，自行修改配置时注意）：
> - `nodeVersion` 必须是平台预装版本之一（14.21.3 / 16.20.2 / 18.20.4 / 20.18.0 / **22.11.0**），填别的会构建失败；
> - `maxDuration` 必须嵌在 `cloudFunctions.nodejs` 下，写成 `cloudFunctions.maxDuration` 不生效；
> - SPA 路由回退由根目录 `middleware.js` 承担。`edgeone.json` 的 `rewrites` 只作用于静态资源、**官方明确不支持 SPA 路由**，加 `/*` 反而会命中静态文件。

> [!WARNING]
> **不要用 `*.edgeone.cool` 临时域名验证存储** —— 该域名带全站鉴权参数，会拦截边缘函数 ↔ 云函数的 KV 代理回调。请先绑定自定义域名再验证。
> Node 云函数拿到 KV 绑定却报 401 时，检查 `EO_KV_URLS` 是否指向正确 origin，以及与边缘函数是否用了**同一个** `JWT_SECRET`。

---

### 3. Vercel

**方式 A · 一键部署按钮**

点上方 Vercel 按钮 → 部署页下方会出现 **Marketplace Database Providers** 列表 → 点选其一「**一键连接数据库**」（Neon / Upstash / Supabase / Turso …），Vercel 会把连接信息自动注入为环境变量，本项目 `DB_DRIVER=auto` 会自动识别接通，**无需改代码**。

支持矩阵与分步说明见 [一键连接数据库](./docs/ONE_CLICK_DATABASE.md)：Neon / Upstash / Supabase / Turso ✅ 完全支持；Nile / Prisma Postgres / AWS RDS ⚠️ 需 Postgres-over-HTTP 网关；Redis（TCP）、MongoDB、Convex、MotherDuck ❌ 边缘跑不了。

**方式 B · 控制台导入**

**Import Git Repository** → 框架检测选 **Other**（配置全部读 `vercel.json`）。

**方式 C · CLI**

```bash
npx vercel login
npx vercel deploy --prod --yes

# 或一条命令完成 构建 → 部署 → 存储自检：
pnpm run deploy:vercel -- --url https://<你的域名>
```

**环境变量**（Project Settings → Environment Variables，Marketplace 接库后通常只需补前者）

```bash
JWT_SECRET=<openssl rand -hex 32>
DATABASE_URL=postgres://user:pass@ep-xxx.neon.tech/neondb
DB_DRIVER=auto      # 留空即为 auto
DB_FORMAT=map
```

**`vercel.json` 关键配置**

| 字段 | 值 | 说明 |
|---|---|---|
| `buildCommand` | `pnpm run build` | 先拉官方前端产物，再打包后端 |
| `outputDirectory` | `dist` | 前端静态资源目录 |
| `functions["api/[...route].ts"]` | `runtime=nodejs22.x`, `maxDuration=60`, `memory=1024` | 后端入口；默认 10s 对大目录不够 |
| `rewrites` | `/d`、`/sd`、`/p`、`/api` → `/api/[...route]`；其余 → `/index.html` | 后端路由 + SPA 回退 |

> `api/_makers.ts`（EdgeOne 云函数入口）与 `api/html.d.ts` **不会**被 Vercel 当成函数 —— Vercel 会忽略 `/api` 下以下划线开头、以 `.` 开头、以 `.d.ts` 结尾的文件。
> Vercel Functions 单次执行上限默认 10s（Pro 60s），大目录列表或代理下载可能超时，建议 `DB_FORMAT=map` 减少数据库往返。

---

### 4. 阿里云 ESA

ESA 走「构建 → 提交版本 → 部署」三步。

**方式 A · 控制台导入**

ESA 控制台 →「**边缘计算 → 函数和 Pages**」→ 创建 → 导入 GitHub 仓库。
构建命令 `pnpm run build`，静态资源目录 `./dist`，函数文件路径 `./dist-server/esa-entry.js`（这些都会以 `esa.jsonc` 为准）。

**方式 B · CLI**

```bash
pnpm install
pnpm run build          # 产出 dist-server/esa-entry.js（服务端入口）与 dist/（前端静态资源）

npx esa-cli login       # 首次需要登录
npx esa-cli commit      # 生成代码版本
npx esa-cli deploy      # 按提示选择版本与目标环境

# 或让统一脚本一条命令做完（构建 + 提交 + 部署 + 存储自检）：
pnpm run deploy:esa -- --url https://<你的域名>
```

**`esa.jsonc` 关键字段**

| 字段 | 值 | 作用 |
|---|---|---|
| `entry` | `./dist-server/esa-entry.js` | 边缘函数入口。产物放 `dist-server/` 而非 `dist/`，**否则服务端 bundle 会被当作静态文件公开下载** |
| `assets.directory` | `./dist` | 前端静态资源目录 |
| `assets.notFoundStrategy` | `singlePageApplication` | 未命中静态资源时返回 `index.html` + 200。**不配这个，`/login`、`/@manage/*` 等 SPA 路由会直接 404** |

**环境变量**（ESA 控制台）

```bash
JWT_SECRET=<随机串>
DATABASE_URL=postgres://…@ep-xxx.neon.tech/neondb   # 跨实例共享最可靠
DB_FORMAT=map
```

> **存储自动探测**（`DB_DRIVER=auto`，默认）：ESA 上 EdgeKV 会被自动识别为 `kv` 驱动（优先）；配了外部数据库则优先用外部库；ESA Blob 绑定（`ESA_BLOB`）会被识别为 `blob` 驱动。Vercel Marketplace 式的连接变量（`KV_REST_API_URL` / `TURSO_DATABASE_URL` 等）同样适用。
> ESA 每个请求对 KV 子请求有次数上限，若坚持用平台 EdgeKV，建议 `DB_FORMAT=map`（整库一个 key，读写各一次）。

---

### 5. Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/LegspCpd/openlist-next)

```bash
# 方式 A：接 Git（读 netlify.toml 自动构建）
# 方式 B：CLI
netlify deploy --build --prod
```

环境变量在 **Site configuration → Environment variables** 配置：

```bash
JWT_SECRET=<随机串>
DATABASE_URL=postgres://…@ep-xxx.neon.tech/neondb
DB_FORMAT=map
```

路由：`/api/*`、`/dav/*`、`/p/*` 由 `netlify/functions/api.ts` 处理（通过 `config.path` 挂载，**不用 redirect** —— rewrite 会把 `req.url` 改成 `/.netlify/functions/...` 从而破坏后端路由），其余请求回退到 SPA 的 `index.html`。

> [!WARNING]
> Netlify Functions 单次执行 **10s**（Pro 26s），冷启动 + 网盘 API 往返容易触顶。生产建议优先用 Workers，这里主要用于尝鲜或与其他平台互备。

---

### 6. Node / Docker 自建

自建是**唯一能用 `DB_DRIVER=mysql` 直连 TCP** 的场景，也支持 D1 之外的全部格式。

```bash
pnpm install
pnpm run build
pnpm start              # node dist-server/api/[...route].js
```

环境变量写在根目录 `.env`（由 `loadEnv.js` 读取）：

```bash
JWT_SECRET=<随机串>
DATABASE_URL=mysql://user:pass@127.0.0.1:3306/openlist
DB_DRIVER=mysql
DB_FORMAT=sql
```

> 部署在 Vercel Functions、Docker 等 Node 容器时，外部 MySQL 同样可以直接 TCP 直连，**不需要** `mysqlhttp` 网关；网关只在边缘运行时才需要。

---

## 环境变量速查

持久化由两个正交维度决定：`DB_DRIVER`（存在**哪里**）× `DB_FORMAT`（**怎么组织**）。

| 变量 | 取值 | 说明 |
|---|---|---|
| `JWT_SECRET` | ≥16 字符 | **必填**，签名会话 + 字段加密 + 定时任务鉴权 |
| `ADMIN_PASS` | — | 可选，设置后跳过安装向导并初始化 admin |
| `DB_DRIVER` | `auto`（默认）`kv` `d1` `r2` `blob` `cfkv` `do` `mysql` `neon` `turso` `pgrest` `pghttp` `mysqlhttp` `upstash` `s3` | `auto` 会按 `DATABASE_URL` 自动识别，**外部数据库优先级高于平台绑定** |
| `DB_FORMAT` | `map`（默认）`key` `sql` | `map` 整个库序列化成一个 JSON 值，最通用；`sql` 表结构与 Go 版对齐（前缀 `x_`），**可与 Go 版 OpenList 共享同一个库** |
| `DATABASE_URL` | 连接串 | 一条搞定：`*.neon.tech`→`neon`、`libsql://`→`turso`、`*.supabase.co`→`pgrest`、`redis://`→`upstash` |
| `ALLOW_URLS` | 逗号分隔 | CORS 白名单，留空仅同源 |
| `MAX_UPLOAD` / `MAX_UPPART` | 字节 | 整体上传 / 分片单片上限 |

厂商专属变量（`NEON_DATABASE_URL`、`TURSO_DATABASE_URL`+`TURSO_AUTH_TOKEN`、`SUPABASE_URL`+`SUPABASE_KEY`、`PG_HTTP_URL`、`MYSQL_HTTP_URL`、`UPSTASH_REDIS_REST_URL`、`S3_*`、`CF_ACCOUNT`/`CF_KV_UUID`/`CF_API_KEY`）优先级高于 `DATABASE_URL`。
完整清单与各数据库配置示例见 [外部存储配置指南](./docs/EXTERNAL_STORAGE.md)，模板见 [`.dev.vars.example`](./.dev.vars.example)。

---

## 常见问题

| 现象 | 处理 |
|---|---|
| `No storage backend is available` | serverless 下不落内存。配 `DATABASE_URL` 或绑定平台存储 |
| 每次重启都要重新初始化 | 数据没持久化。检查 `env_check` 返回的 driver 是否为 `memory` |
| 前端 404 但 API 正常 | 静态资源未上传。`build` 会产出 `dist/`，确认平台的 assets 目录指向它 |
| 接了两个平台结果不一致 | 两边的 `JWT_SECRET` 不同会导致加密字段解不开，务必保持一致 |
| `mysql2 is not available` | 在边缘运行时用了 `DB_DRIVER=mysql`（仅 Node 容器可用）。改用 `mysqlhttp` + 网关 |
| Supabase 报 404 | `kv` 表不存在，先建表：`CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);` |

---

## 常用命令

```bash
pnpm run dev:worker     # 仅启动 Worker 开发服务器（wrangler dev）
pnpm run dev:unified    # 拉官方前端 + 启动 Worker
pnpm run lint           # 全量 tsc 类型检查
pnpm run test:all       # 全量单元测试
pnpm run format         # prettier 格式化
```

---

## 帮助支持

- 🐛 [提交 Bug 或功能请求](https://github.com/LegspCpd/openlist-next/issues)
- 💬 [一般性问题与交流](https://github.com/LegspCpd/openlist-next/discussions)

## 开源许可

本项目基于 [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.txt) 许可证发布。

## 联系我们

🌐 [@LegspCpd](https://github.com/LegspCpd) · 📦 [openlist-next](https://github.com/LegspCpd/openlist-next) · 🐛 [Issues](https://github.com/LegspCpd/openlist-next/issues)

## 贡献者

本项目由 **LegspCpd** 独立开发与维护。

[![Contributors](https://contrib.rocks/image?repo=LegspCpd/openlist-next)](https://github.com/LegspCpd/openlist-next/graphs/contributors)

---

## 致谢

本项目的设计与实现**借鉴、参考**了下列开源项目，谨向下述项目及其开发者的工作致以诚挚感谢：

- [Alist](https://github.com/AlistGo/alist) 项目作者及全体开发者
- [OpenList](https://github.com/OpenListTeam/OpenList)（Go 版）项目作者及全体开发者
- [OpenList-Worker](https://github.com/OpenListTeam/OpenList-Worker)（官方 TypeScript / Workers 移植版）项目作者及全体开发者
- [openlistnext](https://github.com/Polonium-salts/openlistnext) 社区项目作者及全体开发者

> [!NOTE]
> 上述项目的开发者**不是本仓库的贡献者**。本仓库由 **LegspCpd** 独立开发维护，
> 与上述项目及 OpenListTeam **均无隶属、授权或背书关系**，仅在开源许可允许的范围内借鉴其成果。
> 代码来源、边界与许可证说明见 [NOTICE.md](./NOTICE.md)。
>
> 前端在构建时直接拉取官方 [OpenList-Frontend](https://github.com/OpenListTeam/OpenList-Frontend) 产物，**本仓库不含前端源码**，前端版权归其原始开发者所有。
