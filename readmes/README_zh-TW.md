<div align="center">

# OpenList Next

<p><em>OpenList 是一個多功能的目錄列表工具，可以把分散在多種網盤、物件儲存和協定服務裡的檔案集中到一個介面，進行瀏覽、預覽、下載和分享</em></p>
<p>本倉庫是官方 <a href="https://github.com/OpenListTeam/OpenList-Worker">OpenList-Worker</a> 的社群衍生版，用 TypeScript 編寫，可以部署到 Cloudflare Workers、騰訊雲 EdgeOne、阿里雲 ESA 等邊緣平台</p>
<p>在官方版本的基礎上，本專案補上了「在任何邊緣平台上直連外部資料庫」這件事</p>

<a href="../LICENSE"><img src="https://img.shields.io/github/license/LegspCpd/openlist-next" alt="License" /></a>
<a href="https://github.com/LegspCpd/openlist-next/actions/workflows/edgeone-artifact-guard.yml"><img src="https://img.shields.io/github/actions/workflow/status/LegspCpd/openlist-next/edgeone-artifact-guard.yml?branch=main" alt="Build status" /></a>
<a href="https://github.com/LegspCpd/openlist-next/issues"><img src="https://img.shields.io/github/issues/LegspCpd/openlist-next" alt="Issues" /></a>
<a href="https://github.com/LegspCpd/openlist-next/discussions"><img src="https://img.shields.io/github/discussions/LegspCpd/openlist-next?color=%23ED8936" alt="Discussions" /></a>

📖 [多平台部署指南](../docs/DEPLOYMENT.md) · 🗄️ [外部儲存設定](../docs/EXTERNAL_STORAGE.md) · 🔌 [一鍵連接資料庫](../docs/ONE_CLICK_DATABASE.md)

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

## 介紹

OpenList Next 把分散在多個網盤、物件儲存和協定服務裡的文件集中到一個介面，可以瀏覽、預覽、下載、分享和管理。

