<div align="center">

# OpenList Next

<p><em>OpenList is a versatile directory listing tool that brings files scattered across various cloud drives, object storages, and protocol services into a single interface for browsing, previewing, downloading, and sharing.</em></p>
<p>This repository is a community fork of the official <a href="https://github.com/OpenListTeam/OpenList-Worker">OpenList-Worker</a>, written in TypeScript and deployable to edge platforms such as Cloudflare Workers, Tencent Cloud EdgeOne, and Alibaba Cloud ESA.</p>
<p>Building on the official version, this project fills the gap of "connecting directly to external databases on any edge platform."</p>

<a href="../LICENSE"><img src="https://img.shields.io/github/license/LegspCpd/openlist-next" alt="License" /></a>
<a href="https://github.com/LegspCpd/openlist-next/actions/workflows/edgeone-artifact-guard.yml"><img src="https://img.shields.io/github/actions/workflow/status/LegspCpd/openlist-next/edgeone-artifact-guard.yml?branch=main" alt="Build status" /></a>
<a href="https://github.com/LegspCpd/openlist-next/issues"><img src="https://img.shields.io/github/issues/LegspCpd/openlist-next" alt="Issues" /></a>
<a href="https://github.com/LegspCpd/openlist-next/discussions"><img src="https://img.shields.io/github/discussions/LegspCpd/openlist-next?color=%23ED8936" alt="Discussions" /></a>

📖 [Multi-platform Deployment Guide](../docs/DEPLOYMENT.md) · 🗄️ [External Storage Configuration](../docs/EXTERNAL_STORAGE.md) · 🔌 [One-click Database Connection](../docs/ONE_CLICK_DATABASE.md)

</div>

<div align="center">

English | [简体中文](../README.md) | [繁體中文](README_zh-TW.md) | [日本語](README_ja.md) | [한국어](README_ko.md) | [Français](README_fr.md)

