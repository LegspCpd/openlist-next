<div align="center">

# OpenList Next

<p><em>OpenList 是一个多功能的目录列表工具，可以把分散在多种网盘、对象存储和协议服务里的文件集中到一个界面，进行浏览、预览、下载和分享</em></p>
<p>本仓库是官方 <a href="https://github.com/OpenListTeam/OpenList-Worker">OpenList-Worker</a> 的社区衍生版，用 TypeScript 编写，可以部署到 Cloudflare Workers、腾讯云 EdgeOne、阿里云 ESA 等边缘平台</p>
<p>在官方版本的基础上，本项目补上了「在任何边缘平台上直连外部数据库」这件事</p>

<a href="./LICENSE"><img src="https://img.shields.io/github/license/LegspCpd/openlist-next" alt="License" /></a>
<a href="https://github.com/LegspCpd/openlist-next/actions/workflows/edgeone-artifact-guard.yml"><img src="https://img.shields.io/github/actions/workflow/status/LegspCpd/openlist-next/edgeone-artifact-guard.yml?branch=main" alt="Build status" /></a>
<a href="https://github.com/LegspCpd/openlist-next/issues"><img src="https://img.shields.io/github/issues/LegspCpd/openlist-next" alt="Issues" /></a>
<a href="https://github.com/LegspCpd/openlist-next/discussions"><img src="https://img.shields.io/github/discussions/LegspCpd/openlist-next?color=%23ED8936" alt="Discussions" /></a>

📖 [多平台部署指南](./docs/DEPLOYMENT.md) · 🗄️ [外部存储配置](./docs/EXTERNAL_STORAGE.md) · 🔌 [一键连接数据库](./docs/ONE_CLICK_DATABASE.md)

</div>

<div align="center">

[English](readmes/README_en.md) | 简体中文 | [繁體中文](readmes/README_zh-TW.md) | [日本語](readmes/README_ja.md) | [한국어](readmes/README_ko.md) | [Français](readmes/README_fr.md)