本專案源自官方 [OpenList-Worker](https://github.com/OpenListTeam/OpenList-Worker)，補上了「在任何邊緣平台上直連外部資料庫」這件事；差別見[功能介紹](#功能介紹)裡的對照表。

按順序往下讀，或者直接跳到你要看的部分：

- [一鍵部署](#一鍵部署) —— 點按鈕把專案部署到 EdgeOne、Cloudflare Workers、Vercel 或 Netlify
- [功能介紹](#功能介紹) —— 支援哪些網盤、有哪些能力、和官方版本差在哪
- [環境變數](#環境變數) —— 每個變數是幹什麼的、要不要填、怎麼填
- [手動部署](#手動部署) —— 在本機跑起來，或者用命令列部署到各個平台
- [部署後檢查](#部署後檢查) —— 確認儲存真的接上了，而不是悄悄退回記憶體
- [技術架構](#技術架構) —— 用到的框架和建置工具
- [常見問題](#常見問題) —— 常見報錯的原因和處理辦法

---

## 一鍵部署

點擊下面的按鈕，可以把本專案部署到對應的平台：

<div align="center">

| EdgeOne · 國際站 | EdgeOne · 中國站 | Cloudflare Workers |
| :---: | :---: | :---: |
| [![使用 EdgeOne 部署](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?project-name=openlist-next&repository-url=https://github.com/LegspCpd/openlist-next&install-command=pnpm%20install%20--no-frozen-lockfile&build-command=pnpm%20run%20build&output-directory=dist&env=JWT_SECRET) | [![使用 EdgeOne 部署](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://console.cloud.tencent.com/edgeone/makers/new?project-name=openlist-next&repository-url=https://github.com/LegspCpd/openlist-next&install-command=pnpm%20install%20--no-frozen-lockfile&build-command=pnpm%20run%20build&output-directory=dist&env=JWT_SECRET) | [![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/LegspCpd/openlist-next) |

| Vercel | Netlify |
| :---: | :---: |
| [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FLegspCpd%2Fopenlist-next&project-name=openlist-next&env=JWT_SECRET,ADMIN_PASS&envDescription=Only%20these%20two%20are%20needed.%20JWT_SECRET%3A%20run%20%60openssl%20rand%20-hex%2032%60.%20ADMIN_PASS%3A%20your%20admin%20password%2C%20it%20skips%20the%20setup%20wizard.&envLink=https%3A%2F%2Fgithub.com%2FLegspCpd%2Fopenlist-next%2Fblob%2Fmain%2Freadmes%2FREADME_zh-TW.md%23%25E7%2592%25B0%25E5%25A2%2583%25E8%25AE%258A%25E6%2595%25B8 | [![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/LegspCpd/openlist-next) |

</div>

部署完還要設定環境變數。Vercel 的部署頁只會問兩個變數：`JWT_SECRET`（用 `openssl rand -hex 32` 產生）和 `ADMIN_PASS`（管理員密碼，填了就跳過第一次開啟時的安裝精靈）。其餘變數都留空即可，用到哪個功能再填哪個，見[環境變數](#環境變數)。

> [!IMPORTANT]
> 如果 Cloudflare 提示「無法取得儲存庫內容」，先 [Fork](https://github.com/LegspCpd/openlist-next/fork) 本倉庫，再用「連線到 GitHub 倉庫」的方式部署。

---

## 功能介紹

這些能力來自官方 [OpenList-Worker](https://github.com/OpenListTeam/OpenList-Worker)（官方 [OpenListTeam/OpenList](https://github.com/OpenListTeam/OpenList) 的 TypeScript + Serverless 移植版），介面與互動兩邊一致，差別只在儲存與部署。

### 儲存聚合

內建 **80 個儲存驅動**，開箱即用掛載各類儲存後端：

- **國內網盤**：阿里雲盤（開放平台/分享）、夸克網盤（開放平台/UC TV 版）、百度網盤（相簿）、115 網盤（開放平台/分享）、123 雲盤（開放平台/分享）、天翼雲盤（189/PC/TV）、中國移動雲盤（139/和彩雲）、沃家雲盤、迅雷雲盤、騰訊微雲、藍奏雲、PikPak（分享）、豆包網盤、光亞盤、超星小組網盤、聯想 NAS 分享、Teambition 網盤、WPS 網盤、阿里文件、HalalCloud、MediaTrack 等
- **國際網盤**：Google Drive（相簿）、OneDrive（應用/分享連結）、Dropbox、MEGA、MediaFire、Proton Drive、Yandex Disk、Degoo、Bunny Storage、TeraBox 等
- **物件儲存**：S3 相容（AWS/OSS/COS/MinIO 等）、又拍雲 USS、Azure Blob、WebDAV、IPFS 等
- **程式碼託管**：GitHub、GitHub Releases、CNB Releases
- **網盤程式**：OpenList（分享）、AList V3、Cloudreve V3/V4、Kodbox（可道雲）、Seafile、Teldrive、Febbox 等
- **其他驅動**：網易雲音樂、Misskey、Emby、Cloudflare 圖床等

除上述真實儲存外，還提供 `Alias`、`UrlTree`、`AutoIndex`、`Strm`、`Crypt`、`Virtual`、`Chunk` 等虛擬/功能型驅動，可用於地址別名、URL 列表、加密儲存與分片等場景。

### 核心能力

- **檔案瀏覽**：統一的目錄樹瀏覽，支援圖片、影片、音訊、文件、程式碼、壓縮檔等格式線上預覽。
- **上傳下載**：跨儲存的上傳、批次下載、串流傳輸與直鏈跳轉。
- **檔案分享**：生成帶有效期、密碼與權限控制的分享連結，支援匿名存取與目錄分享。
- **全文搜尋**：在已索引的儲存中快速檢索檔案。
- **離線下載（功能受限）**：`/api/fs/seed/offline_download` 能解析 seed 資料（種子、直連、CAS）並同步寫入目標儲存，需先設定 `ALLOW_SEED` 白名單並具備 `OFFLINE_DOWNLOAD` 權限。注意沒有背景任務佇列；`/fs/add_offline_download` 與任務的重試 / 取消都未實作（回傳 501）。
- **外部介面**：將聚合儲存以 WebDAV 或 S3 相容協定對外暴露，便於掛載到第三方工具。
- **MCP 服務**：提供 Model Context Protocol 端點，可被 AI 助手等用戶端整合呼叫。

### 權限管理

- **權限管理**：三種角色（管理員 / 一般使用者 / 訪客），支援按目錄設定讀寫權限（中繼資料裡的 `read_users` / `write_users`，可含子目錄）。
- **認證方式**：內建帳號密碼，支援 TOTP 驗證、WebAuthn 登入（Passkey，預設關閉，需在設定中開啟）、SSO 單點登入與 LDAP 目錄認證。
- **安全加固**：JWT 會話、同源 CORS 策略（預設不放行任意 Origin，可用 `ALLOW_URLS` 加白名單）、點擊劫持防護（`X-Frame-Options: DENY`）、內容安全策略（CSP）、HSTS。
- **健康檢查**：`/api/healthz` 才是就緒探針——它會真的讀一次儲存，不可用時回傳 503，適合接監控告警；`/api/health` 只是存活標記，不反映儲存狀態。

### 平台部署

- **運行平台**：Cloudflare Workers、騰訊雲 EdgeOne Makers、阿里雲 ESA、Vercel、Netlify 及 Node.js 容器環境。
- **資料儲存**：平台自帶儲存（KV / D1 / Blob …）或任意外部資料庫。
- **一鍵部署**：支援 EdgeOne、Cloudflare Workers、Vercel、Netlify 的一鍵部署按鈕。

### 和官方版本有哪些不同

| | 官方 OpenList-Worker | 本專案 |
|---|---|---|
| 儲存驅動 | 6 個 | 16 個，新增 10 個（`neon`、`turso`、`pgrest`、`pghttp`、`mysqlhttp`、`upstash`、`s3`、`r2`、`netlifyblobs`、`hyperdrive`）|
| SQL 方言 | SQLite、MySQL | 增加 PostgreSQL（含 `$n` 佔位符） |
| 網盤驅動 | 78 個 | 80 個，補齊 `123_link`、`ilanzou`、`halalcloud`；移除了只在本機檔案系統上才有意義的 `Local` |
| 部署平台 | Cloudflare Workers、EdgeOne、ESA、Vercel、Serverless、Node/Docker | 新增 Netlify，並為 EdgeOne / ESA / Vercel 補了一鍵部署腳本 |

新增的 10 個驅動裡，8 個走 HTTP（`neon` `turso` `pgrest` `pghttp` `mysqlhttp` `upstash` `s3` `netlifyblobs`），在邊緣也能連外部資料庫，填一條 `DATABASE_URL` 即可；`r2` 用 Cloudflare 儲存桶綁定，`hyperdrive` 靠 `mysql2` 直連 TCP，僅 Node 可用。官方版的 `mysql` 同樣只在 Node 容器裡能跑。

詳細說明見 [外部儲存配置指南](../docs/EXTERNAL_STORAGE.md)。

---

## 環境變數

填在哪：Cloudflare 在 Settings → Variables and Secrets；EdgeOne 在專案的「環境變數」；Vercel / Netlify 在專案設定；Node / Docker 寫在根目錄 `.env`。

### 就填這兩個

| 變數名 | 填不填 | 說明 |
|---|---|---|
| `JWT_SECRET` | **必填** | 工作階段簽章、憑證加密、排程工作驗證都用它。用 `openssl rand -hex 32` 產生 |
| `ADMIN_PASS` | 選填 | 設了就跳過安裝精靈，直接用它建立管理員帳號 |

其餘變數都不用填。用到哪個功能，再填它對應的變數。

### 用到再填

| 變數名 | 什麼時候填 | 說明 |
|---|---|---|
| `DB_DRIVER` | 選填，預設 `auto` | 資料存到哪。`auto` 按「外部資料庫 → 平台自帶儲存」的順序挑，拿不準就用它。可選：`kv` `d1` `r2` `blob` `cfkv` `do` `neon` `turso` `pgrest` `pghttp` `mysqlhttp` `upstash` `s3` `hyperdrive` `netlifyblobs` `mysql`（僅 Node） |
| `DB_FORMAT` | 選填，預設 `map` | `map` 整庫存成一條 JSON，最省請求；`key` 一個實體一條，實體多時比 `map` 省流量；`sql` 用關聯表，可以和 Go 版 OpenList 共用同一個庫 |
| `DATABASE_URL` | 用外部庫時填 | 通用連線字串，程式按協定和主機名認廠家。通常填這一條就夠 |
| `SUPABASE_KEY` | 用 Supabase 時填 | Supabase 的讀寫 key |
| `TURSO_AUTH_TOKEN` | 用 Turso 時填 | Turso 存取權杖 |
| `MYSQL_HTTP_URL` | 邊緣上用 MySQL 時填 | MySQL / MariaDB 的 HTTP 轉發閘道，邊緣平台連 MySQL 只能走它 |
| `PG_HTTP_URL` | 用自建閘道時填 | 自建 Postgres HTTP 閘道位址 |
| `MYSQL_URLS` | Node 直連 MySQL 時填 | MySQL 直連連線字串，僅 Node / Docker 可用 |
| `ALLOW_URLS` | 前後端不同網域時填 | 跨域白名單，逗號分隔；不填只允許同源 |
| `ASSET_URLS` | 用 CDN 時填 | 前端靜態資源從 CDN 載入，支援 `$version` 佔位目前前端版本號 |
| `MAX_UPLOAD` | 選填 | 單次整體上傳上限，位元組，預設 26214400（25MB） |
| `MAX_UPPART` | 選填 | 分片上傳的單片上限，位元組，預設 16777216（16MB） |
| `ALLOW_SEED` | 用種子功能時填 | 允許當作種子資料來源的站點白名單 |
| `EO_KV_URLS` | 一般留空 | EdgeOne 專用。Node 雲函式拿不到 KV 綁定，只能經邊緣函式轉發；填**本部署的 origin**，如 `https://openlist.example.com`。留空會自動取目前存取的網域，只有存取網域≠部署網域或本機除錯才手填 |

> 換了 `JWT_SECRET`，庫裡已加密的密碼和網盤憑證就解不開；多個平台共用一份資料時，各平台必須填同一個值。

各家連線字串怎麼寫、還支援哪些變數別名，見[外部儲存配置指南](../docs/EXTERNAL_STORAGE.md)。

### 平台綁定（綁好就行，不用手填）

這些由平台在部署時注入。建好資源，把綁定名字寫成下面這樣即可。

| 變數名 | 用途 |
|---|---|
| `DB` | Cloudflare D1 資料庫綁定，配 `DB_DRIVER=d1` |
| `KV` | Cloudflare KV / EdgeOne KV 命名空間綁定，配 `DB_DRIVER=kv` |
| `BUCKET` | Cloudflare R2 儲存桶綁定，配 `DB_DRIVER=r2`（也接受 `R2_BUCKET` / `OPENLIST_BUCKET` / `OPENLIST_R2`） |
| `HYPERDRIVE` | Cloudflare Hyperdrive 連線串，讓邊緣能存取 MySQL，配 `DB_DRIVER=hyperdrive` |
| `S3_BUCKET` `S3_REGION` `S3_ENDPOINT` `S3_ACCESS_KEY_ID` `S3_SECRET_ACCESS_KEY` | S3 相容物件儲存的桶名與憑證（R2 / MinIO / B2 等），配 `DB_DRIVER=s3` |
| `CF_ACCOUNT` `CF_KV_UUID` `CF_API_KEY` | 走 Cloudflare REST API 讀寫 KV，配 `DB_DRIVER=cfkv`（帳戶 ID / 命名空間 ID / 有 KV 讀寫權限的 Token） |

### 只在命令列裡用

| 變數名 | 用途 |
|---|---|
| `EO_PAGES_PROJECT` | EdgeOne Makers CLI 要部署到哪個專案 |
| `EO_PAGES_API_TOKEN` | EdgeOne Makers 控制台的 API Token，給 CLI 用 |
| `EO_PAGES_URL` | 部署後的網域，`pnpm run deploy:edgeone` 用它做部署後檢查 |

變數範本見 [`.dev.vars.example`](../.dev.vars.example)。

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

儲存方面，EdgeOne 的 KV 和 Blob 的 Web API 只會給**邊緣函式**，Node 雲函式拿不到 —— 注意 Node 端也會看到一個叫 `KV` 的物件，但它是 Redis/RESP 用戶端（不是 KV Web API），程式會主動忽略它，別拿它當 KV 用。所以本專案在 EdgeOne 上用了兩個入口：

| 檔案 | 作用 |
|---|---|
| `api/_makers.ts`（建構產物 `cloud-functions/[[default]].js`） | Node 雲函式，後端主體 |
| `functions/*` | 邊緣函式，負責 KV 代理和儲存探測 |
| `middleware.js` | 邊緣中介層，負責前端路由回退 |

`DB_DRIVER` 保持預設的 `auto` 時，程式會按下面的順序自動選擇儲存：

1. 外部資料庫（如果你設定了 `DATABASE_URL`）
2. **KV**：在控制台的「KV 儲存」裡建立命名空間，然後綁定到**邊緣函式**（不是 Node 雲函式），綁定變數名填 `KV`，並設定 `JWT_SECRET`（`EO_KV_URLS` 一般留空，留空會自動用你當前造訪的網域）
3. **Blob**：不需要任何設定，第一次寫入時 `@edgeone/pages-blob` 會自動建庫

有幾個坑要注意（本專案已經處理好了，你自己改設定時留意）：

- `edgeone.json` 裡的 `nodeVersion` 要用平台預裝的版本，官方文件列出的只有 14.21.3 / 16.20.2 / 18.20.4 / 20.18.0 / 22.11.0 這五個，填別的版本可能建構失敗。本專案用 `22.11.0`：拉前端時 `scripts/fetch-frontend.mjs` 會發現上游 pin 的 pnpm 11 要求 Node ≥ 22.13，自動回退到 pnpm 10。這個欄位會覆蓋主控台的專案設定
- `maxDuration` 要寫在 `cloudFunctions.nodejs` 裡面，寫成 `cloudFunctions.maxDuration` 不生效
- 前端路由回退由根目錄的 `middleware.js` 負責，`edgeone.json` 裡就沒有再配 `rewrites`。Makers 現在也支援用 `{"source": "/*", "destination": "/index.html"}` 宣告 SPA 回退（會被辨識成 fallback 而不是普通重寫），但同一個回退配在兩處容易互相打架，本專案只保留 `middleware.js` 一處
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

部署成功不等於儲存可用 —— 驅動可能悄悄退回記憶體模式：站點能打開、能登入，一重啟資料就沒了。

```bash
curl https://你的網域/api/public/env_check
```

回傳內容裡重點看這幾個欄位：

- `data.storage.memory`：`true` 表示落到了記憶體兜底，資料重啟就沒了，必須處理（此時 `data.config.resolved_driver` 是 `memory`）
- `data.jwt.ready`：`JWT_SECRET` 是否設定好了。沒設定的話，網盤掛載憑據這類加密欄位解不開
- `data.ready`：整體是否就緒
- `data.issues`：問題清單，每項帶一個 `code`（如 `STORAGE_MEMORY_ONLY`、`JWT_SECRET_MISSING`），排查從這裡看最快

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

- **框架**：SolidJS + TypeScript
- **UI 庫**：Hope UI
- **建構工具**：Vite

> 前端不在本倉庫裡，建構時由 `scripts/fetch-frontend.mjs` 從官方倉庫拉取。

---

## 常見問題

| 現象 | 原因和處理辦法 |
|---|---|
| 提示 `No storage backend is available` | 一個儲存都沒配。填 `DATABASE_URL`，或者在平台上綁定 KV / D1 / Blob。具體缺哪一項看 `/api/public/env_check` 回傳的 `data.issues` |
| 每次重啟都要重新初始化 | 資料沒有持久化，落到了記憶體兜底。看 `/api/public/env_check` 的 `data.storage.memory` 是不是 `true`（或 `data.issues` 裡有沒有 `STORAGE_MEMORY_ONLY`） |
| 頁面 404 但 API 正常 | 靜態資源沒上傳。確認建構產出了 `dist/`，並且平台的靜態資源目錄指向它 |
| 換了 `JWT_SECRET` 之後登入不上、網盤掛載失敗 | 密碼、網盤憑證、OTP 金鑰都是用 `JWT_SECRET` 加密後才落庫的，金鑰換了就解不開（日誌裡是 `Failed to decrypt a sealed secret (wrong JWT_SECRET?)`）。改回原來的值，或者把密碼和網盤憑證重新填一遍 |
| 兩個平台共用一個庫時資料錯亂 | 兩邊的 `JWT_SECRET` 不一致，加密欄位解不開。共用一個庫就必須填同一個值；各用各的庫則不需要一致 |
| EdgeOne 上 KV 報 401 | Node 雲端函式和 Edge Function 的 `JWT_SECRET` 不一致（或輪換過）。兩邊填同一個，或者把 `EO_KV_URLS` 指向正確的部署網域 |
| 日誌出現 `Error reading config from kv: Not connected`，所有 `/api/*` 回傳 503 | Node 雲函式把 KV 命名空間當成 **Redis/RESP 用戶端**注入了（KV Web API 只給邊緣函式），程式會忽略它並回落 Blob。這是預期行為；想讓 Node 真的用上 KV，就把命名空間綁到邊緣函式，並設 `DB_DRIVER=kv` + `JWT_SECRET` |
| 初始化偶爾報 400 `system has already been initialized`，重試又成功 | 假的「已初始化」：儲存不通時程式退回記憶體態，同一實例內第一次初始化只寫進了記憶體，重試時從記憶體讀到已有管理員就報 400。把儲存修好就消失了 |
| 報 `Storage driver "mysql" is not available in this runtime` | 邊緣執行時用了 `DB_DRIVER=mysql`，這個驅動只在 Node 容器裡可用。改用 `mysqlhttp` |
| Supabase 報 404 | `kv` 表不存在，先建表：`CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);`。另外 Supabase 走 PostgREST，只支援 KV，不能配 `DB_FORMAT=sql` |
| 點「離線下載」提示 `capability unavailable` | 這個執行環境沒有可持久化的離線下載轉接器，`/fs/add_offline_download` 回傳 501。改用 `/api/fs/seed/offline_download`（先設定 `ALLOW_SEED` 白名單）；任務清單裡的重試 / 取消也同樣是 501 |

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

- 🐛 **Bug 或功能請求**：本倉庫 [_Issues_](https://github.com/LegspCpd/openlist-next/issues)
- 💬 **問題與交流**：本倉庫 [_Discussions_](https://github.com/LegspCpd/openlist-next/discussions)

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
