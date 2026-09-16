<div align="center">

# OpenList Next

<p><em>OpenList 是一個多功能的目錄列表工具，可以把分散在多種網盤、物件儲存和協定服務裡的檔案集中到一個介面，進行瀏覽、預覽、下載和分享</em></p>
<p>本倉庫是官方 <a href="https://github.com/OpenListTeam/OpenList-Worker">OpenList-Worker</a> 的社群衍生版，用 TypeScript 編寫，可以部署到 Cloudflare Workers、騰訊雲 EdgeOne、阿里雲 ESA 等邊緣平台</p>
<p>在官方版本的基礎上，本專案補上了「在任何邊緣平台上直連外部資料庫」這件事</p>

<a href="../LICENSE"><img src="https://img.shields.io/github/license/LegspCpd/openlist-next" alt="License" /></a>
<a href="https://github.com/LegspCpd/openlist-next/actions/workflows/edgeone-artifact-guard.yml"><img src="https://img.shields.io/github/actions/workflow/status/LegspCpd/openlist-next/edgeone-artifact-guard.yml?branch=main" alt="Build status" /></a>
<a href="https://github.com/LegspCpd/openlist-next/issues"><img src="https://img.shields.io/github/issues/LegspCpd/openlist-next" alt="Issues" /></a>
<a href="https://github.com/LegspCpd/openlist-next/discussions"><img src="https://img.shields.io/github/discussions/LegspCpd/openlist-next?color=%23ED8936" alt="Discussions" /></a>

📖 [多平台部署指南](../docs/DEPLOYMENT.md) · 🗄️ [外部存储配置](../docs/EXTERNAL_STORAGE.md) · 🔌 [一键连接数据库](../docs/ONE_CLICK_DATABASE.md)

</div>

<div align="center">

[English](README_en.md) | [简体中文](../README.md) | 繁體中文 | [日本語](README_ja.md) | [한국어](README_ko.md) | [Français](README_fr.md)