[上游项目](https://github.com/OpenListTeam/OpenList-Worker) · [贡献指南](./CONTRIBUTING.md) · [许可证](./LICENSE) · [来源与许可声明](./NOTICE.md)

</div>

> [!WARNING]
> 本项目**不是** OpenList 官方发布物，与 OpenListTeam 没有任何隶属、授权或背书关系。
> 使用中遇到问题，请在本仓库提 Issue，不要到官方仓库反馈。
> 代码来源、版权与许可证说明见 [NOTICE.md](./NOTICE.md)。

---

## 一键部署

点击下面的按钮，可以把本项目部署到对应的平台：

<div align="center">

| EdgeOne · 国际站 | EdgeOne · 中国站 | Cloudflare Workers |
| :---: | :---: | :---: |
| [![使用 EdgeOne 部署](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?project-name=openlist-next&repository-url=https://github.com/LegspCpd/openlist-next&install-command=pnpm%20install%20--no-frozen-lockfile&build-command=pnpm%20run%20build&output-directory=dist&env=JWT_SECRET) | [![使用 EdgeOne 部署](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://console.cloud.tencent.com/edgeone/makers/new?project-name=openlist-next&repository-url=https://github.com/LegspCpd/openlist-next&install-command=pnpm%20install%20--no-frozen-lockfile&build-command=pnpm%20run%20build&output-directory=dist&env=JWT_SECRET) | [![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/LegspCpd/openlist-next) |

| Vercel | Netlify |
| :---: | :---: |
| [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/LegspCpd/openlist-next) | [![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/LegspCpd/openlist-next) |

</div>

部署完成后还需要配置环境变量，其中 `JWT_SECRET` 是必填的，可以用 `openssl rand -hex 32` 生成。

- EdgeOne：[国际站控制台](https://console.edgeone.ai/makers) · [中国站控制台](https://console.cloud.tencent.com/edgeone/makers)
- Cloudflare：[Worker 后台](https://dash.cloudflare.com/)
- Vercel：项目设置 → Environment Variables
- Netlify：Site configuration → Environment variables

常用的几个变量：

- `JWT_SECRET`：会话签名和字段加密用的密钥，**必填**
- `ADMIN_PASS`：可选，设置后跳过安装向导，直接用这个密码初始化管理员账号
- `DB_FORMAT`：数据怎么组织，`map`（默认）/ `key` / `sql`
- `DB_DRIVER`：数据存在哪里，`auto`（默认，自动识别）/ `kv` / `d1` / `blob` / `neon` / `turso` / …
- `DATABASE_URL`：外部数据库连接串。填了它并保持 `DB_DRIVER=auto`，程序会自动接上

> [!IMPORTANT]
> 如果 Cloudflare 提示「无法获取存储库内容」，先 [Fork](https://github.com/LegspCpd/openlist-next/fork) 本仓库，再用「连接到 GitHub 仓库」的方式部署。

---

## 功能简介

OpenList 是一个运行于边缘计算平台的多存储聚合文件列表与管理系统，可将分散在不同网盘、对象存储与协议服务中的文件统一到一个界面，进行浏览、预览、下载与管理。

OpenList-Worker 是官方 [OpenListTeam/OpenList](https://github.com/OpenListTeam/OpenList) 项目的 TypeScript + Serverless 移植版，后端由 Go 重写为运行于 Workers 的 TypeScript 服务，前端保持一致的界面与交互体验。

### 存储聚合

内置 **81 个存储驱动**，开箱即用地挂载各类存储后端：

- **国内网盘**：阿里云盘（开放平台/分享）、夸克网盘（开放平台/UC TV 版）、百度网盘（相册）、115 网盘（开放平台/分享）、123 云盘（开放平台/分享）、天翼云盘（189/PC/TV）、中国移动云盘（139/和彩云）、沃家云盘、迅雷云盘、腾讯微云、蓝奏云、PikPak（分享）、豆包网盘、光亚盘、超星小组网盘、联想 NAS 分享、Teambition 网盘、WPS 网盘、阿里文档、HalalCloud、MediaTrack 等
- **国际网盘**：Google Drive（相册）、OneDrive（应用/分享链接）、Dropbox、MEGA、MediaFire、Proton Drive、Yandex Disk、Degoo、Bunny Storage、TeraBox 等
- **对象存储**：S3 兼容（AWS/OSS/COS/MinIO 等）、又拍云 USS、Azure Blob、WebDAV、FTP、SFTP、SMB、IPFS 等
- **代码托管**：GitHub、GitHub Releases、CNB Releases
- **网盘程序**：OpenList（分享）、AList V3、Cloudreve V3/V4、Kodbox（可道云）、Seafile、Teldrive、Febbox 等
- **其他驱动**：网易云音乐、Misskey、Emby、Cloudflare 图床等

除上述真实存储外，还提供 `Local`、`Alias`、`UrlTree`、`AutoIndex`、`Strm`、`Crypt`、`Virtual`、`Chunk` 等虚拟/功能型驱动，可用于本地挂载、地址别名、URL 列表、加密存储与分片等场景。

### 核心能力

- **文件浏览**：统一的目录树浏览，支持图片、视频、音频、文档、代码、压缩包等格式在线预览。
- **上传下载**：跨存储的上传、批量下载、流式传输与直链跳转。
- **文件分享**：生成带有效期、密码与权限控制的分享链接，支持匿名访问与目录分享。
- **全文搜索**：在已索引的存储中快速检索文件。
- **离线任务**：后台任务队列，支持批量操作与异步处理。
- **外部接口**：将聚合存储以 WebDAV 或 S3 兼容协议对外暴露，便于挂载到第三方工具。
- **MCP 服务**：提供 Model Context Protocol 端点，可被 AI 助手等客户端集成调用。

### 权限管理

- **权限管理**：基于角色的访问控制（RBAC），支持用户分组、目录级读写权限与配额。
- **认证方式**：内置账号密码，支持 TOTP 验证、WebAuthn/FIDO 登录、SSO 单点登录与 LDAP 目录认证。
- **安全加固**：JWT 会话、CSRF 防护、点击劫持防护（X-Frame-Options）、内容安全策略（CSP）。
- **健康检查**：提供 `/health` 存活探针与 `/healthz` 就绪探针，可用于监控与告警。

### 平台部署

- **运行平台**：Cloudflare Workers、腾讯云 EdgeOne Makers、阿里云 ESA、Vercel、Netlify 及 Node.js 容器环境。
- **数据存储**：平台自带存储（KV / D1 / Blob …）或任意外部数据库。
- **一键部署**：支持 EdgeOne、Cloudflare Workers、Vercel、Netlify 的一键部署按钮。

---

## 和官方版本有哪些不同

| | 官方 OpenList-Worker | 本项目 |
|---|---|---|
| 存储驱动 | 7 个 | 15 个，新增 neon / turso / pgrest / pghttp / mysqlhttp / upstash / r2 / s3 |
| SQL 方言 | SQLite、MySQL | 增加 PostgreSQL（含 `$n` 占位符） |
| 网盘驱动 | 78 个 | 81 个，补齐 `123_link`、`ilanzou`、`halalcloud` |
| 部署平台 | Cloudflare Workers、EdgeOne、ESA、Serverless | 增加 Vercel、Netlify、Node/Docker |

官方版本里的 `mysql` 驱动只能跑在 Node 容器中——Cloudflare Workers 没有裸 TCP，部署到边缘就只能用平台自带的 KV。本项目新增的 8 个存储驱动全部基于 `fetch` 实现，所以在边缘运行时也能连外部数据库，填一条 `DATABASE_URL` 就行。

详细说明见 [外部存储配置指南](./docs/EXTERNAL_STORAGE.md)。

---

## 手动部署

### 前置要求

- Node.js **22.x**
- pnpm **9.15.4**（通过 corepack 启用）
- 部署到 Cloudflare Workers 的话，需要一个 Cloudflare 账号

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
```

### 本地开发

```bash
git clone https://github.com/LegspCpd/openlist-next.git
cd openlist-next
pnpm install

cp .dev.vars.example .dev.vars
openssl rand -hex 32        # 生成 JWT_SECRET，填进上面那个文件

pnpm run dev:unified        # 拉取官方前端并启动 Worker
pnpm run dev:worker         # 只启动 Worker
```

> `pnpm run build` 会先克隆官方前端仓库 OpenList-Frontend 并编译出 `dist/`，再编译后端到 `dist-server/`。
> 如果本地已经有前端产物，可以用 `FRONTEND_DIST=/path/to/dist pnpm run build` 跳过克隆。
> 依赖里有两个来自 GitHub 的包（`@hope-ui/solid`、`mpegts.js`），首次安装比较慢是正常的。

### 部署到 Cloudflare Workers

用命令行：

```bash
npx wrangler login
openssl rand -hex 32 | npx wrangler secret put JWT_SECRET

pnpm run build
pnpm run deploy:worker
```

也可以在 Cloudflare 后台连接 Git 仓库：构建命令填 `pnpm run build`，输出目录不用填，wrangler 会读 `wrangler.jsonc`。

关于存储：`wrangler.jsonc` 里已经默认声明了一个 KV 绑定，第一次部署时 wrangler 会自动创建 `openlist-next-kv` 并绑定，之后每次部署都会复用，不用手动创建。想改用 D1、R2 或 Durable Objects，把 `wrangler.jsonc` 里对应的注释打开就行，具体写法都写在文件的注释里了。

> 注意：在本地执行 `wrangler deploy` 或 `wrangler dev` 之前，一定要先跑 `pnpm run build`。
> `wrangler.jsonc` 里的 `assets.directory` 指向 `./dist`，而这个目录默认不存在（被 `.gitignore` 忽略了），
> 直接跑会报 `The directory specified by the "assets.directory" field ... does not exist`。
> 用一键部署按钮或在后台连接 Git 仓库时，平台会自动构建，不受影响。

> 不要把 `DB_DRIVER` 设成 `mysql` —— Cloudflare Workers 没有裸 TCP，这个驱动在边缘跑不起来。
> 要连外部 MySQL，请用 `mysqlhttp`（需要自建一个 HTTP 网关），或者换成 `neon` / `turso`。

### 部署到腾讯云 EdgeOne

[国际站](https://edgeone.ai/) 和 [中国站](https://console.cloud.tencent.com/edgeone) 都可以。

可以点上面的一键部署按钮，也可以在控制台里创建项目并导入 Git 仓库，构建命令填 `pnpm run build`，输出目录填 `dist`。这些配置在 `edgeone.json` 里也有，实际以文件为准。

> **重要**：`cloud-functions/[[default]].js` 是构建产物，但 EdgeOne 部署时会从仓库里读取它，所以必须提交到仓库，不要加进 `.gitignore`。
> 缺了这个文件，EdgeOne 会报 `No server-handler detected`，项目会退化成一个纯静态站点。
> 仓库里的 `EdgeOne Artifact Guard` 工作流会在产物过期时自动重建并提交，一般不用手工维护。

存储方面，EdgeOne 的 KV 和 Blob 只会注入给**边缘函数**，Node 云函数拿不到。所以本项目在 EdgeOne 上用了两个入口：

| 文件 | 作用 |
|---|---|
| `api/_makers.ts`（构建产物 `cloud-functions/[[default]].js`） | Node 云函数，后端主体 |
| `functions/*` | 边缘函数，负责 KV 代理和存储探测 |
| `middleware.js` | 边缘中间件，负责前端路由回退 |

`DB_DRIVER` 保持默认的 `auto` 时，程序会按下面的顺序自动选择存储：

1. 外部数据库（如果你配了 `DATABASE_URL`）
2. **KV**：在控制台的「KV 存储」里创建命名空间，然后绑定到**边缘函数**（不是 Node 云函数），绑定变量名填 `KV`，再配置 `EO_KV_URLS` 和 `JWT_SECRET`
3. **Blob**：不需要任何配置，第一次写入时 `@edgeone/pages-blob` 会自动建库

有几个坑要注意（本项目已经处理好了，你自己改配置时留意）：

- `edgeone.json` 里的 `nodeVersion` 必须是平台预装的那几个版本（14.21.3 / 16.20.2 / 18.20.4 / 20.18.0 / 22.11.0），填别的会构建失败
- `maxDuration` 要写在 `cloudFunctions.nodejs` 里面，写成 `cloudFunctions.maxDuration` 不生效
- 前端路由回退由根目录的 `middleware.js` 负责。`edgeone.json` 的 `rewrites` 只对静态资源生效，官方文档明确说不支持前端路由，加 `/*` 反而会命中静态文件
- 不要用 `*.edgeone.cool` 这种临时域名验证存储，这个域名带全站鉴权参数，会拦截边缘函数和云函数之间的 KV 代理请求。请先绑定自定义域名再验证

不想用一键部署按钮的话，也可以用 Makers CLI：

```bash
EO_PAGES_PROJECT=openlist-next \
EO_PAGES_API_TOKEN=<控制台获取的 Token> \
pnpm run deploy:edgeone -- --url https://你的域名 --deep
```

这个脚本会构建、部署，然后自动检查存储是不是真的可用。

### 部署到 Vercel

点了部署按钮之后，部署页面下方会出现 **Marketplace Database Providers** 列表，选一个点「连接」即可。Vercel 会自动把连接信息注入成环境变量，本项目的 `DB_DRIVER=auto` 能识别并自动接上，不用改代码。

支持情况：Neon、Upstash、Supabase、Turso 可以直接用；Nile、Prisma Postgres、AWS RDS 需要一个 Postgres-over-HTTP 网关；Redis（纯 TCP）、MongoDB、Convex、MotherDuck 在边缘环境用不了。完整说明见 [一键连接数据库](./docs/ONE_CLICK_DATABASE.md)。

也可以在 Vercel 控制台里 Import Git Repository，框架检测选 **Other**（配置都写在 `vercel.json` 里），或者用命令行：

```bash
npx vercel login
npx vercel deploy --prod --yes

# 或者一条命令完成构建、部署和存储检查
pnpm run deploy:vercel -- --url https://你的域名
```

Vercel 的函数单次执行上限默认是 10 秒（Pro 是 60 秒），目录很大的时候可能超时，建议用 `DB_FORMAT=map` 减少数据库往返次数。

### 部署到阿里云 ESA

在 ESA 控制台「边缘计算 → 函数和 Pages」里创建项目，导入 GitHub 仓库。构建命令填 `pnpm run build`，静态资源目录填 `./dist`，函数文件路径填 `./dist-server/esa-entry.js`。

也可以用命令行：

```bash
pnpm install
pnpm run build

npx esa-cli login
npx esa-cli commit
npx esa-cli deploy

# 或者一条命令完成构建、提交、部署和存储检查
pnpm run deploy:esa -- --url https://你的域名
```

`esa.jsonc` 里有两个关键配置：

- `entry` 指向 `./dist-server/esa-entry.js`。服务端产物故意放在 `dist-server/` 而不是 `dist/`，否则会被当成静态文件公开下载
- `assets.notFoundStrategy` 设为 `singlePageApplication`。不配这个的话，`/login`、`/@manage/*` 这些前端路由会直接 404

ESA 每个请求对 KV 子请求有次数限制，如果坚持用平台自带的 EdgeKV，建议用 `DB_FORMAT=map`（整个库一个 key，读写各一次）。

### 部署到 Netlify

在 Netlify 里连接 Git 仓库即可，`netlify.toml` 里已经写好了构建配置；也可以用命令行 `netlify deploy --build --prod`。

Netlify 没有平台级存储，必须接外部数据库。环境变量在 **Site configuration → Environment variables** 里配置，例如：

```bash
JWT_SECRET=<随机字符串>
DATABASE_URL=postgres://user:pass@ep-xxx.neon.tech/neondb
DB_FORMAT=map
```

> Netlify Functions 单次执行上限是 10 秒（Pro 是 26 秒），冷启动加上网盘 API 的往返比较容易超时，生产环境建议优先用 Cloudflare Workers。

### 部署到 Node / Docker

这是唯一能用 `DB_DRIVER=mysql` 直连 TCP 的场景。

```bash
pnpm install
pnpm run build
pnpm start
```

环境变量写在根目录的 `.env` 里（`loadEnv.js` 会读取）：

```bash
JWT_SECRET=<随机字符串>
DATABASE_URL=mysql://user:pass@127.0.0.1:3306/openlist
DB_DRIVER=mysql
DB_FORMAT=sql
```

---

## 部署后检查

部署成功和存储可用是两件事。最坏的情况是存储驱动悄悄退回内存模式：站点能打开、能登录，但一重启数据就没了。

```bash
curl https://你的域名/api/public/env_check
```

返回内容里重点看这几个字段：

- `storage.driver`：实际生效的驱动。如果是 `memory`，说明数据不会持久化，必须处理
- `jwt.ready`：`JWT_SECRET` 是否配好了。没配的话，挂载凭据之类的加密字段解不开
- `ready`：整体是否就绪

也可以让统一脚本帮你检查（只检查，不重新部署）：

```bash
pnpm run deploy:edgeone -- --no-deploy --url https://你的域名
pnpm run deploy:esa     -- --no-deploy --url https://你的域名
pnpm run deploy:vercel  -- --no-deploy --url https://你的域名
```

退出码 `0` 表示存储已就绪，`2` 表示还没就绪。EdgeOne 上还会额外读一次 `/storage-probe`，告诉你 KV 和 Blob 分别能不能用。

---

## 技术架构

### 后端

- **运行环境**：Cloudflare Workers / 腾讯云 EdgeOne / 阿里云 ESA / Vercel / Netlify / Node.js 容器
- **Web 框架**：Hono.js
- **语言**：TypeScript
- **构建工具**：Wrangler、esbuild

### 前端

- **框架**：React 19 + TypeScript
- **UI 库**：Ant Design / Material-UI
- **构建工具**：Vite

> 前端不在本仓库里，构建时由 `scripts/fetch-frontend.mjs` 从官方仓库拉取。

---

## 配置

### 数据存储

有两个变量决定数据存在哪里、怎么组织。

**`DB_DRIVER`** —— 数据存在哪里

- `auto`（默认）：自动识别。配了外部数据库就用外部数据库，否则用平台自带的存储
- 平台存储：`kv`、`d1`、`r2`、`blob`、`cfkv`、`do`
- 外部数据库：`neon`、`turso`、`pgrest`、`pghttp`、`mysqlhttp`、`upstash`、`s3`
- `mysql`：只在 Node 容器里可用

**`DB_FORMAT`** —— 数据怎么组织

- `map`（默认）：整个数据库存成一个 JSON，读写各一次，适合 KV 和对象存储
- `key`：每个实体一条记录，比如 `users_1`，实体多的时候比 `map` 省
- `sql`：用关系表存储，表结构和 Go 版 OpenList 一致，可以和 Go 版共用同一个数据库

常用的几种组合：

```bash
# Cloudflare Workers + D1
DB_FORMAT=sql
DB_DRIVER=d1

# EdgeOne + Blob（零配置）
DB_FORMAT=map
DB_DRIVER=blob

# 外部数据库，比如 Neon
DB_FORMAT=map
DB_DRIVER=auto
DATABASE_URL=postgres://user:pass@ep-xxx.neon.tech/neondb
```

### 安全

- `JWT_SECRET`：必填。用于会话签名、挂载凭据加密，也用于定时任务鉴权
- `ADMIN_PASS`：可选。设置后跳过安装向导，直接用这个密码初始化管理员账号

### 外部数据库

只填一条连接串，保持 `DB_DRIVER=auto`，程序会根据协议和主机名自动选择驱动：

| 连接串 | 使用的驱动 |
|---|---|
| `postgres://…@ep-xxx.neon.tech/…` | `neon` |
| `postgresql://…@db.xxx.supabase.co/…` | `pgrest`，需要再填 `SUPABASE_KEY` |
| `libsql://xxx.turso.io` | `turso`，需要再填 `TURSO_AUTH_TOKEN` |
| `redis://xxx.upstash.io` | `upstash` |
| `mysql://…` | `mysqlhttp`，需要再填 `MYSQL_HTTP_URL` |

厂商专属变量（`NEON_DATABASE_URL`、`TURSO_DATABASE_URL` 等）的优先级比 `DATABASE_URL` 高。

完整的驱动列表和各数据库的配置示例见 [外部存储配置指南](./docs/EXTERNAL_STORAGE.md)，变量模板见 [`.dev.vars.example`](./.dev.vars.example)。

### 其他变量

- `ALLOW_URLS`：跨域白名单，逗号分隔。不填则只允许同源请求
- `MAX_UPLOAD`：单次上传大小上限，默认 26214400 字节（25MB）
- `MAX_UPPART`：分片上传的单片大小上限，默认 16777216 字节（16MB）
- `ALLOW_SEED`：允许作为种子数据来源的主机白名单

---

## 常见问题

| 现象 | 原因和处理办法 |
|---|---|
| 提示 `No storage backend is available` | 一个存储绑定都没配。填 `DATABASE_URL`，或者在平台上绑定 KV / D1 |
| 每次重启都要重新初始化 | 数据没有持久化。看 `/api/public/env_check` 返回的 `storage.driver` 是不是 `memory` |
| 页面 404 但 API 正常 | 静态资源没上传。确认构建产出了 `dist/`，并且平台的静态资源目录指向它 |
| 部署到两个平台，数据对不上 | 两边的 `JWT_SECRET` 不一样，加密字段解不开。两边保持一致 |
| 报 `mysql2 is not available` | 在边缘运行时用了 `DB_DRIVER=mysql`，这个驱动只在 Node 容器里可用。改用 `mysqlhttp` |
| Supabase 报 404 | `kv` 表不存在，先执行 `CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);` |

---

## 常用命令

```bash
pnpm run dev:worker     # 启动 Worker 开发服务器
pnpm run dev:unified    # 拉取前端并启动 Worker
pnpm run build          # 构建前端和后端
pnpm run lint           # TypeScript 类型检查
pnpm run test:all       # 运行全部单元测试
pnpm run format         # 用 prettier 格式化代码
```

---

## 帮助支持

在使用过程中遇到问题，可以通过下面的渠道获取帮助：

- 🐛 **提交 Bug 或功能请求**：请前往本仓库 [_Issues_](https://github.com/LegspCpd/openlist-next/issues)
- 💬 **一般性问题与交流**：请前往本仓库 [_Discussions_](https://github.com/LegspCpd/openlist-next/discussions) 讨论区

## 开源许可

本项目基于 [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.txt) 许可证发布。

## 联系我们

🌐 [@LegspCpd](https://github.com/LegspCpd) · 📦 [openlist-next](https://github.com/LegspCpd/openlist-next) · 🐛 [Issues](https://github.com/LegspCpd/openlist-next/issues)

## 贡献者

本项目由 **LegspCpd** 开发与维护。

[![Contributors](https://contrib.rocks/image?repo=LegspCpd/openlist-next)](https://github.com/LegspCpd/openlist-next/graphs/contributors)

---

## 致谢

本项目的设计与实现参考了下面这些开源项目，感谢它们的作者和全体开发者：

- [Alist](https://github.com/AlistGo/alist) 项目作者及全体开发者
- [OpenList](https://github.com/OpenListTeam/OpenList)（Go 版）项目作者及全体开发者
- [OpenList-Worker](https://github.com/OpenListTeam/OpenList-Worker)（官方 TypeScript 移植版）项目作者及全体开发者
- [openlistnext](https://github.com/Polonium-salts/openlistnext) 社区项目作者及全体开发者

> 上面这些项目的开发者**不是**本仓库的贡献者。本仓库由 LegspCpd 独立开发维护，与上述项目及 OpenListTeam 没有隶属、授权或背书关系，只在开源许可允许的范围内借鉴其成果。详见 [NOTICE.md](./NOTICE.md)。
>
> 前端的版权归官方 [OpenList-Frontend](https://github.com/OpenListTeam/OpenList-Frontend) 的开发者所有，本仓库不包含前端源码。