[Upstream Project](https://github.com/OpenListTeam/OpenList-Worker) · [Contributing Guide](../CONTRIBUTING.md) · [License](../LICENSE) · [Source and License Notice](../NOTICE.md)

</div>

> [!WARNING]
> This project is **not** an official OpenList release and has no affiliation, authorization, or endorsement relationship with OpenListTeam.
> If you encounter issues while using it, please open an Issue in this repository rather than reporting to the official repository.
> For the code source, copyright, and license information, see [NOTICE.md](../NOTICE.md).

---

## One-click Deployment

Click the buttons below to deploy this project to the corresponding platform:

<div align="center">

| EdgeOne · Global | EdgeOne · China | Cloudflare Workers |
| :---: | :---: | :---: |
| [![Deploy with EdgeOne](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?project-name=openlist-next&repository-url=https://github.com/LegspCpd/openlist-next&install-command=pnpm%20install%20--no-frozen-lockfile&build-command=pnpm%20run%20build&output-directory=dist&env=JWT_SECRET) | [![Deploy with EdgeOne](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://console.cloud.tencent.com/edgeone/makers/new?project-name=openlist-next&repository-url=https://github.com/LegspCpd/openlist-next&install-command=pnpm%20install%20--no-frozen-lockfile&build-command=pnpm%20run%20build&output-directory=dist&env=JWT_SECRET) | [![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/LegspCpd/openlist-next) |

| Vercel | Netlify |
| :---: | :---: |
| [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/LegspCpd/openlist-next) | [![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/LegspCpd/openlist-next) |

</div>

After deployment, you still need to configure environment variables. `JWT_SECRET` is required and can be generated with `openssl rand -hex 32`.

- EdgeOne: [Global Console](https://console.edgeone.ai/makers) · [China Console](https://console.cloud.tencent.com/edgeone/makers)
- Cloudflare: [Worker Dashboard](https://dash.cloudflare.com/)
- Vercel: Project Settings → Environment Variables
- Netlify: Site configuration → Environment variables

Commonly used variables:

- `JWT_SECRET`: the key used for session signing and field encryption, **required**
- `ADMIN_PASS`: optional; once set, skips the setup wizard and initializes the admin account directly with this password
- `DB_FORMAT`: how data is organized, `map` (default) / `key` / `sql`
- `DB_DRIVER`: where data is stored, `auto` (default, auto-detect) / `kv` / `d1` / `blob` / `neon` / `turso` / …
- `DATABASE_URL`: external database connection string. Fill it in and keep `DB_DRIVER=auto`, and the program will connect automatically.

> [!IMPORTANT]
> If Cloudflare shows "cannot fetch repository content", first [Fork](https://github.com/LegspCpd/openlist-next/fork) this repository, then deploy by connecting to the GitHub repository.

---

## Feature Overview

OpenList is a multi-storage aggregated file listing and management system that runs on edge computing platforms. It unifies files scattered across different cloud drives, object storages, and protocol services into a single interface for browsing, previewing, downloading, and management.

OpenList-Worker is the TypeScript + Serverless port of the official [OpenListTeam/OpenList](https://github.com/OpenListTeam/OpenList) project. Its backend was rewritten from Go into a TypeScript service running on Workers, while the frontend retains a consistent interface and interaction experience.

### Storage Aggregation

It ships with **81 storage drivers** and mounts various storage backends out of the box:

- **Domestic cloud drives**: Alibaba Cloud Drive (Open Platform / Share), Quark Cloud Drive (Open Platform / UC TV), Baidu Netdisk (Albums), 115 Cloud Drive (Open Platform / Share), 123 Cloud Drive (Open Platform / Share), Tianyi Cloud (189 / PC / TV), China Mobile Cloud (139 / Hecaiyun), Wo Home Cloud, Xunlei Cloud Drive, Tencent Weiyun, Lanzo Cloud, PikPak (Share), Doubao Cloud Drive, Guangya Cloud, Chaoxing Group Cloud, Lenovo NAS Share, Teambition Cloud, WPS Cloud, Alibaba Docs, HalalCloud, MediaTrack, etc.
- **International cloud drives**: Google Drive (Albums), OneDrive (App / Share Link), Dropbox, MEGA, MediaFire, Proton Drive, Yandex Disk, Degoo, Bunny Storage, TeraBox, etc.
- **Object storage**: S3-compatible (AWS / OSS / COS / MinIO, etc.), UpYun USS, Azure Blob, WebDAV, FTP, SFTP, SMB, IPFS, etc.
- **Code hosting**: GitHub, GitHub Releases, CNB Releases
- **Cloud drive software**: OpenList (Share), AList V3, Cloudreve V3/V4, Kodbox (Kodcloud), Seafile, Teldrive, Febbox, etc.
- **Other drivers**: NetEase Cloud Music, Misskey, Emby, Cloudflare image hosting, etc.

In addition to the real storages above, it also provides virtual/functional drivers such as `Local`, `Alias`, `UrlTree`, `AutoIndex`, `Strm`, `Crypt`, `Virtual`, `Chunk`, which can be used for local mounting, address aliasing, URL listing, encrypted storage, and chunking.

### Core Capabilities

- **File browsing**: unified directory tree browsing, with online preview support for images, videos, audio, documents, code, archives, and more.
- **Upload and download**: cross-storage uploads, batch downloads, streaming transfers, and direct-link redirection.
- **File sharing**: generate share links with expiration, password, and permission controls, supporting anonymous access and directory sharing.
- **Full-text search**: quickly search files across indexed storages.
- **Offline tasks**: background task queue supporting batch operations and asynchronous processing.
- **External interfaces**: expose the aggregated storage via WebDAV or S3-compatible protocols for mounting into third-party tools.
- **MCP service**: provides Model Context Protocol endpoints that can be integrated and called by clients such as AI assistants.

### Permission Management

- **Permission management**: role-based access control (RBAC), supporting user grouping, directory-level read/write permissions, and quotas.
- **Authentication methods**: built-in account/password, supporting TOTP verification, WebAuthn/FIDO login, SSO single sign-on, and LDAP directory authentication.
- **Security hardening**: JWT sessions, CSRF protection, clickjacking protection (X-Frame-Options), and Content Security Policy (CSP).
- **Health checks**: provides the `/health` liveness probe and the `/healthz` readiness probe, usable for monitoring and alerting.

### Platform Deployment

- **Runtime platforms**: Cloudflare Workers, Tencent Cloud EdgeOne Makers, Alibaba Cloud ESA, Vercel, Netlify, and Node.js container environments.
- **Data storage**: platform-native storage (KV / D1 / Blob …) or any external database.
- **One-click deployment**: supports one-click deploy buttons for EdgeOne, Cloudflare Workers, Vercel, and Netlify.

---

## How Is This Different from the Official Version

| | Official OpenList-Worker | This Project |
|---|---|---|
| Storage drivers | 7 | 15, newly added neon / turso / pgrest / pghttp / mysqlhttp / upstash / r2 / s3 |
| SQL dialects | SQLite, MySQL | added PostgreSQL (including `$n` placeholders) |
| Cloud drive drivers | 78 | 81, with `123_link`, `ilanzou`, `halalcloud` added |
| Deployment platforms | Cloudflare Workers, EdgeOne, ESA, Serverless | added Vercel, Netlify, Node/Docker |

In the official version, the `mysql` driver can only run in a Node container—Cloudflare Workers has no raw TCP, so deploying to the edge means you can only use the platform-native KV. All 8 storage drivers newly added in this project are implemented on top of `fetch`, so they can connect to external databases even on edge runtimes; you just need to fill in a `DATABASE_URL`.

For details, see the [External Storage Configuration Guide](../docs/EXTERNAL_STORAGE.md).

---

## Manual Deployment

### Prerequisites

- Node.js **22.x**
- pnpm **9.15.4** (enabled via corepack)
- If deploying to Cloudflare Workers, you need a Cloudflare account

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
```

### Local Development

```bash
git clone https://github.com/LegspCpd/openlist-next.git
cd openlist-next
pnpm install

cp .dev.vars.example .dev.vars
openssl rand -hex 32        # generate JWT_SECRET and put it into the file above

pnpm run dev:unified        # fetch the official frontend and start the Worker
pnpm run dev:worker         # start the Worker only
```

> `pnpm run build` will first clone the official frontend repository OpenList-Frontend and compile it into `dist/`, then compile the backend into `dist-server/`.
> If you already have the frontend artifacts locally, you can skip the cloning with `FRONTEND_DIST=/path/to/dist pnpm run build`.
> Two dependencies come from GitHub (`@hope-ui/solid`, `mpegts.js`), so the first install being slow is normal.

### Deploy to Cloudflare Workers

Using the command line:

```bash
npx wrangler login
openssl rand -hex 32 | npx wrangler secret put JWT_SECRET

pnpm run build
pnpm run deploy:worker
```

You can also connect a Git repository in the Cloudflare dashboard: set the build command to `pnpm run build` and leave the output directory blank—wrangler will read `wrangler.jsonc`.

Regarding storage: `wrangler.jsonc` already declares a KV binding by default. On the first deployment, wrangler automatically creates `openlist-next-kv` and binds it; subsequent deployments reuse it, so you don't need to create it manually. To switch to D1, R2, or Durable Objects, just uncomment the corresponding section in `wrangler.jsonc`—the exact syntax is documented in the file's comments.

> Note: before running `wrangler deploy` or `wrangler dev` locally, you must always run `pnpm run build` first.
> The `assets.directory` in `wrangler.jsonc` points to `./dist`, but this directory does not exist by default (it is ignored by `.gitignore`),
> and running it directly will report `The directory specified by the "assets.directory" field ... does not exist`.
> When using the one-click deploy button or connecting a Git repository in the dashboard, the platform builds automatically and is unaffected.

> Do not set `DB_DRIVER` to `mysql`—Cloudflare Workers has no raw TCP, so this driver cannot run on the edge.
> To connect to external MySQL, use `mysqlhttp` (requires a self-hosted HTTP gateway) or switch to `neon` / `turso`.

### Deploy to Tencent Cloud EdgeOne

Both the [Global site](https://edgeone.ai/) and the [China site](https://console.cloud.tencent.com/edgeone) work.

You can click the one-click deploy button above, or create a project in the console and import a Git repository, setting the build command to `pnpm run build` and the output directory to `dist`. These settings are also present in `edgeone.json`; the file is authoritative.

> **Important**: `cloud-functions/[[default]].js` is a build artifact, but EdgeOne reads it from the repository at deploy time, so it must be committed to the repository and must not be added to `.gitignore`.
> Without this file, EdgeOne will report `No server-handler detected`, and the project will degrade into a pure static site.
> The `EdgeOne Artifact Guard` workflow in the repository automatically rebuilds and commits the artifact when it expires, so manual maintenance is generally unnecessary.

Regarding storage: EdgeOne's KV and Blob are only injected into **edge functions**, not Node cloud functions. Therefore, this project uses two entry points on EdgeOne:

| File | Role |
|---|---|
| `api/_makers.ts` (build artifact `cloud-functions/[[default]].js`) | Node cloud function, the backend core |
| `functions/*` | edge function, responsible for KV proxying and storage probing |
| `middleware.js` | edge middleware, responsible for frontend route fallback |

When `DB_DRIVER` is left at the default `auto`, the program automatically selects storage in the following order:

1. External database (if you have configured `DATABASE_URL`)
2. **KV**: create a namespace in the "KV Storage" section of the console, then bind it to the **edge function** (not the Node cloud function), set the binding variable name to `KV`, and then configure `EO_KV_URLS` and `JWT_SECRET`
3. **Blob**: no configuration needed; `@edgeone/pages-blob` automatically creates the store on first write

There are a few pitfalls to watch out for (this project already handles them, but keep them in mind if you change the configuration yourself):

- The `nodeVersion` in `edgeone.json` must be one of the versions preinstalled on the platform (14.21.3 / 16.20.2 / 18.20.4 / 20.18.0 / 22.11.0 / 22.17.1 / 22.21.1 / 24.5.0 / 24.11.0 / 24.18.0); any other value will cause the build to fail. This project uses `22.21.1`. This field overrides the project settings in the console
- `maxDuration` must be written inside `cloudFunctions.nodejs`; writing it as `cloudFunctions.maxDuration` has no effect
- Frontend route fallback is handled by `middleware.js` at the root. The `rewrites` in `edgeone.json` only apply to static assets. The official documentation explicitly states that frontend routing is not supported, and adding `/*` would instead match static files
- Do not use temporary domains like `*.edgeone.cool` to verify storage—this domain carries site-wide authentication parameters that will intercept the KV proxy requests between edge functions and cloud functions. Bind a custom domain first, then verify

If you prefer not to use the one-click deploy button, you can also use the Makers CLI:

```bash
EO_PAGES_PROJECT=openlist-next \
EO_PAGES_API_TOKEN=<token from the console> \
pnpm run deploy:edgeone -- --url https://your-domain --deep
```

This script builds, deploys, and then automatically checks whether the storage is actually usable.

### Deploy to Vercel

After clicking the deploy button, a **Marketplace Database Providers** list appears at the bottom of the deployment page; pick one and click "Connect." Vercel automatically injects the connection info as environment variables, and this project's `DB_DRIVER=auto` can recognize and connect to it automatically—no code changes needed.

Support status: Neon, Upstash, Supabase, and Turso work directly; Nile, Prisma Postgres, and AWS RDS require a Postgres-over-HTTP gateway; Redis (raw TCP), MongoDB, Convex, and MotherDuck cannot be used in edge environments. For the full explanation, see [One-click Database Connection](../docs/ONE_CLICK_DATABASE.md).

You can also use Import Git Repository in the Vercel console, selecting **Other** for framework detection (the configuration is all in `vercel.json`), or use the command line:

```bash
npx vercel login
npx vercel deploy --prod --yes

# or complete build, deploy, and storage check in one command
pnpm run deploy:vercel -- --url https://your-domain
```

Vercel's function execution limit defaults to 10 seconds per invocation (60 seconds on Pro). For very large directories this may time out, so it is recommended to use `DB_FORMAT=map` to reduce database round trips.

### Deploy to Alibaba Cloud ESA

Create a project in the ESA console under "Edge Computing → Functions and Pages" and import the GitHub repository. Set the build command to `pnpm run build`, the static asset directory to `./dist`, and the function file path to `./dist-server/esa-entry.js`.

You can also use the command line:

```bash
pnpm install
pnpm run build

npx esa-cli login
npx esa-cli commit
npx esa-cli deploy

# or complete build, commit, deploy, and storage check in one command
pnpm run deploy:esa -- --url https://your-domain
```

There are two key configurations in `esa.jsonc`:

- `entry` points to `./dist-server/esa-entry.js`. The server-side artifact is deliberately placed in `dist-server/` rather than `dist/`, otherwise it would be publicly downloadable as a static file
- `assets.notFoundStrategy` is set to `singlePageApplication`. Without this, frontend routes such as `/login` and `/@manage/*` would return a 404 directly

ESA limits the number of KV subrequests per request. If you insist on using the platform-native EdgeKV, it is recommended to use `DB_FORMAT=map` (the whole database in one key, one read and one write each).

### Deploy to Netlify

Simply connect a Git repository in Netlify—the build configuration is already written in `netlify.toml`—or use the command line: `netlify deploy --build --prod`.

Netlify has no platform-level storage, so it must connect to an external database. Configure environment variables under **Site configuration → Environment variables**, for example:

```bash
JWT_SECRET=<random string>
DATABASE_URL=postgres://user:pass@ep-xxx.neon.tech/neondb
DB_FORMAT=map
```

> Netlify Functions have a per-invocation limit of 10 seconds (26 seconds on Pro). Cold starts combined with cloud-drive API round trips can easily time out, so for production it is recommended to prefer Cloudflare Workers.

### Deploy to Node / Docker

This is the only scenario where you can use `DB_DRIVER=mysql` to connect directly over TCP.

```bash
pnpm install
pnpm run build
pnpm start
```

Environment variables are written in `.env` at the root (`loadEnv.js` reads it):

```bash
JWT_SECRET=<random string>
DATABASE_URL=mysql://user:pass@127.0.0.1:3306/openlist
DB_DRIVER=mysql
DB_FORMAT=sql
```

---

## Post-deployment Checks

Successful deployment and usable storage are two different things. The worst case is the storage driver silently falling back to memory mode: the site opens and you can log in, but all data is lost on restart.

```bash
curl https://your-domain/api/public/env_check
```

In the response, pay attention to these fields:

- `data.storage.memory`: `true` means the store fell back to memory and data is lost on restart — this must be fixed (in that case `data.config.resolved_driver` is `memory`)
- `data.jwt.ready`: whether `JWT_SECRET` is configured. If not, encrypted fields such as mount credentials cannot be decrypted
- `data.ready`: whether everything is ready overall
- `data.issues`: the problem list, where each entry carries a `code` (such as `STORAGE_MEMORY_ONLY` or `JWT_SECRET_MISSING`) — the fastest place to start troubleshooting

You can also let the unified script check for you (check only, no redeploy):

```bash
pnpm run deploy:edgeone -- --no-deploy --url https://your-domain
pnpm run deploy:esa     -- --no-deploy --url https://your-domain
pnpm run deploy:vercel  -- --no-deploy --url https://your-domain
```

An exit code of `0` means the storage is ready, and `2` means it is not yet ready. On EdgeOne, it additionally reads `/storage-probe` once to tell you whether KV and Blob are usable respectively.

---

## Technical Architecture

### Backend

- **Runtime**: Cloudflare Workers / Tencent Cloud EdgeOne / Alibaba Cloud ESA / Vercel / Netlify / Node.js container
- **Web framework**: Hono.js
- **Language**: TypeScript
- **Build tools**: Wrangler, esbuild

### Frontend

- **Framework**: React 19 + TypeScript
- **UI library**: Ant Design / Material-UI
- **Build tool**: Vite

> The frontend is not in this repository; it is fetched from the official repository by `scripts/fetch-frontend.mjs` at build time.

---

## Configuration

### Where to put the variables

The same variable name works exactly the same no matter where you put it.

| Deployment | Where to put it |
|---|---|
| Cloudflare Workers | Project Settings → Variables and Secrets in the dashboard; or run `wrangler secret put JWT_SECRET` in the terminal |
| Tencent Cloud EdgeOne | The "Environment Variables" of the project in the console; the deploy page asks for them directly when you click the one-click deploy button |
| Vercel / Netlify | Environment Variables in project settings |
| Node / Docker | The `.env` file in the root directory |

Below, each variable is explained as: variable name — what it does — whether you need to fill it in.

### Required

| Variable | What it does | Required? | How to fill |
|---|---|---|---|
| `JWT_SECRET` | The secret key for the whole program. It handles three things: signing login sessions, encrypting stored drive credentials, and authenticating scheduled tasks | **Required**. If left empty, mounting drives will fail after installation | A random string, at least 16 characters. Generate one with `openssl rand -hex 32` and paste it in |

> [!IMPORTANT]
> If `JWT_SECRET` is changed or filled in wrong, the drive credentials stored earlier can no longer be decrypted, which shows up as "mounting suddenly asks you to re-enter". When the same data is deployed on multiple platforms, the `JWT_SECRET` on each platform must stay identical.

### Where data is stored

Two variables decide which storage the data lands in and how it is structured.

| Variable | What it does | Required? | Accepted values |
|---|---|---|---|
| `DB_DRIVER` | Which storage the data is stored in | Optional, defaults to `auto` | `auto`, `kv`, `d1`, `r2`, `blob`, `cfkv`, `do`, `neon`, `turso`, `pgrest`, `pghttp`, `mysqlhttp`, `upstash`, `s3`, `hyperdrive`, `netlifyblobs`, `mysql` |
| `DB_FORMAT` | How the data is organized | Optional, defaults to `map` | `map`, `key`, `sql` |

- `auto` picks in this order: the external database you configured → the platform-native storage (KV, D1, Blob, etc.). When unsure, use `auto`.
- `map`: the entire database is stored as one JSON, one read and one write, saves the most requests, good for KV and object storage.
- `key`: one record per entity, e.g. `users_1`. Saves more traffic than `map` when there are many entities.
- `sql`: stored with relational tables, same schema as the Go version of OpenList, can share the same database with the Go version.
- `mysql` only works in Node / Docker. Edge platforms have no raw TCP, so it can't connect.

Common combinations:

```bash
# Cloudflare Workers + D1
DB_FORMAT=sql
DB_DRIVER=d1

# EdgeOne + Blob (no setup needed, created on first write)
DB_FORMAT=map
DB_DRIVER=blob

# External database, e.g. Neon
DB_FORMAT=map
DB_DRIVER=auto
DATABASE_URL=postgres://user:pass@ep-xxx.neon.tech/neondb
```

### External databases (fill in when you don't want to use platform-native storage)

The easiest way is to **fill in only a single `DATABASE_URL` and keep `DB_DRIVER` as `auto`**, the program recognizes the vendor from the protocol and hostname.

| Variable | What it does | Required? |
|---|---|---|
| `DATABASE_URL` | A general database connection string; the recognized vendor's driver is used | Enough in most cases when using an external database |
| `SUPABASE_KEY` | Supabase read/write key, needed when a single connection string is not enough | Required when using Supabase |
| `TURSO_AUTH_TOKEN` | Turso access token | Required when using Turso |
| `MYSQL_HTTP_URL` | MySQL / MariaDB HTTP forwarding gateway address. Edge platforms can only reach MySQL through it | Required when using MySQL on the edge |
| `PG_HTTP_URL` | Your own Postgres HTTP gateway address | Required when using a self-hosted gateway |
| `MYSQL_URLS` | MySQL direct connection string, only available in Node / Docker | Fill in when connecting to MySQL directly in Node |

For how to write each vendor's connection string and which variable aliases are supported, see [External Storage Configuration Guide](../docs/EXTERNAL_STORAGE.md).

### Platform bindings (no need to fill in by hand, just bind them)

These are injected into the environment by the platform at deploy time; you only need to create the resource in the console and name the binding as shown below.

| Variable | What it does | Do you need to manage it? |
|---|---|---|
| `DB` | Cloudflare D1 database binding, used when `DB_DRIVER=d1` | Bind it if you want D1, name it `DB` |
| `KV` | Cloudflare KV / EdgeOne KV namespace binding, used when `DB_DRIVER=kv` | Bind it if you want KV, name it `KV` |
| `HYPERDRIVE` | Cloudflare Hyperdrive connection string, lets the edge reach MySQL, used when `DB_DRIVER=hyperdrive` | Bind it if you want Hyperdrive |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Bucket name and access credentials for S3-compatible object storage (R2 / MinIO / B2, etc.), used when `DB_DRIVER=s3` | Fill in all five when using S3 storage |
| `CF_ACCOUNT`, `CF_KV_UUID`, `CF_API_KEY` | Read/write KV over the Cloudflare REST API, used when `DB_DRIVER=cfkv`. They are the account ID, KV namespace ID, and an API Token with KV read/write permission, respectively | Fill in all three when using `cfkv` |

### Other variables (most can be left alone)

| Variable | What it does | Required? |
|---|---|---|
| `EO_KV_URLS` | EdgeOne only. EdgeOne's KV binding is only given to edge functions; Node cloud functions can't get it, so it must go through an edge function proxy in the same deployment. Put that proxy address here | Usually left empty; if empty, the current domain is used automatically; only needed for cross-origin or local debugging |
| `ADMIN_PASS` | If set, skips the setup wizard and creates the admin account directly with this password | Optional, set it in the browser wizard if not filled |
| `ALLOW_URLS` | Cross-origin allowlist, comma-separated. If not set, only same-origin requests are allowed | Fill in when the frontend and backend are on different domains |
| `ASSET_URLS` | Load frontend static assets from a CDN, supports `$version` as a placeholder for the current frontend version | Fill in when using a CDN |
| `MAX_UPLOAD` | Overall size limit for a single upload, in bytes | Optional, defaults to 26214400 (25MB) |
| `MAX_UPPART` | Size limit per chunk in chunked uploads, in bytes | Optional, defaults to 16777216 (16MB) |
| `ALLOW_SEED` | Allowlist of sites permitted as seed-data sources | Fill in when using the seed feature |

### Command-line only (not filled into environment variables)

| Variable | What it does |
|---|---|
| `EO_PAGES_PROJECT` | Which project the EdgeOne Makers CLI deploys to |
| `EO_PAGES_API_TOKEN` | API Token from the EdgeOne Makers console, for the CLI |
| `EO_PAGES_URL` | The domain after deployment, used by `pnpm run deploy:edgeone` for post-deploy checks |

Every variable is listed with comments in the [variable template](../.dev.vars.example).

---

## FAQ

| Symptom | Cause and Solution |
|---|---|
| Shows `No storage backend is available` | No storage is configured at all. Fill in `DATABASE_URL`, or bind KV / D1 / Blob on the platform. Check `data.issues` in the `/api/public/env_check` response to see which one is missing. |
| Re-initialization required after every restart | Data is not persisted and fell back to in-memory storage. Check `/api/public/env_check`: `data.storage.memory` is `true` (or `data.issues` contains `STORAGE_MEMORY_ONLY`). |
| Page returns 404 but the API works | Static assets were not uploaded. Confirm that the build produced `dist/` and that the platform's static asset directory points to it. |
| Cannot log in, or netdisk mounts fail, after changing `JWT_SECRET` | Passwords, netdisk credentials and OTP secrets are encrypted with `JWT_SECRET` before being written to the store, so a new key cannot decrypt them (the log shows `Failed to decrypt a sealed secret (wrong JWT_SECRET?)`). Restore the old value, or re-enter the password and netdisk credentials. |
| Data becomes inconsistent when two platforms share one store | Their `JWT_SECRET` values differ, so the encrypted fields cannot be decrypted. Platforms sharing one store must use the same value; platforms with separate stores do not. |
| KV returns 401 on EdgeOne | `JWT_SECRET` differs between the Node cloud function and the Edge Function (or it was rotated). Use the same value on both, or point `EO_KV_URLS` at the correct deployment origin. |
| Reports `Storage driver "mysql" is not available in this runtime` | `DB_DRIVER=mysql` is set on an edge runtime, but this driver only works in a Node container. Switch to `mysqlhttp`. |
| Supabase returns 404 | The `kv` table does not exist; create it first: `CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);`. Note that Supabase uses PostgREST, which only supports KV — `DB_FORMAT=sql` is not supported. |

---

## Common Commands

```bash
pnpm run dev:worker     # start the Worker dev server
pnpm run dev:unified    # fetch the frontend and start the Worker
pnpm run build          # build the frontend and backend
pnpm run lint           # TypeScript type checking
pnpm run test:all       # run all unit tests
pnpm run format         # format code with prettier
```

---

## Help & Support

If you encounter problems during use, you can get help through the channels below:

- 🐛 **Submit a bug or feature request**: please go to [_Issues_](https://github.com/LegspCpd/openlist-next/issues) in this repository
- 💬 **General questions and discussion**: please go to the [_Discussions_](https://github.com/LegspCpd/openlist-next/discussions) area in this repository

## Open Source License

This project is released under the [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.txt) license.

## Contact Us

🌐 [@LegspCpd](https://github.com/LegspCpd) · 📦 [openlist-next](https://github.com/LegspCpd/openlist-next) · 🐛 [Issues](https://github.com/LegspCpd/openlist-next/issues)

## Contributors

This project is developed and maintained by **LegspCpd**.

[![Contributors](https://contrib.rocks/image?repo=LegspCpd/openlist-next)](https://github.com/LegspCpd/openlist-next/graphs/contributors)

---

## Acknowledgements

The design and implementation of this project reference the following open-source projects; thanks to their authors and all contributors:

- [Alist](https://github.com/AlistGo/alist) project authors and all contributors
- [OpenList](https://github.com/OpenListTeam/OpenList) (Go version) project authors and all contributors
- [OpenList-Worker](https://github.com/OpenListTeam/OpenList-Worker) (official TypeScript port) project authors and all contributors
- [openlistnext](https://github.com/Polonium-salts/openlistnext) community project authors and all contributors

> The developers of the projects above are **not** contributors to this repository. This repository is independently developed and maintained by LegspCpd, and has no affiliation, authorization, or endorsement relationship with the aforementioned projects or OpenListTeam; it only draws on their work within the scope permitted by the open-source license. See [NOTICE.md](../NOTICE.md) for details.
>
> The frontend's copyright belongs to the developers of the official [OpenList-Frontend](https://github.com/OpenListTeam/OpenList-Frontend); this repository does not contain frontend source code.
