# 贡献指南 (Contributing Guide)

感谢你对 **OpenList Next** 的关注与支持！🎉

OpenList 是一个基于 **SolidJS** + **Hono** + **TypeScript** 的现代化全栈文件列表与网盘管理系统。我们欢迎任何形式的贡献，包括但不限于报告 Bug、提出新功能建议、改进文档、参与国际化翻译以及提交代码。

---

## 目录

- [贡献方式](#-贡献方式)
- [本地开发环境](#-本地开发环境)
  - [环境要求](#环境要求)
  - [快速起步](#快速起步)
  - [常用脚本](#常用脚本)
- [核心架构与开发规范](#-核心架构与开发规范)
  - [全栈 Web 标准优先与边缘兼容（重要）](#全栈-web-标准优先与边缘兼容重要)
  - [添加新的存储驱动 (Storage Driver)](#添加新的存储驱动-storage-driver)
  - [前端开发规范 (SolidJS)](#前端开发规范-solidjs)
  - [国际化翻译 (i18n)](#国际化翻译-i18n)
- [Git 提交规范 (Commit Convention)](#-git-提交规范-commit-convention)
- [Pull Request (PR) 流程](#-pull-request-pr-流程)
  - [PR 准备与自检清单](#pr-准备与自检清单)
  - [AI 辅助使用声明 (AI Disclosure)](#ai-辅助使用声明-ai-disclosure)
- [行为准则与开源许可证](#-行为准则与开源许可证)

---

## 💡 贡献方式

### 1. 报告 Bug

如果您在使用过程中发现了 Bug，请通过 [GitHub Issues](https://github.com/LegspCpd/openlist-next/issues) 提交：

- 检查是否已有相同或相似的 Issue。
- 详细描述问题发生的场景、复现步骤、预期行为与实际表现。
- 提供运行环境信息（部署方式如 Node.js 容器 / Cloudflare Workers / Vercel、Node 版本、浏览器版本等）。
- 附上相关的控制台日志或错误堆栈截图/文本。

### 2. 提出功能建议 (Feature Requests)

我们乐于听取各种创新的点子！提交功能建议前：

- 清晰阐述该功能的使用场景与价值。
- 简述预期的交互方式或技术实现构想。

### 3. 参与国际化翻译 (i18n)

前端语言包**不在本仓库里**：官方前端
[OpenListTeam/OpenList-Frontend](https://github.com/OpenListTeam/OpenList-Frontend) 的
`src/lang/` 只提交英文，各语言翻译由 Crowdin 维护、随 release 以 `i18n.tar.gz` 发布，
构建时由 `scripts/fetch-frontend.mjs` 拉取并合并进来。

- 上游翻译滞后的部分（如某个键还没翻、或值仍是英文），由本仓库的
  `scripts/i18n-overrides/` 补齐 —— 改这里就能直接提 PR，详见
  [国际化翻译 (i18n)](#国际化翻译-i18n) 一节。
- 想从根上解决，可到前端仓库对应的 Crowdin 项目页完善语言包，上游更新后会自动带下来。

### 4. 提交代码 (Code Contributions)

无论是修复 Bug、重构代码、新增网盘驱动还是优化 UI，我们都热烈欢迎！请参考下文的开发与提交规范。

---

## 🛠️ 本地开发环境

### 环境要求

- **Node.js**：`22.x`（`package.json` 的 `engines.node` 已锁定为 `22.x`）
- **包管理器**：**`pnpm`**（仓库 pin 的是 `pnpm@9.15.4`，用 corepack 或 `npx pnpm@9` 均可）

### 快速起步

1. **Fork 并克隆仓库**：

   ```bash
   git clone https://github.com/<your-username>/openlist-next.git
   cd openlist-next
   ```

2. **安装依赖**：

   ```bash
   pnpm install
   ```

3. **启动本地开发环境**：

   ```bash
   pnpm run dev:unified   # 先拉取官方前端产物，再启动 wrangler dev
   pnpm run dev:worker    # 只启动 wrangler dev（dist/ 里已有前端产物时用）
   ```

   前端源码不在本仓库里，`dev:unified` 会先跑 `scripts/fetch-frontend.mjs` 把官方前端产物放到
   `dist/`，再启动 `wrangler dev` 做边缘环境模拟（监听端口以 wrangler 输出为准）。
   想以 Node 容器方式调试后端，用 `pnpm run build && pnpm run start`。

### 常用脚本

| 命令                      | 说明                                                           |
| :------------------------ | :------------------------------------------------------------- |
| `pnpm run dev:unified`    | 拉取官方前端产物后启动 `wrangler dev`（边缘环境模拟）           |
| `pnpm run dev:worker`     | 只启动 `wrangler dev`（需 `dist/` 里已有前端产物）              |
| `pnpm run fetch:frontend` | 只重新拉取并构建官方前端产物到 `dist/`                          |
| `pnpm run build`          | 构建完整生产产物（官方前端 `dist/` + 边缘后端 `dist-server/`）  |
| `pnpm run build:edge`     | 只打包边缘后端（`scripts/build-edge.mjs`）                      |
| `pnpm run start`          | 用 Node 容器方式启动已构建的后端                                |
| `pnpm run lint`           | 执行 TypeScript 类型检查（`tsc --noEmit`）                      |
| `pnpm run format`         | 使用 Prettier 格式化 `src/backend/**/*.ts`                      |
| `pnpm run test:all`       | 依次运行全部单元测试与回归测试                                  |
| `pnpm run env:check`      | 检查运行环境变量是否齐备                                        |

> `test:*` 还按模块细分：`test:189`、`test:drivers`、`test:server`、`test:store`、
> `test:dialect`、`test:dsn`、`test:http-sql`、`test:regress`，可单独运行。
> 全部命令以 `package.json` 的 `scripts` 为准。

---

## 🧱 核心架构与开发规范

```
openlist-next/
├── api/                     # 边缘 / Serverless 入口（[...route].ts 等）
├── cloud-functions/         # EdgeOne 平台扫描的 Node 云函数产物，由构建脚本生成、需随源码提交
├── docs/                    # 部署与存储文档
├── netlify/functions/       # Netlify Functions 入口
├── scripts/                 # 构建与工具脚本
├── src/
│   └── backend/             # 后端全部源码（前端不在本仓库，构建时另行拉取）
│       ├── drivers/         # 各网盘 / 协议驱动实现
│       ├── durable-objects/ # Cloudflare Durable Objects
│       ├── internal/        # 核心逻辑（驱动接口、数据模型、操作层、流式读取等）
│       ├── pkg/             # 通用工具（加密、HTTP、MIME、校验、权限等）
│       └── server/          # Hono 路由（auth / admin / fs / share / task / mcp 等）
└── tests/                   # 跨模块测试
```

### 全栈 Web 标准优先与边缘兼容（重要）

OpenList 的后端设计目标是**跨平台与边缘原生**（既能在 Node.js 容器运行，也能部署在 Cloudflare Workers、Vercel、AWS Lambda 等边缘无服务器环境）：

1. **必须使用标准 Web API**：
   - 使用 `fetch`、`Web Crypto` (`crypto.subtle`)、`ReadableStream`、`Headers`、`Response` 等标准 Web API。
2. **禁止在通用后端直接引入 Node.js 独占模块**：
   - 禁止在 `src/backend/server/` 或通用驱动中静态引入 `fs`、`path`、`net`、`child_process` 等 Node 原生包。
   - 如需仅限 Node.js 容器的功能，必须使用动态导入 `await import(...)` 并做好运行环境检测隔离
     （store 层的 `mysql` / `hyperdrive` 驱动就是这样，靠 `mysql2` 直连 TCP）。
   - 只在 Node / Docker 里跑得起来的挂载驱动（当前为 `ftp` / `sftp` / `smb`）**不会下发给边缘运行时**：
     `src/backend/server/admin.ts` 的 `NODE_ONLY_DRIVERS` 会在非 Node 运行时把它们从「新增存储」的下拉里
     摘掉，免得用户选完填完、保存时才发现报错。其中 `sftp` / `ftp` 另会在边缘构建阶段被
     [`scripts/build-edge.mjs`](scripts/build-edge.mjs) 的 `emptyNodeDriverPlugin` 替换为空实现（构造时抛错）。
     **新增此类驱动时，要同步更新 `NODE_ONLY_DRIVERS`，并把驱动目录与相关原生包加入该插件的过滤规则**，
     否则边缘平台会因缺少 `.node` 文件 loader 而打包失败。
3. **数据持久化适配**：
   - 核心数据操作通过模型层抽象（`src/backend/internal/model/store/`），共 **16 个 store 驱动**，由 `DB_DRIVER`
     选择（`auto` 会按当前平台自动挑），`DB_FORMAT` 决定落库形态（`map` / `key` / `sql`）：
     - **平台自带的存储绑定**（7 个）：`blob` / `kv` / `cfkv` / `d1` / `do` / `r2` / `netlifyblobs`
     - **走 HTTP 连外部数据库或对象存储**（7 个，边缘也能用）：`neon` / `turso` / `pgrest` / `pghttp` /
       `mysqlhttp` / `upstash` / `s3`
     - **需要 Node 运行时**（2 个，靠 `mysql2` 直连 TCP）：`mysql` / `hyperdrive`
   - 新增 store 驱动要同步登记 `backend.ts` 的 `DRIVER_MAP`、`EXTERNAL_DRIVER_ORDER`、`NO_STORAGE_MESSAGE`，
     并在 `types.ts` 的 `StorageDriver` 联合类型里加上名字，否则会被判定成「没有可用的存储」。

### 添加新的存储驱动 (Storage Driver)

若需支持新的网盘或对象存储，请按以下步骤实现：

1. **在 `src/backend/drivers/<driver_name>/` 创建驱动目录**：
   - `types.ts`：定义该网盘的附加配置项（Addition）与 API 数据结构。
   - `util.ts`：封装与该网盘开放平台/接口交互的 Client 类。
   - `driver.ts`：实现 `StorageDriver` 接口（定义于 `src/backend/internal/driver/base.ts`）。
2. **实现 `StorageDriver` 接口方法**：
   - `list(virtualPath, physicalPath)`: 获取目录文件列表
   - `get(virtualPath, physicalPath)`: 获取单文件详情/下载直链
   - `mkdir(virtualPath, physicalPath)`: 创建目录
   - `rename(virtualPath, physicalPath, newName)`: 重命名
   - `remove(virtualPath, physicalPath, names)`: 删除文件/目录
   - `move` / `copy` / `put`（按网盘支持能力选择实现）
3. **注册驱动**：
   - 在 `src/backend/internal/op/storage.ts` 的 `createDriver()` 里加分支。**注意分支顺序**：判断用的是
     `startsWith()` / `includes()`，把宽泛的条件写在前面会抢走更具体的驱动（比如 `123` 会抢走
     `123PanShare`、`onedrive` 会抢走 `Onedrive Sharelink`），所以更具体的要写在前面。
   - 在 `src/backend/server/admin.ts` 的 `driverConfigs`（体量较大的另放在
     `src/backend/server/driver-configs.extra.ts` 的 `EXTRA_DRIVER_CONFIGS`）里补一份驱动配置元数据。
     这两处合起来就是 `GET /admin/driver/list` 的返回键，也是前端「新增存储」下拉的唯一来源 ——
     **漏了这一步，驱动实现了但界面上选不到**。
   - 最后跑 `node scripts/audit-driver-configs.mjs` 自查，它查三项：路由是否可达、配置里有没有多余字段、
     有没有读了却没声明的字段，正常应全部为 0。

### 前端开发规范 (SolidJS)

- UI 组件库使用 `@hope-ui/solid` 与原生 CSS，避免引入冗余庞大的样式库。
- 遵循 SolidJS 细粒度响应式最佳实践（正确使用 `createSignal`、`createMemo`、`createStore`，避免解构 props 导致丢失响应性）。
- 注意暗色模式 (Dark Mode) 与移动端响应式布局的适配。

### 国际化翻译 (i18n)

本仓库不保存前端源码：构建时 `scripts/fetch-frontend.mjs` 会克隆官方前端
[OpenList-Frontend](https://github.com/OpenListTeam/OpenList-Frontend)，再下载官方随 release
发布的翻译包 `i18n.tar.gz` 解压进 `src/lang/`。官方仓库的 `src/lang/` **只提交英文**，
中文等语言全部来自那份翻译包（目前包里只有 `zh-CN` 与 `zh-TW`）。

**为什么中文界面会混英文**：前端合并词典的写法是

```ts
// OpenList-Frontend 的 src/app/i18n.ts
const flatDict = i18n.flatten(dict) // 把嵌套词典拍平成 "init.env_check" 这样的键
return { ...enDict, ...flatDict } // 英文铺底，当前语言覆盖
```

所以某个键只要在翻译包里不存在，界面上就直接显示英文。而翻译包由 Crowdin 异步产出，
必然落后于英文源 —— 实测 zh-CN 的 `init.json` 只有 11 个键，同一提交的英文源有 51 个，
整个初始化向导在中文界面下都是英文。

**补齐机制**：

| 文件                                         | 作用                                                                 |
| :------------------------------------------- | :------------------------------------------------------------------- |
| `scripts/i18n-overrides/<语言>.json`         | 按语言包文件名分组的补丁，只覆盖列出的键，其余原样保留                |
| `scripts/i18n-overrides/<语言>.allowed.json` | 白名单：确实该保持英文的键（Cookie / S3 / 驱动产品名…），每条写明理由 |
| `scripts/i18n-patch.mjs`                     | 构建时执行，深合并补丁、回读校验，并报告仍会显示英文的键              |

上游补齐后同名键仍会被补丁覆盖（值一致时无影响）；想撤销某条，把补丁里的键删掉即可。

**新增界面文案后怎么办**：如果上游翻译包还没跟上，构建日志会点名：

```
[i18n-patch] zh-CN: ACTION REQUIRED — 3 key(s) would show English in this locale
[i18n-patch]   missing      init.json::new_key = "New key"
[i18n-patch]   untranslated plugins.json::empty_desc = "No description provided"
```

按提示把该键加进 `scripts/i18n-overrides/<语言>.json`（若该词本就该是英文，则加进
`<语言>.allowed.json`）。补丁里按语言包的文件名与嵌套层级写即可，例如
`{ "init.json": { "new_key": "新文案" } }`。

两点注意：

- 补丁只在「克隆前端源码构建」时生效。若设置了 `FRONTEND_DIST` 直接使用现成 dist 产物，
  没有前端源码可改，补丁不会生效。
- 只改翻译也会触发 `cloud-functions/[[default]].js` 产物重建 —— `scripts/i18n-patch.mjs`
  与 `scripts/i18n-overrides/**` 已写进
  [`edgeone-artifact-guard.yml`](.github/workflows/edgeone-artifact-guard.yml) 的 `paths`。
  以后新增其它构建输入时记得照做，否则补丁进不了部署包。

---

## 📌 Git 提交规范 (Commit Convention)

提交信息请遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范，格式如下：

```
<type>(<scope>): <subject>
```

### 常用 Type 类型

- `feat`: 新增功能特性
- `fix`: 修复 Bug
- `docs`: 文档变动
- `style`: 代码格式调整（不影响逻辑的空格、分号等）
- `refactor`: 重构代码（既不修复 bug 也不添加新功能）
- `chore`: 构建过程、辅助工具或依赖项的变动
- `ci`: CI 工作流与自动化脚本的变动
- `perf`: 性能优化

### 提交信息写成双语（英文在上、中文在下）

先写英文说明，再用 `---` 分隔写一段对应的中文。这样非中文读者也能看懂 history，中文读者读到的也不是
翻译腔。标题行同样各写一次：

```
fix(i18n): fill the gaps left by the official translation pack

The pack lags behind the English source, so any key it is missing falls back
to English in the UI.

---
fix(i18n): 补齐官方翻译包漏掉的那些键

翻译包落后于英文源，缺哪个键，界面上就会退回显示英文。
```

### 示例

- `feat(driver): add quark drive upload support`
- `fix(fs): resolve range header streaming issue`
- `docs(readme): update deployment instructions`
- `refactor(auth): simplify token verification flow`

---

## 🔀 Pull Request (PR) 流程

1. **创建分支**：从最新的 `main` 分支切出新分支：
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. **编写代码与自测**：
   - 编写优雅、注释清晰的代码。
   - 在本地充分测试变更功能及周边逻辑。
3. **提交前自检**：

   ```bash
   # 1. 确保无 TypeScript 类型错误
   pnpm run lint

   # 2. 格式化代码
   pnpm run format

   # 3. 确保构建通过
   pnpm run build
   ```

4. **推送分支并发起 PR**：
   - 把分支推到你自己的 Fork；本仓库维护者可以直接把分支推到本仓库（`main` 保持只经 PR 合入）。
   - 向 `main` 发起 PR，按 [PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md) 填写描述。
   - PR 上会自动跑各平台的构建检查与凭据扫描，绿了再合并。

### PR 准备与自检清单

- [ ] 代码已通过 `pnpm run lint` 类型检查。
- [ ] 代码已通过 `pnpm run format` 格式化。
- [ ] 改动过的功能自己验过；没验的链路在 PR 摘要里说清（CI 会在 PR 上真跑各平台构建检查）。
- [ ] PR 标题符合 Conventional Commits 规范（`type(scope): summary`，有 scope 就写上）。
- [ ] 如涉及破坏性变更或配置调整，已在 PR 摘要中明确说明。
- [ ] 如改动 `src/**`、`api/**` 或构建脚本，已在本次 PR 内重建并提交 `cloud-functions/[[default]].js`。

### AI 辅助使用声明 (AI Disclosure)

本项目欢迎开发者合理使用 AI 工具提升开发效率。为了确保代码库的合规性与可维护性：

- 若 PR 中包含由 AI（如 ChatGPT、Claude、Copilot、Gemini 等）大量生成的代码或重构内容，请在 PR 模版中的 **AI Disclosure** 区域予以如实勾选与说明。
- 贡献者需自行审查并完全理解所提交的 AI 辅助内容，确保代码质量与安全性。

---

## 📜 行为准则与开源许可证

- **行为准则**：请保持友善、包容与互相尊重的沟通氛围。对技术实现有不同意见时，欢迎基于事实和规范进行建设性讨论。
- **开源许可证**：向本项目提交的所有贡献均默认遵循项目的 [AGPL-3.0 许可证](LICENSE)。在提交代码前，请确保你拥有提交该代码的版权或已取得合规授权。