[上游專案](https://github.com/OpenListTeam/OpenList-Worker) · [貢獻指南](../CONTRIBUTING.md) · [許可證](../LICENSE) · [來源與許可聲明](../NOTICE.md)

</div>

> [!WARNING]
> 本專案**不是** OpenList 官方發布物，與 OpenListTeam 沒有任何隸屬、授權或背書關係。
> 使用中遇到問題，請在本倉庫提 Issue，不要到官方倉庫回饋。
> 程式碼來源、版權與許可證說明見 [NOTICE.md](../NOTICE.md)。

---

## 一鍵部署

點擊下面的按鈕，可以把本專案部署到對應的平台：

<div align="center">

| EdgeOne · 國際站 | EdgeOne · 中國站 | Cloudflare Workers |
| :---: | :---: | :---: |
| [![使用 EdgeOne 部署](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?project-name=openlist-next&repository-url=https://github.com/LegspCpd/openlist-next&install-command=pnpm%20install%20--no-frozen-lockfile&build-command=pnpm%20run%20build&output-directory=dist&env=JWT_SECRET) | [![使用 EdgeOne 部署](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://console.cloud.tencent.com/edgeone/makers/new?project-name=openlist-next&repository-url=https://github.com/LegspCpd/openlist-next&install-command=pnpm%20install%20--no-frozen-lockfile&build-command=pnpm%20run%20build&output-directory=dist&env=JWT_SECRET) | [![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/LegspCpd/openlist-next) |

| Vercel | Netlify |
| :---: | :---: |
| [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/LegspCpd/openlist-next) | [![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/LegspCpd/openlist-next) |

</div>

部署完成後還需要設定環境變數，其中 `JWT_SECRET` 是必填的，可以用 `openssl rand -hex 32` 生成。

- EdgeOne：[國際站控制台](https://console.edgeone.ai/makers) · [中國站控制台](https://console.cloud.tencent.com/edgeone/makers)
- Cloudflare：[Worker 後台](https://dash.cloudflare.com/)
- Vercel：專案設定 → Environment Variables
- Netlify：Site configuration → Environment variables

常用的幾個變數：

- `JWT_SECRET`：會話簽章和欄位加密用的金鑰，**必填**
- `ADMIN_PASS`：可選，設定後跳過安裝精靈，直接用這個密碼初始化管理員帳號
- `DB_FORMAT`：資料怎麼組織，`map`（預設）/ `key` / `sql`
- `DB_DRIVER`：資料存在哪裡，`auto`（預設，自動識別）/ `kv` / `d1` / `blob` / `neon` / `turso` / …
- `DATABASE_URL`：外部資料庫連線串。填了它並保持 `DB_DRIVER=auto`，程式會自動接上

> [!IMPORTANT]
> 如果 Cloudflare 提示「無法取得儲存庫內容」，先 [Fork](https://github.com/LegspCpd/openlist-next/fork) 本倉庫，再用「連線到 GitHub 倉庫」的方式部署。

---

## 功能簡介

OpenList 是一個運行於邊緣運算平台的多儲存聚合檔案列表與管理系統，可將分散在不同網盤、物件儲存與協定服務中的檔案統一到一個介面，進行瀏覽、預覽、下載與管理。

OpenList-Worker 是官方 [OpenListTeam/OpenList](https://github.com/OpenListTeam/OpenList) 專案的 TypeScript + Serverless 移植版，後端由 Go 重寫為運行於 Workers 的 TypeScript 服務，前端保持一致的介面與互動體驗。

### 儲存聚合

內建 **81 個儲存驅動**，開箱即用掛載各類儲存後端：

- **國內網盤**：阿里雲盤（開放平台/分享）、夸克網盤（開放平台/UC TV 版）、百度網盤（相簿）、115 網盤（開放平台/分享）、123 雲盤（開放平台/分享）、天翼雲盤（189/PC/TV）、中國移動雲盤（139/和彩雲）、沃家雲盤、迅雷雲盤、騰訊微雲、藍奏雲、PikPak（分享）、豆包網盤、光亞盤、超星小組網盤、聯想 NAS 分享、Teambition 網盤、WPS 網盤、阿里文件、HalalCloud、MediaTrack 等
- **國際網盤**：Google Drive（相簿）、OneDrive（應用/分享連結）、Dropbox、MEGA、MediaFire、Proton Drive、Yandex Disk、Degoo、Bunny Storage、TeraBox 等
- **物件儲存**：S3 相容（AWS/OSS/COS/MinIO 等）、又拍雲 USS、Azure Blob、WebDAV、FTP、SFTP、SMB、IPFS 等
- **程式碼託管**：GitHub、GitHub Releases、CNB Releases
- **網盤程式**：OpenList（分享）、AList V3、Cloudreve V3/V4、Kodbox（可道雲）、Seafile、Teldrive、Febbox 等
- **其他驅動**：網易雲音樂、Misskey、Emby、Cloudflare 圖床等

除上述真實儲存外，還提供 `Local`、`Alias`、`UrlTree`、`AutoIndex`、`Strm`、`Crypt`、`Virtual`、`Chunk` 等虛擬/功能型驅動，可用於本地掛載、地址別名、URL 列表、加密儲存與分片等場景。

### 核心能力

- **檔案瀏覽**：統一的目錄樹瀏覽，支援圖片、影片、音訊、文件、程式碼、壓縮檔等格式線上預覽。
- **上傳下載**：跨儲存的上傳、批次下載、串流傳輸與直鏈跳轉。
- **檔案分享**：生成帶有效期、密碼與權限控制的分享連結，支援匿名存取與目錄分享。
- **全文搜尋**：在已索引的儲存中快速檢索檔案。
- **離線任務**：後台任務佇列，支援批次操作與非同步處理。
- **外部介面**：將聚合儲存以 WebDAV 或 S3 相容協定對外暴露，便於掛載到第三方工具。
- **MCP 服務**：提供 Model Context Protocol 端點，可被 AI 助手等用戶端整合呼叫。

### 權限管理

- **權限管理**：基於角色的存取控制（RBAC），支援使用者分組、目錄級讀寫權限與配額。
- **認證方式**：內建帳號密碼，支援 TOTP 驗證、WebAuthn/FIDO 登入、SSO 單點登入與 LDAP 目錄認證。
- **安全加固**：JWT 會話、CSRF 防護、點擊劫持防護（X-Frame-Options）、內容安全策略（CSP）。
- **健康檢查**：提供 `/health` 存活探針與 `/healthz` 就緒探針，可用於監控與告警。

### 平台部署

- **運行平台**：Cloudflare Workers、騰訊雲 EdgeOne Makers、阿里雲 ESA、Vercel、Netlify 及 Node.js 容器環境。
- **資料儲存**：平台自帶儲存（KV / D1 / Blob …）或任意外部資料庫。
- **一鍵部署**：支援 EdgeOne、Cloudflare Workers、Vercel、Netlify 的一鍵部署按鈕。

---

## 和官方版本有哪些不同

| | 官方 OpenList-Worker | 本專案 |
|---|---|---|
| 儲存驅動 | 7 個 | 15 個，新增 neon / turso / pgrest / pghttp / mysqlhttp / upstash / r2 / s3 |
| SQL 方言 | SQLite、MySQL | 增加 PostgreSQL（含 `$n` 佔位符） |
| 網盤驅動 | 78 個 | 81 個，補齊 `123_link`、`ilanzou`、`halalcloud` |
| 部署平台 | Cloudflare Workers、EdgeOne、ESA、Serverless | 增加 Vercel、Netlify、Node/Docker |

官方版本裡的 `mysql` 驅動只能跑在 Node 容器中——Cloudflare Workers 沒有裸 TCP，部署到邊緣就只能使用平台自帶的 KV。本專案新增的 8 個儲存驅動全部基於 `fetch` 實現，所以在邊緣執行時也能連外部資料庫，填一條 `DATABASE_URL` 就行。

詳細說明見 [外部儲存配置指南](../docs/EXTERNAL_STORAGE.md)。

---

## 手動部署

### 前置要求

- Node.js **22.x**
- pnpm **9.15.4**（透過 corepack 啟用）
- 部署到 Cloudflare Workers 的話，需要一個 Cloudflare 帳號

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
```

### 本地開發

```bash
git clone https://github.com/LegspCpd/openlist-next.git
cd openlist-next
pnpm install

cp .dev.vars.example .dev.vars
openssl rand -hex 32        # 生成 JWT_SECRET，填進上面那個檔案

pnpm run dev:unified        # 拉取官方前端並啟動 Worker
pnpm run dev:worker         # 只啟動 Worker
```

> `pnpm run build` 會先複製官方前端倉庫 OpenList-Frontend 並編譯出 `dist/`，再編譯後端到 `dist-server/`。
> 如果本地已經有前端產物，可以用 `FRONTEND_DIST=/path/to/dist pnpm run build` 跳過複製。
> 依賴裡有兩個來自 GitHub 的套件（`@hope-ui/solid`、`mpegts.js`），首次安裝比較慢是正常的。

### 部署到 Cloudflare Workers

用命令列：

```bash
npx wrangler login
openssl rand -hex 32 | npx wrangler secret put JWT_SECRET

pnpm run build
pnpm run deploy:worker
```

也可以在 Cloudflare 後台連線 Git 倉庫：建構指令填 `pnpm run build`，輸出目錄不用填，wrangler 會讀 `wrangler.jsonc`。

關於儲存：`wrangler.jsonc` 裡已經預設宣告了一個 KV 綁定，第一次部署時 wrangler 會自動建立 `openlist-next-kv` 並綁定，之後每次部署都會複用，不用手動建立。想改用 D1、R2 或 Durable Objects，把 `wrangler.jsonc` 裡對應的註解打開就行，具體寫法都寫在檔案的註解裡了。

> 注意：在本地執行 `wrangler deploy` 或 `wrangler dev` 之前，一定要先跑 `pnpm run build`。
> `wrangler.jsonc` 裡的 `assets.directory` 指向 `./dist`，而這個目錄預設不存在（被 `.gitignore` 忽略了），
> 直接跑會報 `The directory specified by the "assets.directory" field ... does not exist`。
> 用一鍵部署按鈕或在後台連線 Git 倉庫時，平台會自動建構，不受影響。

> 不要把 `DB_DRIVER` 設成 `mysql` —— Cloudflare Workers 沒有裸 TCP，這個驅動在邊緣跑不起來。
> 要連外部 MySQL，請用 `mysqlhttp`（需要自建一個 HTTP 閘道），或者換成 `neon` / `turso`。

### 部署到騰訊雲 EdgeOne

[國際站](https://edgeone.ai/) 和 [中國站](https://console.cloud.tencent.com/edgeone) 都可以。

可以點上面的一鍵部署按鈕，也可以在控制台裡建立專案並匯入 Git 倉庫，建構指令填 `pnpm run build`，輸出目錄填 `dist`。這些配置在 `edgeone.json` 裡也有，實際以檔案為準。

> **重要**：`cloud-functions/[[default]].js` 是建構產物，但 EdgeOne 部署時會從倉庫裡讀取它，所以必須提交到倉庫，不要加進 `.gitignore`。
> 缺了這個檔案，EdgeOne 會報 `No server-handler detected`，專案會退化成一個純靜態站點。
> 倉庫裡的 `EdgeOne Artifact Guard` 工作流會在產物過期時自動重建並提交，一般不用手工維護。

儲存方面，EdgeOne 的 KV 和 Blob 只會注入給**邊緣函式**，Node 雲函式拿不到。所以本專案在 EdgeOne 上用了兩個入口：

| 檔案 | 作用 |
|---|---|
| `api/_makers.ts`（建構產物 `cloud-functions/[[default]].js`） | Node 雲函式，後端主體 |
| `functions/*` | 邊緣函式，負責 KV 代理和儲存探測 |
| `middleware.js` | 邊緣中介層，負責前端路由回退 |

`DB_DRIVER` 保持預設的 `auto` 時，程式會按下面的順序自動選擇儲存：

1. 外部資料庫（如果你設定了 `DATABASE_URL`）
2. **KV**：在控制台的「KV 儲存」裡建立命名空間，然後綁定到**邊緣函式**（不是 Node 雲函式），綁定變數名填 `KV`，再設定 `EO_KV_URLS` 和 `JWT_SECRET`
3. **Blob**：不需要任何設定，第一次寫入時 `@edgeone/pages-blob` 會自動建庫

有幾個坑要注意（本專案已經處理好了，你自己改設定時留意）：

- `edgeone.json` 裡的 `nodeVersion` 必須是平台預裝的那幾個版本（14.21.3 / 16.20.2 / 18.20.4 / 20.18.0 / 22.11.0），填別的會建構失敗
- `maxDuration` 要寫在 `cloudFunctions.nodejs` 裡面，寫成 `cloudFunctions.maxDuration` 不生效
- 前端路由回退由根目錄的 `middleware.js` 負責。`edgeone.json` 的 `rewrites` 只對靜態資源生效，官方文件明確說不支援前端路由，加 `/*` 反而會命中靜態檔案
- 不要用 `*.edgeone.cool` 這種臨時網域驗證儲存，這個網域帶全站鑑權參數，會攔截邊緣函式和雲函式之間的 KV 代理請求。請先綁定自訂網域再驗證

不想用一鍵部署按鈕的話，也可以用 Makers CLI：

```bash
EO_PAGES_PROJECT=openlist-next \
EO_PAGES_API_TOKEN=<控制台取得的 Token> \
pnpm run deploy:edgeone -- --url https://你的網域 --deep
```

這個腳本會建構、部署，然後自動檢查儲存是不是真的可用。

### 部署到 Vercel

點了部署按鈕之後，部署頁面下方會出現 **Marketplace Database Providers** 列表，選一點「連線」即可。Vercel 會自動把連線資訊注入成環境變數，本專案的 `DB_DRIVER=auto` 能識別並自動接上，不用改程式碼。

支援情況：Neon、Upstash、Supabase、Turso 可以直接用；Nile、Prisma Postgres、AWS RDS 需要一個 Postgres-over-HTTP 閘道；Redis（純 TCP）、MongoDB、Convex、MotherDuck 在邊緣環境用不了。完整說明見 [一鍵連線資料庫](../docs/ONE_CLICK_DATABASE.md)。

也可以在 Vercel 控制台裡 Import Git Repository，框架檢測選 **Other**（配置都寫在 `vercel.json` 裡），或者用命令列：

```bash
npx vercel login
npx vercel deploy --prod --yes

# 或者一條指令完成建構、部署和儲存檢查
pnpm run deploy:vercel -- --url https://你的網域
```

Vercel 的函式單次執行上限預設是 10 秒（Pro 是 60 秒），目錄很大的時候可能逾時，建議用 `DB_FORMAT=map` 減少資料庫往返次數。

### 部署到阿里雲 ESA

在 ESA 控制台「邊緣運算 → 函式和 Pages」裡建立專案，匯入 GitHub 倉庫。建構指令填 `pnpm run build`，靜態資源目錄填 `./dist`，函式檔案路徑填 `./dist-server/esa-entry.js`。

也可以用命令列：

```bash
pnpm install
pnpm run build

npx esa-cli login
npx esa-cli commit
npx esa-cli deploy

# 或者一條指令完成建構、提交、部署和儲存檢查
pnpm run deploy:esa -- --url https://你的網域
```

`esa.jsonc` 裡有兩個關鍵配置：

- `entry` 指向 `./dist-server/esa-entry.js`。伺服器端產物故意放在 `dist-server/` 而不是 `dist/`，否則會被當成靜態檔案公開下載
- `assets.notFoundStrategy` 設為 `singlePageApplication`。不配這個的話，`/login`、`/@manage/*` 這些前端路由會直接 404

ESA 每個請求對 KV 子請求有次數限制，如果堅持用平台自帶的 EdgeKV，建議用 `DB_FORMAT=map`（整個庫一個 key，讀寫各一次）。

### 部署到 Netlify

在 Netlify 裡連線 Git 倉庫即可，`netlify.toml` 裡已經寫好了建構配置；也可以用命令列 `netlify deploy --build --prod`。

Netlify 沒有平台級儲存，必須接外部資料庫。環境變數在 **Site configuration → Environment variables** 裡設定，例如：

```bash
JWT_SECRET=<隨機字串>
DATABASE_URL=postgres://user:pass@ep-xxx.neon.tech/neondb
DB_FORMAT=map
```

> Netlify Functions 單次執行上限是 10 秒（Pro 是 26 秒），冷啟動加上網盤 API 的往返比較容易逾時，生產環境建議優先用 Cloudflare Workers。

### 部署到 Node / Docker

這是唯一能用 `DB_DRIVER=mysql` 直連 TCP 的場景。

```bash
pnpm install
pnpm run build
pnpm start
```

環境變數寫在根目錄的 `.env` 裡（`loadEnv.js` 會讀取）：

```bash
JWT_SECRET=<隨機字串>
DATABASE_URL=mysql://user:pass@127.0.0.1:3306/openlist
DB_DRIVER=mysql
DB_FORMAT=sql
```

---

## 部署後檢查

部署成功和儲存可用是兩件事。最壞的情況是儲存驅動悄悄退回記憶體模式：站點能打開、能登入，但一重啟資料就沒了。

```bash
curl https://你的網域/api/public/env_check
```

回傳內容裡重點看這幾個欄位：

- `storage.driver`：實際生效的驅動。如果是 `memory`，說明資料不會持久化，必須處理
- `jwt.ready`：`JWT_SECRET` 是否設定了。沒設定的話，掛載憑據之類的加密欄位解不開
- `ready`：整體是否就緒

也可以讓統一腳本幫你檢查（只檢查，不重新部署）：

```bash
pnpm run deploy:edgeone -- --no-deploy --url https://你的網域
pnpm run deploy:esa     -- --no-deploy --url https://你的網域
pnpm run deploy:vercel  -- --no-deploy --url https://你的網域
```

退出碼 `0` 表示儲存已就緒，`2` 表示還沒就緒。EdgeOne 上還會額外讀一次 `/storage-probe`，告訴你 KV 和 Blob 分別能不能用。

---

## 技術架構

### 後端

- **運行環境**：Cloudflare Workers / 騰訊雲 EdgeOne / 阿里雲 ESA / Vercel / Netlify / Node.js 容器
- **Web 框架**：Hono.js
- **語言**：TypeScript
- **建構工具**：Wrangler、esbuild

### 前端

- **框架**：React 19 + TypeScript
- **UI 庫**：Ant Design / Material-UI
- **建構工具**：Vite

> 前端不在本倉庫裡，建構時由 `scripts/fetch-frontend.mjs` 從官方倉庫拉取。

---

## 配置

### 資料儲存

有兩個變數決定資料存在哪裡、怎麼組織。

**`DB_DRIVER`** —— 資料存在哪裡

- `auto`（預設）：自動識別。設定了外部資料庫就用外部資料庫，否則用平台自帶的儲存
- 平台儲存：`kv`、`d1`、`r2`、`blob`、`cfkv`、`do`
- 外部資料庫：`neon`、`turso`、`pgrest`、`pghttp`、`mysqlhttp`、`upstash`、`s3`
- `mysql`：只在 Node 容器裡可用

**`DB_FORMAT`** —— 資料怎麼組織

- `map`（預設）：整個資料庫存成一個 JSON，讀寫各一次，適合 KV 和物件儲存
- `key`：每個實體一條記錄，比如 `users_1`，實體多的時候比 `map` 省
- `sql`：用關聯表儲存，表結構和 Go 版 OpenList 一致，可以和 Go 版共用同一個資料庫

常用的幾種組合：

```bash
# Cloudflare Workers + D1
DB_FORMAT=sql
DB_DRIVER=d1

# EdgeOne + Blob（零配置）
DB_FORMAT=map
DB_DRIVER=blob

# 外部資料庫，比如 Neon
DB_FORMAT=map
DB_DRIVER=auto
DATABASE_URL=postgres://user:pass@ep-xxx.neon.tech/neondb
```

### 安全

- `JWT_SECRET`：必填。用於會話簽章、掛載憑據加密，也用於定時任務鑑權
- `ADMIN_PASS`：可選。設定後跳過安裝精靈，直接用這個密碼初始化管理員帳號

### 外部資料庫

只填一條連線串，保持 `DB_DRIVER=auto`，程式會根據協定和主機名自動選擇驅動：

| 連線串 | 使用的驅動 |
|---|---|
| `postgres://…@ep-xxx.neon.tech/…` | `neon` |
| `postgresql://…@db.xxx.supabase.co/…` | `pgrest`，需要再填 `SUPABASE_KEY` |
| `libsql://xxx.turso.io` | `turso`，需要再填 `TURSO_AUTH_TOKEN` |
| `redis://xxx.upstash.io` | `upstash` |
| `mysql://…` | `mysqlhttp`，需要再填 `MYSQL_HTTP_URL` |

廠商專屬變數（`NEON_DATABASE_URL`、`TURSO_DATABASE_URL` 等）的優先級比 `DATABASE_URL` 高。

完整的驅動列表和各資料庫的配置範例見 [外部儲存配置指南](../docs/EXTERNAL_STORAGE.md)，變數模板見 [`.dev.vars.example`](../.dev.vars.example)。

### 其他變數

- `ALLOW_URLS`：跨域白名單，逗號分隔。不填則只允許同源請求
- `MAX_UPLOAD`：單次上傳大小上限，預設 26214400 位元組（25MB）
- `MAX_UPPART`：分片上傳的單片大小上限，預設 16777216 位元組（16MB）
- `ALLOW_SEED`：允許作為種子資料來源的主機白名單

---

## 常見問題

| 現象 | 原因和處理辦法 |
|---|---|
| 提示 `No storage backend is available` | 一個儲存綁定都沒配。填 `DATABASE_URL`，或者在平台上綁定 KV / D1 |
| 每次重啟都要重新初始化 | 資料沒有持久化。看 `/api/public/env_check` 回傳的 `storage.driver` 是不是 `memory` |
| 頁面 404 但 API 正常 | 靜態資源沒上傳。確認建構產出了 `dist/`，並且平台的靜態資源目錄指向它 |
| 部署到兩個平台，資料對不上 | 兩邊的 `JWT_SECRET` 不一樣，加密欄位解不開。兩邊保持一致 |
| 報 `mysql2 is not available` | 在邊緣執行時用了 `DB_DRIVER=mysql`，這個驅動只在 Node 容器裡可用。改用 `mysqlhttp` |
| Supabase 報 404 | `kv` 表不存在，先執行 `CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);` |

---

## 常用命令

```bash
pnpm run dev:worker     # 啟動 Worker 開發伺服器
pnpm run dev:unified    # 拉取前端並啟動 Worker
pnpm run build          # 建構前端和後端
pnpm run lint           # TypeScript 型別檢查
pnpm run test:all       # 執行全部單元測試
pnpm run format         # 用 prettier 格式化程式碼
```

---

## 幫助支援

在使用過程中遇到問題，可以透過下面的管道獲取幫助：

- 🐛 **提交 Bug 或功能請求**：請前往本倉庫 [_Issues_](https://github.com/LegspCpd/openlist-next/issues)
- 💬 **一般性问题與交流**：請前往本倉庫 [_Discussions_](https://github.com/LegspCpd/openlist-next/discussions) 討論區

## 開源許可

本專案基於 [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.txt) 許可證發布。

## 聯絡我們

🌐 [@LegspCpd](https://github.com/LegspCpd) · 📦 [openlist-next](https://github.com/LegspCpd/openlist-next) · 🐛 [Issues](https://github.com/LegspCpd/openlist-next/issues)

## 貢獻者

本專案由 **LegspCpd** 開發與維護。

[![Contributors](https://contrib.rocks/image?repo=LegspCpd/openlist-next)](https://github.com/LegspCpd/openlist-next/graphs/contributors)

---

## 致謝

本專案的設計與實作參考了下面這些開源專案，感謝它們的作者和全體開發者：

- [Alist](https://github.com/AlistGo/alist) 專案作者及全體開發者
- [OpenList](https://github.com/OpenListTeam/OpenList)（Go 版）專案作者及全體開發者
- [OpenList-Worker](https://github.com/OpenListTeam/OpenList-Worker)（官方 TypeScript 移植版）專案作者及全體開發者
- [openlistnext](https://github.com/Polonium-salts/openlistnext) 社群專案作者及全體開發者

> 上面這些專案的開發者**不是**本倉庫的貢獻者。本倉庫由 LegspCpd 獨立開發維護，與上述專案及 OpenListTeam 沒有隸屬、授權或背書關係，只在開源許可允許的範圍內借鏡其成果。詳見 [NOTICE.md](../NOTICE.md)。
>
> 前端的版權歸官方 [OpenList-Frontend](https://github.com/OpenListTeam/OpenList-Frontend) 的開發者所有，本倉庫不包含前端源碼。
