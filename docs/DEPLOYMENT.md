# 部署指南

五个目标平台都已配置好，按推荐顺序排列。所有平台共用同一套环境变量，
详见 [EXTERNAL_STORAGE.md](./EXTERNAL_STORAGE.md)。

## 平台速览

| 平台 | 入口文件 | 推荐存储 | 备注 |
|---|---|---|---|
| **Cloudflare Workers** | `src/backend/worker.ts` | KV / D1 / R2 / Neon | 首推，免费额度大、无冷启动 |
| 腾讯云 EdgeOne Makers | `api/_makers.ts` | KV(优先) / Blob / Neon | 自动探测 KV→Blob；需提交 `cloud-functions/` 产物 |
| Vercel | `api/[...route].ts` | Neon / Supabase / Upstash / Turso | 无平台 KV，Marketplace 一键连接数据库（见 [ONE_CLICK_DATABASE.md](./ONE_CLICK_DATABASE.md)） |
| 阿里云 ESA | `esa-entry.ts` | EdgeKV / Neon | 产物在 `dist-server/`；`esa-cli commit` + `esa-cli deploy` |
| Netlify | `netlify/functions/api.ts` | Neon / Supabase / Upstash | ⚠️ Functions 限 10s，大目录易超时 |

> **第一次构建会拉取前端**：`pnpm build` 会先执行 `scripts/fetch-frontend.mjs`
> 去拉 OpenList 官方前端仓库并编译。离线或想加速时，可预先准备好前端产物，
> 再用 `FRONTEND_DIST=<路径>` 指过去。

---

## 1. Cloudflare Workers（推荐）

### 方式 A：Wrangler CLI

```bash
cd openlist-next
pnpm install
cp .dev.vars.example .dev.vars     # 本地开发用
pnpm run build
pnpm wrangler deploy
```

首次部署 wrangler 会引导登录并自动预配资源。

### 方式 B：接入 Git 自动部署

在 Cloudflare Dashboard → Workers & Pages → Create → 连接 Git 仓库，
构建命令填 `pnpm run build`，输出不用管（wrangler 读 `wrangler.jsonc`）。

### 配置存储

KV / D1 / R2 在 `wrangler.jsonc` 里已备好注释模板，取消注释即可；
也可以直接在 Dashboard 的 **Settings → Bindings** 里添加。

**Secret 类变量**（推荐，不会被 `wrangler deploy` 覆盖）：

```bash
openssl rand -hex 32 | pnpm wrangler secret put JWT_SECRET
pnpm wrangler secret put DATABASE_URL      # 例如 Neon 连接串
pnpm wrangler secret put ADMIN_PASS
```

非敏感的普通变量写在 `wrangler.jsonc` 的 `vars` 里（`DB_DRIVER` / `DB_FORMAT` 等）。

> **注意 Node 兼容**：`wrangler.jsonc` 已开启 `nodejs_compat`。
> `mysql` 驱动即便如此也无法在 Workers 上用（缺裸 TCP），请改用 `mysqlhttp` + 网关。

---

## 2. 腾讯云 EdgeOne Makers

EdgeOne 的 Edge Functions 只注入 KV/Blob 给边缘函数，Node 云函数拿不到。
因此这里有**两个入口**，缺一不可：

| 文件 | 作用 |
|---|---|
| `api/_makers.ts` | 云函数入口，导出到 `cloud-functions/[[default]].js` |
| `middleware.js` | 根目录边缘中间件，负责 SPA 回退重写 |

### 步骤

1. 构建：

   ```bash
   pnpm install
   pnpm run build
   ```

2. **把 `cloud-functions/[[default]].js` 提交进仓库** —— EdgeOne 部署时从仓库读取，
   该文件是构建产物但必须入库，不要加进 `.gitignore`。

3. 一键部署 + 存储自检：

   ```bash
   EO_PAGES_PROJECT=<项目名> \
   EO_PAGES_API_TOKEN=<控制台获取的 Token> \
   pnpm run deploy:edgeone -- --url https://<你的域名> --deep
   ```

   它会构建、用 Makers CLI 部署（静态资源 + 边缘函数 + KV + 定时触发器一次同步），
   然后调用 `/storage-probe` 与 `/api/public/env_check` 报告实际生效的存储。
   也可在 EdgeOne 控制台接入 Git 仓库、选择 Makers 类型部署（构建命令
   `pnpm run build`，输出目录 `dist`）。

   > **`edgeone.json` 的三个坑**（已在本项目中修正）：
   > - `nodeVersion` 必须是平台预装版本之一（14.21.3 / 16.20.2 / 18.20.4 /
   >   20.18.0 / **22.11.0**），填别的版本号会构建失败；
   > - `maxDuration` 必须嵌在 `cloudFunctions.nodejs` 下，写成
   >   `cloudFunctions.maxDuration` 不生效；
   > - SPA 路由回退由根目录 `middleware.js` 承担。`edgeone.json` 的 `rewrites`
   >   只作用于静态资源、官方明确不支持 SPA 路由，加 `/*` 反而会命中静态文件。

