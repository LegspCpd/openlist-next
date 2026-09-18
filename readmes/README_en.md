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

## Introduction

OpenList Next brings files scattered across multiple cloud drives, object storages and protocol services into a single interface, so you can browse, preview, download, share and manage them in one place.

It is derived from the official [OpenList-Worker](https://github.com/OpenListTeam/OpenList-Worker), and adds one thing on top of it: connecting to an external database from any edge platform. See the comparison table in [Feature Overview](#feature-overview).

Read on in order, or jump straight to what you need:

- [One-click Deployment](#one-click-deployment) — deploy to EdgeOne, Cloudflare Workers, Vercel or Netlify with a button
- [Feature Overview](#feature-overview) — which cloud drives are supported, what it can do, and how it differs from the official version
- [Environment Variables](#environment-variables) — what each variable does, whether you need it, and what to put in
- [Manual Deployment](#manual-deployment) — run it locally, or deploy from the command line
- [Post-deployment Checks](#post-deployment-checks) — confirm storage is really connected, not silently falling back to memory
- [Technical Architecture](#technical-architecture) — the frameworks and build tools used
- [FAQ](#faq) — causes and fixes for the common errors

---

## One-click Deployment

Click the buttons below to deploy this project to the corresponding platform:

<div align="center">

| EdgeOne · Global | EdgeOne · China | Cloudflare Workers |
| :---: | :---: | :---: |
| [![Deploy with EdgeOne](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?project-name=openlist-next&repository-url=https://github.com/LegspCpd/openlist-next&install-command=pnpm%20install%20--no-frozen-lockfile&build-command=pnpm%20run%20build&output-directory=dist&env=JWT_SECRET) | [![Deploy with EdgeOne](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://console.cloud.tencent.com/edgeone/makers/new?project-name=openlist-next&repository-url=https://github.com/LegspCpd/openlist-next&install-command=pnpm%20install%20--no-frozen-lockfile&build-command=pnpm%20run%20build&output-directory=dist&env=JWT_SECRET) | [![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/LegspCpd/openlist-next) |

| Vercel | Netlify |
| :---: | :---: |
| [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FLegspCpd%2Fopenlist-next&project-name=openlist-next&env=JWT_SECRET,ADMIN_PASS&envDescription=Only%20these%20two%20are%20needed.%20JWT_SECRET%3A%20run%20%60openssl%20rand%20-hex%2032%60.%20ADMIN_PASS%3A%20your%20admin%20password%2C%20it%20skips%20the%20setup%20wizard.&envLink=https%3A%2F%2Fgithub.com%2FLegspCpd%2Fopenlist-next%2Fblob%2Fmain%2Freadmes%2FREADME_en.md%23environment-variables | [![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/LegspCpd/openlist-next) |

</div>

Vercel's deploy page asks for exactly two variables: `JWT_SECRET` (generate with `openssl rand -hex 32`) and `ADMIN_PASS` (the admin password; setting it skips the setup wizard on first visit). Everything else can stay empty until you use the feature it belongs to - see [Environment Variables](#environment-variables).

> [!IMPORTANT]
> If Cloudflare shows "cannot fetch repository content", first [Fork](https://github.com/LegspCpd/openlist-next/fork) this repository, then deploy by connecting to the GitHub repository.

---

## Feature Overview

These capabilities come from the official [OpenList-Worker](https://github.com/OpenListTeam/OpenList-Worker), the TypeScript + Serverless port of [OpenListTeam/OpenList](https://github.com/OpenListTeam/OpenList). The interface and interactions are the same on both sides; the differences are limited to storage and deployment.

### Storage Aggregation

It ships with **80 storage drivers** and mounts various storage backends out of the box:

- **Domestic cloud drives**: Alibaba Cloud Drive (Open Platform / Share), Quark Cloud Drive (Open Platform / UC TV), Baidu Netdisk (Albums), 115 Cloud Drive (Open Platform / Share), 123 Cloud Drive (Open Platform / Share), Tianyi Cloud (189 / PC / TV), China Mobile Cloud (139 / Hecaiyun), Wo Home Cloud, Xunlei Cloud Drive, Tencent Weiyun, Lanzo Cloud, PikPak (Share), Doubao Cloud Drive, Guangya Cloud, Chaoxing Group Cloud, Lenovo NAS Share, Teambition Cloud, WPS Cloud, Alibaba Docs, HalalCloud, MediaTrack, etc.
- **International cloud drives**: Google Drive (Albums), OneDrive (App / Share Link), Dropbox, MEGA, MediaFire, Proton Drive, Yandex Disk, Degoo, Bunny Storage, TeraBox, etc.
- **Object storage**: S3-compatible (AWS / OSS / COS / MinIO, etc.), UpYun USS, Azure Blob, WebDAV, IPFS, etc.
- **Code hosting**: GitHub, GitHub Releases, CNB Releases
- **Cloud drive software**: OpenList (Share), AList V3, Cloudreve V3/V4, Kodbox (Kodcloud), Seafile, Teldrive, Febbox, etc.
- **Other drivers**: NetEase Cloud Music, Misskey, Emby, Cloudflare image hosting, etc.

In addition to the real storages above, it also provides virtual/functional drivers such as `Alias`, `UrlTree`, `AutoIndex`, `Strm`, `Crypt`, `Virtual`, `Chunk`, which can be used for address aliasing, URL listing, encrypted storage, and chunking.

### Core Capabilities

- **File browsing**: unified directory tree browsing, with online preview support for images, videos, audio, documents, code, archives, and more.
- **Upload and download**: cross-storage uploads, batch downloads, streaming transfers, and direct-link redirection.
- **File sharing**: generate share links with expiration, password, and permission controls, supporting anonymous access and directory sharing.
- **Full-text search**: quickly search files across indexed storages.
- **Offline download (limited)**: `/api/fs/seed/offline_download` parses seed data (torrent, direct link, CAS) and writes it synchronously to the target storage; it requires the `ALLOW_SEED` allowlist and the `OFFLINE_DOWNLOAD` permission. There is no background task queue — `/fs/add_offline_download` and the task retry/cancel endpoints are not implemented (they return 501).
- **External interfaces**: expose the aggregated storage via WebDAV or S3-compatible protocols for mounting into third-party tools.
- **MCP service**: provides Model Context Protocol endpoints that can be integrated and called by clients such as AI assistants.

### Permission Management

- **Permission management**: three roles (admin / general user / guest), plus per-directory read/write permissions (the `read_users` / `write_users` fields in metadata, optionally including subdirectories).
- **Authentication methods**: built-in account/password, supporting TOTP verification, WebAuthn (passkeys — off by default, enable it in settings), SSO single sign-on, and LDAP directory authentication.
- **Security hardening**: JWT sessions, a same-origin CORS policy (arbitrary Origins are not echoed unless allowlisted via `ALLOW_URLS`), clickjacking protection (`X-Frame-Options: DENY`), Content Security Policy (CSP), and HSTS.
- **Health checks**: `/api/healthz` is the readiness probe — it really reads storage once and answers 503 when unavailable, so it is the one to wire to monitoring. `/api/health` is a liveness marker only and says nothing about storage.

### Platform Deployment

- **Runtime platforms**: Cloudflare Workers, Tencent Cloud EdgeOne Makers, Alibaba Cloud ESA, Vercel, Netlify, and Node.js container environments.
- **Data storage**: platform-native storage (KV / D1 / Blob …) or any external database.
- **One-click deployment**: supports one-click deploy buttons for EdgeOne, Cloudflare Workers, Vercel, and Netlify.

### How Is This Different from the Official Version

| | Official OpenList-Worker | This Project |
|---|---|---|
| Storage drivers | 6 | 16, with 10 newly added (`neon`, `turso`, `pgrest`, `pghttp`, `mysqlhttp`, `upstash`, `s3`, `r2`, `netlifyblobs`, `hyperdrive`) |
| SQL dialects | SQLite, MySQL | added PostgreSQL (including `$n` placeholders) |
| Cloud drive drivers | 78 | 80, with `123_link`, `ilanzou`, `halalcloud` added; `Local` removed (it only makes sense on a local filesystem) |
| Deployment platforms | Cloudflare Workers, EdgeOne, ESA, Vercel, Serverless, Node/Docker | added Netlify, plus one-command deploy scripts for EdgeOne / ESA / Vercel |

Of the 10 drivers this project adds, 8 go over HTTP (`neon` `turso` `pgrest` `pghttp` `mysqlhttp` `upstash` `s3` `netlifyblobs`), so they reach an external database even on the edge — one `DATABASE_URL` is enough. `r2` uses a Cloudflare bucket binding and `hyperdrive` connects over raw TCP via `mysql2`, so both are Node-only. The official `mysql` driver is Node-only for the same reason.

For details, see the [External Storage Configuration Guide](../docs/EXTERNAL_STORAGE.md).

---

## Environment Variables

Where to put them: Cloudflare in Settings → Variables and Secrets; EdgeOne in the project's environment variables; Vercel / Netlify in the project settings; Node / Docker in the `.env` file at the root.

### These two are all you need

| Variable | Required? | Notes |
|---|---|---|
| `JWT_SECRET` | **Required** | Signs sessions, encrypts credentials, authenticates scheduled tasks. Generate with `openssl rand -hex 32` |
| `ADMIN_PASS` | Optional | Set it to skip the setup wizard and create the admin account with this password |

You do not need any of the others. Set a variable only when you use the feature it belongs to.

### Fill these when you need them

| Variable | When to fill | Notes |
|---|---|---|
| `DB_DRIVER` | Optional, `auto` | Where data is stored. `auto` tries the external database first, then platform-native storage; use it when unsure. Values: `kv` `d1` `r2` `blob` `cfkv` `do` `neon` `turso` `pgrest` `pghttp` `mysqlhttp` `upstash` `s3` `hyperdrive` `netlifyblobs` `mysql` (Node only) |
| `DB_FORMAT` | Optional, `map` | `map` keeps the whole store in one JSON — fewest requests; `key` stores one record per entity, lighter than `map` when there are many; `sql` uses relational tables and can share a database with the Go version of OpenList |
| `DATABASE_URL` | With an external database | Generic connection string; the vendor is detected from the protocol and hostname. Usually this one is enough |
| `SUPABASE_KEY` | With Supabase | Supabase read/write key |
| `TURSO_AUTH_TOKEN` | With Turso | Turso access token |
| `MYSQL_HTTP_URL` | With MySQL on the edge | HTTP forwarding gateway for MySQL / MariaDB — the only way to reach MySQL from an edge platform |
| `PG_HTTP_URL` | With your own gateway | Address of your self-hosted Postgres HTTP gateway |
| `MYSQL_URLS` | Connecting to MySQL from Node | Direct MySQL connection string, Node / Docker only |
| `ALLOW_URLS` | Frontend and backend on different domains | Comma-separated CORS allowlist; same-origin only when unset |
| `ASSET_URLS` | With a CDN | Serve frontend assets from a CDN; `$version` is replaced by the current frontend version |
| `MAX_UPLOAD` | Optional | Limit for one whole upload, in bytes. Default 26214400 (25MB) |
| `MAX_UPPART` | Optional | Limit for one chunk of a chunked upload, in bytes. Default 16777216 (16MB) |
| `ALLOW_SEED` | With the seed feature | Allowlist of sites allowed as seed-data sources |
| `EO_KV_URLS` | Usually empty | EdgeOne only. The Node cloud function cannot read the KV binding and goes through edge functions instead; put **this deployment's origin** here, e.g. `https://openlist.example.com`. Empty means the domain you are visiting, so only set it when that differs from the deployment domain, or for local debugging |

> Changing `JWT_SECRET` makes the stored passwords and drive credentials undecryptable. When several platforms share one database, they must all use the same value.

For each vendor's connection string and the supported variable aliases, see the [External Storage Configuration Guide](../docs/EXTERNAL_STORAGE.md).

### Platform bindings (just bind them)

The platform injects these at deploy time. Create the resource, then name the binding as shown.

| Variable | Purpose |
|---|---|
| `DB` | Cloudflare D1 database binding, with `DB_DRIVER=d1` |
| `KV` | Cloudflare KV / EdgeOne KV namespace binding, with `DB_DRIVER=kv` |
| `BUCKET` | Cloudflare R2 bucket binding, with `DB_DRIVER=r2` (also accepts `R2_BUCKET` / `OPENLIST_BUCKET` / `OPENLIST_R2`) |
| `HYPERDRIVE` | Cloudflare Hyperdrive connection string, letting the edge reach MySQL, with `DB_DRIVER=hyperdrive` |
| `S3_BUCKET` `S3_REGION` `S3_ENDPOINT` `S3_ACCESS_KEY_ID` `S3_SECRET_ACCESS_KEY` | Bucket name and credentials for S3-compatible storage (R2 / MinIO / B2, etc.), with `DB_DRIVER=s3` |
| `CF_ACCOUNT` `CF_KV_UUID` `CF_API_KEY` | Read/write KV over the Cloudflare REST API, with `DB_DRIVER=cfkv` (account ID, namespace ID, and a Token with KV read/write permission) |

### Command-line only

| Variable | Purpose |
|---|---|
| `EO_PAGES_PROJECT` | Which project the EdgeOne Makers CLI deploys to |
| `EO_PAGES_API_TOKEN` | API Token from the EdgeOne Makers console, for the CLI |
| `EO_PAGES_URL` | The domain after deployment, used by `pnpm run deploy:edgeone` for post-deploy checks |

The template is in [`.dev.vars.example`](../.dev.vars.example).

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

Regarding storage: EdgeOne's KV and Blob Web APIs are only available to **edge functions**, not to Node cloud functions. Note that a Node cloud function *does* see an object named `KV`, but it is a Redis/RESP client rather than the KV Web API — the app deliberately ignores it, so do not use it as KV. Therefore, this project uses two entry points on EdgeOne:

| File | Role |
|---|---|
| `api/_makers.ts` (build artifact `cloud-functions/[[default]].js`) | Node cloud function, the backend core |
| `functions/*` | edge function, responsible for KV proxying and storage probing |
| `middleware.js` | edge middleware, responsible for frontend route fallback |

When `DB_DRIVER` is left at the default `auto`, the program automatically selects storage in the following order:

1. External database (if you have configured `DATABASE_URL`)
2. **KV**: create a namespace in the "KV Storage" section of the console, then bind it to the **edge function** (not the Node cloud function), set the binding variable name to `KV`, and set `JWT_SECRET` (`EO_KV_URLS` is usually left empty — an empty value automatically uses the domain you are visiting)
3. **Blob**: no configuration needed; `@edgeone/pages-blob` automatically creates the store on first write

There are a few pitfalls to watch out for (this project already handles them, but keep them in mind if you change the configuration yourself):

- The `nodeVersion` in `edgeone.json` must be one of the versions the platform preinstalls. The official documentation lists only 14.21.3 / 16.20.2 / 18.20.4 / 20.18.0 / 22.11.0; any other value may cause the build to fail. This project uses `22.11.0`: while fetching the frontend, `scripts/fetch-frontend.mjs` sees that the pnpm 11 pinned upstream requires Node >= 22.13 and automatically falls back to pnpm 10. This field overrides the project settings in the console
- `maxDuration` must be written inside `cloudFunctions.nodejs`; writing it as `cloudFunctions.maxDuration` has no effect
- Frontend route fallback is handled by `middleware.js` at the root, so `edgeone.json` configures no `rewrites`. Makers now also accepts `{"source": "/*", "destination": "/index.html"}` as an SPA fallback (it is recognised as a fallback, not a normal rewrite), but having the same fallback in two places invites conflicts — this project keeps only the `middleware.js` one
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

A successful deployment does not mean usable storage — the driver can silently fall back to memory: the site opens and you can log in, but everything is lost on restart.

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

- **Framework**: SolidJS + TypeScript
- **UI library**: Hope UI
- **Build tool**: Vite

> The frontend is not in this repository; it is fetched from the official repository by `scripts/fetch-frontend.mjs` at build time.

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
| Logs show `Error reading config from kv: Not connected` and every `/api/*` returns 503 | The Node cloud function receives the KV namespace as a **Redis/RESP client** (the KV Web API is only available to edge functions). The app ignores it and falls back to Blob — this is expected. To actually use KV from Node, bind the namespace to edge functions and set `DB_DRIVER=kv` + `JWT_SECRET` |
| Setup intermittently fails with 400 `system has already been initialized`, then succeeds on retry | A false `already initialized`: when storage is unreachable the app falls back to memory, so the first setup only wrote to memory and a retry on the same instance finds an existing admin and returns 400. Fix storage and it disappears |
| Reports `Storage driver "mysql" is not available in this runtime` | `DB_DRIVER=mysql` is set on an edge runtime, but this driver only works in a Node container. Switch to `mysqlhttp`. |
| Supabase returns 404 | The `kv` table does not exist; create it first: `CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);`. Note that Supabase uses PostgREST, which only supports KV — `DB_FORMAT=sql` is not supported. |
| Clicking "offline download" reports `capability unavailable` | This runtime has no durable offline-download adapter, so `/fs/add_offline_download` returns 501. Use `/api/fs/seed/offline_download` instead (configure the `ALLOW_SEED` allowlist first); retry/cancel in the task list also return 501 |

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

- 🐛 **Bug or feature request**: [_Issues_](https://github.com/LegspCpd/openlist-next/issues)
- 💬 **Questions and discussion**: [_Discussions_](https://github.com/LegspCpd/openlist-next/discussions)

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
