<div align="center">

# OpenList Next · 社区加速分支

**整合官方全部驱动 · 任意平台直连外部数据库 · 五平台部署**

</div>

> **这是什么**：本仓库是 **LegspCpd 独立开发维护的项目**，以官方 [OpenList-Worker](https://github.com/OpenListTeam/OpenList-Worker) 为技术基线，并借鉴了社区项目 [openlistnext](https://github.com/Polonium-salts/openlistnext) 的部分思路与实现。它保留了官方的全部存储驱动与 API 契约，重点补齐了上游最卡脖子的一环 —— **在任何边缘运行时上直连外部数据库**。
>
> **为什么要这么做**：官方版本中 `mysql` 驱动只能跑在 Node 容器里，一旦部署到 Cloudflare Workers（没有裸 TCP）就只能用平台自带的 KV。本分支新增了 8 个纯 `fetch` 实现的存储驱动，**一条 `DATABASE_URL` 就能接上 Neon、Supabase、Turso、外部 MySQL/MariaDB、Redis、S3**，彻底摆脱平台绑定。
>
> | 相比上游 | 变化 |
> |---|---|
> | 存储驱动 | 7 → **15** 个（新增 neon / turso / pgrest / pghttp / mysqlhttp / upstash / r2 / s3） |
> | SQL 方言 | 2 种（SQLite、MySQL）→ **3 种**（新增 PostgreSQL，含 `$n` 占位符） |
> | 网盘驱动 | 78 → **81** 个（补齐 `123_link`、`ilanzou`、`halalcloud`） |
> | 部署平台 | CF / EdgeOne / ESA → 增加 **Netlify**，并统一了环境变量配置方式 |
>
> 📖 [外部存储配置指南](./docs/EXTERNAL_STORAGE.md) · 🚀 [多平台部署指南](./docs/DEPLOYMENT.md)

---

<div align="center">
  <p><em>OpenList 是一个多功能的目录列表工具，支持数十种网盘挂载与文件预览/下载/分享</em></p>
  <p><b>本仓库是 OpenList Next</b>：以官方 OpenList-Worker 为基线的 TypeScript 社区衍生版，运行于 Cloudflare Workers 等边缘平台</p>

  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue.svg" alt="License" /></a>
  <a href="https://github.com/LegspCpd/openlist-next/issues"><img src="https://img.shields.io/github/issues/LegspCpd/openlist-next" alt="Issues" /></a>

  📖 [外部存储配置](./docs/EXTERNAL_STORAGE.md) · 🚀 [多平台部署](./docs/DEPLOYMENT.md) · ⚖️ [归属与许可声明](./NOTICE.md)
</div>

> [!WARNING]
> **本项目不是 OpenList 官方发布物**，与 OpenListTeam 无任何隶属、授权或背书关系。
> 有问题请在本仓库提 Issue，**不要去上游官方仓库反馈本分支的问题**。
> 代码来源、版权与许可证说明见 [NOTICE.md](./NOTICE.md)。

---

## 一键部署

| 平台 | 一键部署入口 | 存储方案 |
|---|---|---|
| **Cloudflare Workers** | `pnpm run build && pnpm wrangler deploy`（KV 由 wrangler 自动预配） | KV / D1 / R2 / Neon |
| **Vercel** | [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/LegspCpd/openlist-next) | 部署页下方 **Marketplace 一键连接数据库**（Neon / Upstash / Supabase / Turso …），变量自动识别 |
| **EdgeOne Pages** | 控制台接入 Git 仓库（Makers 部署） | **自动探测 KV（优先）→ Blob**；Blob 零配置，首次写入自动建库 |
| **阿里云 ESA** | 控制台导入 GitHub 仓库 | EdgeKV（优先） / 外部库 |
| **Netlify** | [![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/LegspCpd/openlist-next) | Neon / Supabase / Upstash |

> **部署 ≠ 存储可用。** 部署完成后跑一次探测，确认数据真的会持久化：
>
> ```bash
> pnpm run deploy:vercel -- --no-deploy --url https://<你的域名>
> # 或 deploy:edgeone / deploy:esa
> ```
>
> 它会读 `/api/public/env_check`（EdgeOne 上还会读 `/storage-probe`），
> 直接告诉你「当前实际用的驱动 / 是否持久化 / 还差什么」。

- 📖 [多平台部署指南](./docs/DEPLOYMENT.md)
- 🗄️ [一键连接数据库（Vercel Marketplace 支持矩阵）](./docs/ONE_CLICK_DATABASE.md)
- 🔌 [外部存储配置](./docs/EXTERNAL_STORAGE.md)

---

## 快速开始：部署到 Cloudflare Workers

> 推荐先用 Workers 验证 —— 这是本项目支持最完整的目标平台。

### 前置条件

- Node.js **>= 22**（与 `package.json` 的 `engines` 及各平台运行时一致）
- **pnpm**（本项目锁定 `pnpm@9.15.4`）
- 一个 Cloudflare 账号

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
```

### 安装依赖

```bash
git clone https://github.com/LegspCpd/openlist-next.git
cd openlist-next
pnpm install
```

> 依赖里有 2 个 GitHub 源依赖（`@hope-ui/solid`、`mpegts.js`），首次安装较慢属正常现象。

### 本地开发

```bash
cp .dev.vars.example .dev.vars
openssl rand -hex 32        # 生成 JWT_SECRET，填入上一步的文件
pnpm run dev:worker         # 等价于 wrangler dev
```

`.dev.vars` 最小配置：

```ini
JWT_SECRET=<随机 32 字节十六进制>
ADMIN_PASS=<管理员初始密码，可选；不设则走安装向导>
DB_DRIVER=auto
DB_FORMAT=map
```

### 构建

```bash
pnpm run build
```

构建分两步：先拉取官方前端 `OpenList-Frontend` 编译出 `dist/`，再编译后端到 `dist-server/`。
本地已有前端产物时用 `FRONTEND_DIST=/path/to/dist pnpm run build` 可跳过克隆。

### 部署

```bash
pnpm run build                     # 必须先构建：assets 依赖 ./dist，缺失时 wrangler 会报目录不存在
npx wrangler login
npx wrangler secret put JWT_SECRET # 生产密钥，务必与开发环境不同
pnpm run deploy:worker             # 等价于 wrangler deploy --yes
```

> [!CAUTION]
> **`wrangler deploy` / `wrangler dev` 之前必须先 `pnpm run build`**。
> `wrangler.jsonc` 的 `assets.directory` 指向 `./dist`，而 `dist` 默认不存在（已被 `.gitignore` 忽略）。
> 直接跑会报 `The directory specified by the "assets.directory" field ... does not exist` 并中止。
> 用 Cloudflare 一键部署按钮时平台会自动执行 build，不受此限制。

部署后在 Worker 后台确认变量：

| 变量 | 说明 |
| --- | --- |
| `JWT_SECRET` | 必填，用于签名会话与加密挂载凭据 |
| `ADMIN_PASS` | 可选，设置后跳过安装向导 |
| `DB_DRIVER` | `auto` / `kv` / `d1` / `cfkv` / `blob` / `neon` / `turso` / `pgrest` / `pghttp` / `mysqlhttp` / `upstash` / `r2` / `s3` |
| `DB_FORMAT` | `map`（默认）/ `key` / `sql` |
| `DATABASE_URL` | 可选，一条连接串自动识别外部数据库 |

> [!CAUTION]
> **不要配 `DB_DRIVER=mysql`** —— Cloudflare Workers 没有裸 TCP，MySQL 驱动不会可用。
> 外部 MySQL/MariaDB 请走 `mysqlhttp`（HTTP 网关），或改用 `neon` / `turso`，
> 见 [外部存储配置指南](./docs/EXTERNAL_STORAGE.md)。

### 排障：部署成功但打不开（Error 1101）

Cloudflare 的 **Error 1101** 表示 Worker 运行时抛了未捕获异常，不是网络问题。
按下面顺序排查：

```bash
curl https://<你的域名>/healthz       # 看 persistence.checks 的报错说明
```

| 症状 | 原因 | 处理 |
| --- | --- | --- |
| 提示 `No storage backend is available` | 一个存储绑定都没配 | `wrangler.jsonc` 已默认绑定 KV（`openlist-next-kv`，首次部署自动创建）；若你删掉了该绑定，请加回，或配置 `DATABASE_URL` |
| 能登录但重启后掉线、或提示凭据无法解密 | `JWT_SECRET` 未设或前后不一致 | `npx wrangler secret put JWT_SECRET`，部署环境务必各用各的值 |
| 配了外部数据库却仍读写平台 KV | `DB_DRIVER` 被显式写成了平台驱动 | 改回 `auto`；外部数据库探测优先于平台绑定 |
| 用 `MYSQL_URLS` 连外部 MySQL，控制台提示进 | Workers 无裸 TCP，`mysql` 驱动不可用 | 改用 `mysqlhttp` / `neon` / `turso`，见 [外部存储配置指南](./docs/EXTERNAL_STORAGE.md) |

调试 realtime 日志：

```bash
npx wrangler tail
```

### 常用检查命令

```bash
pnpm run lint           # 全量 tsc 类型检查
pnpm run test:all       # 全量单元测试
pnpm run test:dialect   # SQL 方言
pnpm run test:dsn       # 连接串解析
pnpm run test:http-sql  # HTTP SQL 驱动
pnpm run format         # prettier 格式化
```

---

## 一键部署

<div align="center">

| Cloudflare Workers |
| :---: |
| [![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/LegspCpd/openlist-next) |

</div>

> [!IMPORTANT]
> - 若 Cloudflare 提示「无法获取存储库内容」，先 Fork 本仓库，再用「连接到 GitHub 仓库」方式部署。
> - 部署完成后务必设置 `JWT_SECRET`，否则每次冷启动会话都会失效。
> - EdgeOne Makers / 阿里云 ESA / Vercel / Netlify 见 [多平台部署指南](./docs/DEPLOYMENT.md)。

> [!NOTE]
> 下方「功能简介」描述的是上游 OpenList 的整体能力。本分支未对全部功能做回归验证，请以实测为准。


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
- **认证方式**：内置账号密码，支持TOTP验证、WebAuthn/FIDO登录、SSO单点登录与 LDAP 目录认证。
- **安全加固**：JWT 会话、CSRF 防护、点击劫持防护（X-Frame-Options）、内容安全策略（CSP）。
- **健康检查**：提供 `/health` 存活探针与 `/healthz` 就绪探针，可用于监控与告警。

### 平台部署

- **运行平台**：Cloudflare Workers、腾讯云 EdgeOne Makers、Vercel、Serverless  及 Node.js 容器环境。
- **数据存储**：Cloudflare D1（SQLite）为主，同时支持 MySQL、MariaDB、PostgreSQL、SQL Server。
- **持久缓存**：Cloudflare KV / EdgeOne Blob（可选），用于配置持久化与缓存。
- **一键部署**：支持 EdgeOne、Cloudflare Workers 等平台的一键部署按钮+初始化。

---

## 手动部署

### 前置要求

- Node.js 18+（推荐使用 pnpm）
- Cloudflare 账号（用于部署到 Workers）

### 本地开发

```bash
# 1. 安装依赖
pnpm install

# 2. 编辑 wrangler.jsonc / .env，配置 JWT_SECRET 与存储（KV/D1 在控制台绑定）

# 3. 启动开发服务器（自动拉取官方前端并运行 Worker）
pnpm run dev:unified

# 或仅运行 Worker（不拉取前端）
pnpm run dev:worker
```

### 生产部署

```bash
# 一键部署：确保 KV namespace 存在 → 拉取官方前端 → 部署到 Cloudflare Workers
pnpm run deploy

# 或直接部署 Worker（跳过 KV 检查与前端构建）
pnpm run deploy:worker
```

---

## 技术架构

### 后端

- **运行环境**：Cloudflare Workers（Edge Computing）
- **Web 框架**：Hono.js
- **数据库**：Cloudflare D1（SQLite）/ 支持 MySQL、MariaDB、PostgreSQL、SQL Server
- **缓存**：Cloudflare KV（可选）
- **语言**：TypeScript
- **构建工具**：Wrangler、esbuild

### 前端

- **框架**：React 19 + TypeScript
- **UI 库**：Ant Design / Material-UI
- **构建工具**：Vite

---


## 配置

### 环境变量

#### 数据库配置

**DB_FORMAT**（数据存储格式）
- `map`（默认）：整对象 JSON 格式，适用于 KV/Blob 等简单存储
- `key`：分 key 存储格式，每个实体一条记录（如 `users_1`），避免大 JSON
- `sql`：关系数据库表格式，与 Go 后端完全一致，适用于 D1/MySQL

**DB_DRIVER**（数据库驱动）
- `auto`（默认）：自动检测可用驱动（优先级：mysql → d1 → kv → cfkv → blob → do）
- `blob`：EdgeOne Blob Storage（SDK）/ ESA Blob（binding）
- `cfkv`：Cloudflare KV REST API（需配置 `CF_ACCOUNT`、`CF_KV_UUID`、`CF_API_KEY`）
- `kv`：KV 存储（binding 名固定为 `KV`；EdgeOne Node 云函数自动走 HTTP 代理模式）
- `d1`：Cloudflare D1（SQLite）
- `do`：Cloudflare Durable Objects（SQLite）
- `mysql`：MySQL（仅 Node.js 容器）

**推荐配置组合：**
```bash
# Cloudflare Workers + D1（推荐）
DB_FORMAT=sql
DB_DRIVER=d1

# EdgeOne + Blob（推荐，零配置）
DB_FORMAT=map
DB_DRIVER=blob

# EdgeOne / Cloudflare KV（自动适配环境）
DB_FORMAT=map
DB_DRIVER=kv

# Cloudflare KV（高频读写，需绑定）
DB_FORMAT=key
DB_DRIVER=kv

# 远程访问 Cloudflare KV
DB_FORMAT=key
DB_DRIVER=cfkv
CF_ACCOUNT=your_account_id
CF_KV_UUID=your_namespace_id
CF_API_KEY=your_api_token
```

**向后兼容：**
- `DB_DRIVER=json` 自动转换为 `DB_FORMAT=map` + 自动检测驱动

**表名对齐（仅 SQL 格式）：**
`sql` 格式采用列式表，命名策略与 Go 后端的 GORM 一致（snake_case + 复数表名 + 前缀）：

| Go 结构体     | 表名                |
| :------------ | :------------------ |
| `SettingItem` | `x_setting_items`   |
| `SharingDB`   | `x_sharing_dbs`     |
| `Storage`     | `x_storages`        |
| `User`        | `x_users`           |
| `Meta`        | `x_metas`           |
| （仅 TS）     | `x_plugins`         |

前缀固定为 `x_`（与 Go 后端默认值一致）。要与 Go 后端共享同一物理数据库，无需额外配置。

#### 安全配置

- `JWT_SECRET`：JWT 令牌签名密钥（必填），**同时用于数据加密与定时任务鉴权**
- `ADMIN_PASS`：初始管理员密码（可选，设置后跳过安装向导自动初始化 admin）

#### 其他配置

更多配置项见本仓库的 [外部存储配置指南](./docs/EXTERNAL_STORAGE.md) 与 [多平台部署指南](./docs/DEPLOYMENT.md)。

通用配置的权威说明在上游官方文档：<https://doc.oplist.org/guide/configuration>（非本项目文档，仅供参考）。

---


## 帮助支持

在使用过程中遇到问题，可通过以下渠道获取帮助：

- 🐛 **提交 Bug 或功能请求**：请前往本仓库 [_Issues_](https://github.com/LegspCpd/openlist-next/issues)
- 💬 **一般性问题与交流**：请前往本仓库 [_Discussions_](https://github.com/LegspCpd/openlist-next/discussions) 讨论区

## 开源许可

`OpenList` 是基于 [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.txt) 许可证的开源软件。


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