4. 存储自动探测（`DB_DRIVER=auto`，默认）：应用会**自动探测可用存储，优先
   KV，其次 Blob**，无需手工指定：
   - **KV（优先）**：控制台「KV 存储」创建命名空间 → 绑定到**边缘函数**
     （不是 Node 云函数），**绑定变量名请填 `KV`**；再设置 `EO_KV_URLS` +
     `JWT_SECRET`（经 `functions/kv-*` 代理给云函数）；
   - **Blob（零配置兜底）**：无需任何控制台操作，`@edgeone/pages-blob`
     首次写入即自动建库，命名空间归属当前 Pages 项目；
   - 外部数据库（优先级最高）：`DATABASE_URL=postgres://…@ep-xxx.neon.tech/…`。
   - 也可显式写 `DB_DRIVER=kv` 或 `DB_DRIVER=blob`（显式指定则不做回退）。
   - `JWT_SECRET` 必填。

   **随时确认当前用的是哪个**：

   ```bash
   node scripts/deploy-platform.mjs edgeone --no-deploy --url https://<你的域名>
   ```

   `GET /storage-probe` 会返回 `{ kv, blob, recommended }` —— KV 可用则
   `recommended` 为 `kv`，否则为 `blob`。加 `?deep=1`（需 `X-Internal-Call`
   = `JWT_SECRET`）还会做一次 KV 写/读/删往返验证可写性。

5. 若 Node 云函数拿到了 KV 绑定却报 401，检查 `EO_KV_URLS` 是否指向正确 origin，
   以及它与 Edge Functions 是否使用了**同一个** `JWT_SECRET`。

6. ⚠️ 不要用 `*.edgeone.cool` 临时域名验证存储：该域名带全站鉴权参数，
   会拦截边缘函数 ↔ 云函数的 KV 代理回调。请先绑定自定义域名再验证。

---

## 3. Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/LegspCpd/openlist-next)

Vercel 没有平台级 KV，**必须配置外部数据库**。最省事的方式：在部署页下方的
**Marketplace Database Providers** 里「一键连接数据库」（Neon / Upstash /
Supabase / Turso …）—— 连接后 Vercel 会自动注入连接变量，本项目 `DB_DRIVER=auto`
（默认）会自动识别并接通，无需手改代码。完整支持矩阵与分步说明见
[ONE_CLICK_DATABASE.md](./ONE_CLICK_DATABASE.md)。

### 部署方式

```bash
npx vercel login
npx vercel deploy --prod --yes

# 或者一条命令完成 构建 → 部署 → 存储自检：
pnpm run deploy:vercel -- --url https://<你的域名>
```

控制台方式：**Import Git Repository**，框架检测选 **Other**（配置全部读
`vercel.json`）。

### vercel.json 关键配置

| 字段 | 值 | 说明 |
|---|---|---|
| `buildCommand` | `pnpm run build` | 先拉官方前端产物，再打包后端 |
| `outputDirectory` | `dist` | 前端静态资源目录 |
| `functions["api/[...route].ts"]` | `runtime=nodejs22.x`, `maxDuration=60`, `memory=1024` | 后端入口；默认 10s 对大目录不够 |
| `rewrites` | `/api`、`/d`、`/sd`、`/p` → `/api/[...route]`；其余 → `/index.html` | 后端路由 + SPA 回退 |

> `api/_makers.ts`（EdgeOne 云函数入口）与 `api/html.d.ts` **不会**被 Vercel
> 当成函数：Vercel 会忽略 `/api` 下以下划线开头、以 `.` 开头、以 `.d.ts`
> 结尾的文件。

也可以手工配环境变量：

```bash
# Project Settings → Environment Variables
JWT_SECRET=<openssl rand -hex 32>
DATABASE_URL=postgres://user:pass@ep-xxx.neon.tech/neondb
DB_DRIVER=auto        # 留空即为 auto，会按变量自动识别
DB_FORMAT=map
```

> Vercel Functions 单次执行上限默认 10s（Pro 60s）。
> 大目录列表或代理下载可能超时，建议用 `DB_FORMAT=map` 减少数据库往返。

---

## 4. 阿里云 ESA

ESA 走「构建 → 提交版本 → 部署」三步，本地需先构建：

```bash
pnpm install
pnpm run build          # 产出 dist-server/esa-entry.js（服务端入口）
                        # 与 dist/（前端静态资源）

npx esa-cli login       # 首次需要登录
npx esa-cli commit      # 生成代码版本
npx esa-cli deploy      # 按提示选择版本与目标环境，部署到边缘节点
```

