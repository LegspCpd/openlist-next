# 部署指南

五个目标平台都已配置好，按推荐顺序排列。所有平台共用同一套环境变量，
详见 [EXTERNAL_STORAGE.md](./EXTERNAL_STORAGE.md)。

## 平台速览

| 平台 | 入口文件 | 推荐存储 | 备注 |
|---|---|---|---|
| **Cloudflare Workers** | `src/backend/worker.ts` | KV / D1 / R2 / Neon | 首推，免费额度大、无冷启动 |
| 腾讯云 EdgeOne Makers | `api/_makers.ts` | Blob / KV / Neon | 国内访问快，需提交 `cloud-functions/` 产物 |
| Vercel | `api/[...route].ts` | Neon / Supabase / Upstash | 无平台 KV，必须配外部库 |
| 阿里云 ESA | `esa-entry.ts` | EdgeKV / Neon | 手动构建 + 上传 |
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

3. 在 EdgeOne 控制台接入 Git，选择 Makers 类型部署。

4. 环境变量 / KV 绑定在控制台配置：
   - `JWT_SECRET`（必填）
   - `DB_DRIVER=blob`（推荐，零配置）或 `kv`（需先绑定 KV 命名空间）
   - 想用外部数据库：`DATABASE_URL=postgres://…@ep-xxx.neon.tech/…`

5. 若 Node 云函数拿到了 KV 绑定却报 401，检查 `EO_KV_URLS` 是否指向正确 origin，
   以及它与 Edge Functions 是否使用了**同一个** `JWT_SECRET`。

---

## 3. Vercel

Vercel 没有平台级 KV，**必须配置外部数据库**（Neon 最省事，Vercel 市场可直接开）。

```bash
# 1. 导入仓库到 Vercel，框架检测选 Other（配置读 vercel.json）
# 2. Project Settings → Environment Variables 添加：
JWT_SECRET=<openssl rand -hex 32>
DATABASE_URL=postgres://user:pass@ep-xxx.neon.tech/neondb
DB_DRIVER=neon
DB_FORMAT=sql
# 3. Deploy
```

或用 CLI：

```bash
vercel deploy --prod
```

> Vercel Serverless Functions 单次执行上限默认 10s（Pro 60s）。
> 大目录列表或代理下载可能超时，建议用 `DB_FORMAT=map` 减少数据库往返。

---

## 4. 阿里云 ESA

ESA 走构建产物上传，需要本地先构建：

```bash
pnpm install
pnpm run build          # 产出 dist/esa-entry.js
esa deploy              # 或按 ESA 控制台的手动上传流程
```

`esa.jsonc` 已声明 `entry: ./dist/esa-entry.js` 与静态资源目录。

环境变量在 ESA 控制台配置，推荐组合：

```bash
JWT_SECRET=<随机串>
DATABASE_URL=postgres://…@ep-xxx.neon.tech/neondb   # 跨实例共享最可靠
DB_FORMAT=map
```

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
2. 打开 `GET /api/public/env_check` —— 应返回 `configured: true` 且驱动名正确。
3. 管理面板的「存储状态」页会显示当前 `DB_DRIVER` / `DB_FORMAT` 与健康检查结果。

### 常见问题

| 现象 | 处理 |
|---|---|
| 提示 `No storage backend is available` | serverless 下不落内存。配 `DATABASE_URL` 或绑定平台存储 |
| 每次重启都要重新初始化 | 说明数据没持久化。检查 `env_check` 返回的 driver 是否为 `memory` |
| 前端 404 但 API 正常 | 静态资源未上传。`build` 会产出 `dist/`，确认平台的 assets 目录指向它 |
| 接了两个 edge 平台结果不一致 | 两边的 `JWT_SECRET` 不同会导致加密字段解不开，务必保持一致 |