也可以让统一脚本一条命令做完（构建 + 提交 + 部署 + 存储自检）：

```bash
pnpm run deploy:esa -- --url https://<你的域名>
```

`esa.jsonc` 已声明以下字段：

| 字段 | 值 | 作用 |
|---|---|---|
| `entry` | `./dist-server/esa-entry.js` | 边缘函数入口。产物放 `dist-server/` 而非 `dist/`，否则服务端 bundle 会被当作静态文件公开下载 |
| `assets.directory` | `./dist` | 前端静态资源目录 |
| `assets.notFoundStrategy` | `singlePageApplication` | 未命中静态资源时返回 `index.html` + 200。**不配这个，`/login`、`/@manage/*` 等 SPA 路由会直接 404** |

> ESA 控制台 →「边缘计算 → 函数和 Pages」→ 创建 → 导入 GitHub 仓库，
> 也能自动构建；构建命令填 `pnpm run build`，静态资源目录填 `./dist`，
> 函数文件路径填 `./dist-server/esa-entry.js`（这些都会以 `esa.jsonc` 为准）。

环境变量在 ESA 控制台配置，推荐组合：

```bash
JWT_SECRET=<随机串>
DATABASE_URL=postgres://…@ep-xxx.neon.tech/neondb   # 跨实例共享最可靠
DB_FORMAT=map
```

> **存储自动探测**（`DB_DRIVER=auto`，默认）：ESA 上 EdgeKV 会被自动识别为
> `kv` 驱动（优先）；若配了外部数据库（`DATABASE_URL` 等）则优先用外部库；
> ESA Blob 绑定（`ESA_BLOB`）会被识别为 `blob` 驱动。Vercel Marketplace 式
> 的连接变量（`KV_REST_API_URL` / `TURSO_DATABASE_URL` 等）同样适用，
> 见 [ONE_CLICK_DATABASE.md](./ONE_CLICK_DATABASE.md)。

> ESA 每个请求对 KV 子请求有次数上限，若坚持用平台 EdgeKV，
> 建议 `DB_FORMAT=map`（整库一个 key，读写各一次）。

---

## 5. Netlify

⚠️ **先读 limitations**：Netlify Functions 单次执行 10s（Pro 26s），
冷启动 + 网盘 API 往返容易触顶。生产建议优先用 Workers；
这里主要用于尝鲜或与其他平台互备。

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

路由：`/api/*`、`/dav/*`、`/p/*` 由 `netlify/functions/api.ts` 处理
（通过 `config.path` 挂载，不用 redirect，避免 URL 被重写破坏路由），
其余请求回退到 SPA 的 `index.html`。

---

## 6. Node / Docker 自建

自建是唯一能用 `DB_DRIVER=mysql` 直连 TCP 的场景，也支持 D1 之外的全部格式。

```bash
pnpm install
pnpm run build
pnpm start              # node dist-server/api/[...route].js
```

环境变量写在 `.env`（根目录 `loadEnv.js` 会读取）：

```bash
JWT_SECRET=<随机串>
DATABASE_URL=mysql://user:pass@127.0.0.1:3306/openlist
DB_DRIVER=mysql
DB_FORMAT=sql
```

---

## 部署后检查

1. 访问根路径，完成初始化向导（或已设 `ADMIN_PASS` 则直接登录）。
2. 打开 `GET /api/public/env_check` —— `ready` 应为 `true`，`storage.driver`
   是**实际生效**的驱动。**若显示 `memory`，说明数据不会持久化，必须处理。**
3. 管理面板的「存储状态」页会显示当前 `DB_DRIVER` / `DB_FORMAT` 与健康检查结果。

也可以让统一脚本一次完成「探测 + 结论 + 下一步」：

```bash
pnpm run deploy:edgeone -- --no-deploy --url https://<你的域名>
pnpm run deploy:esa     -- --no-deploy --url https://<你的域名>
pnpm run deploy:vercel  -- --no-deploy --url https://<你的域名>
```

退出码：`0` = 存储已就绪；`2` = 存储未就绪（缺配置或驱动不可达）。
EdgeOne 上还会额外读取 `GET /storage-probe`，输出 KV / Blob 的可用性与推荐驱动。

### 常见问题

| 现象 | 处理 |
|---|---|
| 提示 `No storage backend is available` | serverless 下不落内存。配 `DATABASE_URL` 或绑定平台存储 |
| 每次重启都要重新初始化 | 说明数据没持久化。检查 `env_check` 返回的 driver 是否为 `memory` |
| 前端 404 但 API 正常 | 静态资源未上传。`build` 会产出 `dist/`，确认平台的 assets 目录指向它 |
| 接了两个 edge 平台结果不一致 | 两边的 `JWT_SECRET` 不同会导致加密字段解不开，务必保持一致 |
