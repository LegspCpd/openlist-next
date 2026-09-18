<div align="center">

# OpenList Next

<p><em>OpenList는 다양한 기능을 갖춘 디렉터리 목록 도구로, 여러 종류의 네트워크 드라이브, 객체 스토리지, 프로토콜 서비스에 흩어진 파일을 하나의 인터페이스로 모아 탐색, 미리보기, 다운로드 및 공유할 수 있습니다</em></p>
<p>이 저장소는 공식 <a href="https://github.com/OpenListTeam/OpenList-Worker">OpenList-Worker</a>의 커뮤니티 파생 버전으로, TypeScript로 작성되었으며 Cloudflare Workers, 텐센트 클라우드 EdgeOne, 알리바바 클라우드 ESA 같은 엣지 플랫폼에 배포할 수 있습니다</p>
<p>공식 버전을 바탕으로, 본 프로젝트는 「어떤 엣지 플랫폼에서도 외부 데이터베이스에 직접 연결」하는 부분을 보완했습니다</p>

<a href="../LICENSE"><img src="https://img.shields.io/github/license/LegspCpd/openlist-next" alt="License" /></a>
<a href="https://github.com/LegspCpd/openlist-next/actions/workflows/edgeone-artifact-guard.yml"><img src="https://img.shields.io/github/actions/workflow/status/LegspCpd/openlist-next/edgeone-artifact-guard.yml?branch=main" alt="Build status" /></a>
<a href="https://github.com/LegspCpd/openlist-next/issues"><img src="https://img.shields.io/github/issues/LegspCpd/openlist-next" alt="Issues" /></a>
<a href="https://github.com/LegspCpd/openlist-next/discussions"><img src="https://img.shields.io/github/discussions/LegspCpd/openlist-next?color=%23ED8936" alt="Discussions" /></a>

📖 [다중 플랫폼 배포 가이드](../docs/DEPLOYMENT.md) · 🗄️ [외부 스토리지 설정](../docs/EXTERNAL_STORAGE.md) · 🔌 [원클릭 데이터베이스 연결](../docs/ONE_CLICK_DATABASE.md)

</div>

<div align="center">

[English](README_en.md) | [简体中文](../README.md) | [繁體中文](README_zh-TW.md) | [日本語](README_ja.md) | 한국어 | [Français](README_fr.md)

[상류 프로젝트](https://github.com/OpenListTeam/OpenList-Worker) · [기여 가이드](../CONTRIBUTING.md) · [라이선스](../LICENSE) · [출처 및 라이선스 고지](../NOTICE.md)

</div>

> [!WARNING]
> 본 프로젝트는 OpenList 공식 릴리스가 **아니며**, OpenListTeam과 그 어떠한 소속, 인가, 후원 관계도 없습니다.
> 사용 중 문제가 발생하면 공식 저장소가 아닌 본 저장소에 Issue를 남겨 주세요.
> 코드 출처, 저작권 및 라이선스 설명은 [NOTICE.md](../NOTICE.md)를 참고하세요.

---

## 원클릭 배포

아래 버튼을 클릭하면 본 프로젝트를 해당 플랫폼에 배포할 수 있습니다:

<div align="center">

| EdgeOne · 인터내셔널 | EdgeOne · 중국 | Cloudflare Workers |
| :---: | :---: | :---: |
| [![EdgeOne으로 배포](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?project-name=openlist-next&repository-url=https://github.com/LegspCpd/openlist-next&install-command=pnpm%20install%20--no-frozen-lockfile&build-command=pnpm%20run%20build&output-directory=dist&env=JWT_SECRET) | [![EdgeOne으로 배포](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://console.cloud.tencent.com/edgeone/makers/new?project-name=openlist-next&repository-url=https://github.com/LegspCpd/openlist-next&install-command=pnpm%20install%20--no-frozen-lockfile&build-command=pnpm%20run%20build&output-directory=dist&env=JWT_SECRET) | [![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/LegspCpd/openlist-next) |

| Vercel | Netlify |
| :---: | :---: |
| [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/LegspCpd/openlist-next) | [![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/LegspCpd/openlist-next) |

</div>

배포完成后에도 환경 변수를 설정해야 하며, 그중 `JWT_SECRET`은 필수 항목으로 `openssl rand -hex 32`로 생성할 수 있습니다.

- EdgeOne: [인터내셔널 콘솔](https://console.edgeone.ai/makers) · [중국 콘솔](https://console.cloud.tencent.com/edgeone/makers)
- Cloudflare: [Worker 백엔드](https://dash.cloudflare.com/)
- Vercel: 프로젝트 설정 → Environment Variables
- Netlify: Site configuration → Environment variables

자주 쓰는 변수들:

- `JWT_SECRET`: 세션 서명과 필드 암호화에 사용하는 키, **필수**
- `ADMIN_PASS`: 선택 사항. 설정하면 설치 마법사를 건너뛰고 이 비밀번호로 관리자 계정을 초기화합니다
- `DB_FORMAT`: 데이터를 어떻게 구성할지, `map`(기본값) / `key` / `sql`
- `DB_DRIVER`: 데이터를 어디에 저장할지, `auto`(기본값, 자동 인식) / `kv` / `d1` / `blob` / `neon` / `turso` / …
- `DATABASE_URL`: 외부 데이터베이스 연결 문자열. 이를 채우고 `DB_DRIVER=auto`로 두면 프로그램이 자동으로 연결됩니다

> [!IMPORTANT]
> Cloudflare에서 「저장소 콘텐츠를 가져올 수 없음」이 표시되면, 먼저 본 저장소를 [Fork](https://github.com/LegspCpd/openlist-next/fork)한 뒤 「GitHub 저장소 연결」 방식으로 배포하세요.

---

## 기능 소개

OpenList는 엣지 컴퓨팅 플랫폼에서 동작하는 다중 스토리지 통합 파일 목록 및 관리 시스템으로, 서로 다른 네트워크 드라이브, 객체 스토리지, 프로토콜 서비스에 흩어진 파일을 하나의 인터페이스로 통합하여 탐색, 미리보기, 다운로드 및 관리할 수 있습니다.

OpenList-Worker는 공식 [OpenListTeam/OpenList](https://github.com/OpenListTeam/OpenList) 프로젝트의 TypeScript + Serverless 이식판으로, 백엔드를 Go에서 Workers에서 동작하는 TypeScript 서비스로 재작성했고, 프론트엔드는 일관된 화면과 상호작용 경험을 유지합니다.

### 스토리지 통합

내장된 **80개의 스토리지 드라이버**로 다양한 스토리지 백엔드를 즉시 마운트할 수 있습니다:

- **국내 네트워크 드라이브**: 알리바바 클라우드 드라이브(오픈 플랫폼/공유), 콰르크 네트워크 드라이브(오픈 플랫폼/UC TV 버전), 바이두 네트워크 드라이브(앨범), 115 네트워크 드라이브(오픈 플랫폼/공유), 123 클라우드 드라이브(오픈 플랫폼/공유), 티안이 클라우드 드라이브(189/PC/TV), 차이나 모바일 클라우드 드라이브(139/허차이윈), 워자 클라우드 드라이브, 선더 네트워크 드라이브, 텐센트 Weiyun, 란조우윈, PikPak(공유), 더우바오 네트워크 드라이브, 광야 디스크, 차오싱 그룹 네트워크 드라이브, 레노버 NAS 공유, Teambition 네트워크 드라이브, WPS 네트워크 드라이브, 알리바바 문서, HalalCloud, MediaTrack 등
- **해외 네트워크 드라이브**: Google Drive(앨범), OneDrive(앱/공유 링크), Dropbox, MEGA, MediaFire, Proton Drive, Yandex Disk, Degoo, Bunny Storage, TeraBox 등
- **객체 스토리지**: S3 호환(AWS/OSS/COS/MinIO 등), Upaiyun USS, Azure Blob, WebDAV, IPFS 등
- **코드 호스팅**: GitHub, GitHub Releases, CNB Releases
- **네트워크 드라이브 프로그램**: OpenList(공유), AList V3, Cloudreve V3/V4, Kodbox(커다오윈), Seafile, Teldrive, Febbox 등
- **기타 드라이버**: NetEase Cloud Music, Misskey, Emby, Cloudflare 이미지 호스팅 등

위의 실제 스토리지 외에도 `Alias`, `UrlTree`, `AutoIndex`, `Strm`, `Crypt`, `Virtual`, `Chunk` 같은 가상/기능형 드라이버를 제공하여 주소 별칭, URL 목록, 암호화 저장, 청크 분할 등의 상황에 사용할 수 있습니다.

### 핵심 기능

- **파일 탐색**: 통합된 디렉터리 트리 탐색으로 이미지, 동영상, 오디오, 문서, 코드, 압축 파일 등의 형식에 대한 온라인 미리보기를 지원합니다.
- **업로드/다운로드**: 스토리지 간 업로드, 일괄 다운로드, 스트리밍 전송 및 직접 링크 이동을 지원합니다.
- **파일 공유**: 유효 기간, 비밀번호, 권한 제어가 포함된 공유 링크를 생성하며 익명 접근과 디렉터리 공유를 지원합니다.
- **전문 검색**: 인덱싱된 스토리지에서 파일을 빠르게 검색합니다.
- **오프라인 다운로드(제한적)**: `/api/fs/seed/offline_download`가 seed 데이터(토렌트, 직링크, CAS)를 해석해 대상 스토리지에 동기적으로 기록합니다. `ALLOW_SEED` 허용 목록과 `OFFLINE_DOWNLOAD` 권한이 필요합니다. 백그라운드 작업 큐는 없으며 `/fs/add_offline_download`와 작업 재시도 / 취소는 구현되지 않았습니다(501).
- **외부 인터페이스**: 통합 스토리지를 WebDAV 또는 S3 호환 프로토콜로 외부에 노출하여 타사 도구에 마운트할 수 있습니다.
- **MCP 서비스**: Model Context Protocol 엔드포인트를 제공하여 AI 어시스턴트 같은 클라이언트가 통합해 호출할 수 있습니다.

### 권한 관리

- **권한 관리**: 세 가지 역할(관리자 / 일반 사용자 / 게스트)과 디렉터리 단위 읽기/쓰기 권한(메타데이터의 `read_users` / `write_users`, 하위 디렉터리 포함 가능)을 지원합니다.
- **인증 방식**: 내장 계정/비밀번호, TOTP 검증, WebAuthn 로그인(패스키, 기본값은 꺼져 있으며 설정에서 켜야 함), SSO 단일 사인온 및 LDAP 디렉터리 인증을 지원합니다.
- **보안 강화**: JWT 세션, 동일 출처 CORS 정책(`ALLOW_URLS`로 허용하지 않는 한 임의의 Origin을 되돌려주지 않음), 클릭재킹 방어(`X-Frame-Options: DENY`), 콘텐츠 보안 정책(CSP), HSTS.
- **상태 확인**: `/api/healthz`가 준비 상태 프로브입니다. 실제로 스토리지를 한 번 읽고 사용할 수 없으면 503을 반환하므로 모니터링·알림에는 이쪽을 연결하세요. `/api/health`는 생존 표시일 뿐 스토리지 상태를 반영하지 않습니다.

### 플랫폼 배포

- **실행 플랫폼**: Cloudflare Workers, 텐센트 클라우드 EdgeOne Makers, 알리바바 클라우드 ESA, Vercel, Netlify 및 Node.js 컨테이너 환경.
- **데이터 저장**: 플랫폼 기본 스토리지(KV / D1 / Blob …) 또는 임의의 외부 데이터베이스.
- **원클릭 배포**: EdgeOne, Cloudflare Workers, Vercel, Netlify의 원클릭 배포 버튼을 지원합니다.

---

## 공식 버전과 어떤 점이 다른가

| | 공식 OpenList-Worker | 본 프로젝트 |
|---|---|---|
| 스토리지 드라이버 | 6개 | 16개, 10개 추가(`neon`, `turso`, `pgrest`, `pghttp`, `mysqlhttp`, `upstash`, `s3`, `r2`, `netlifyblobs`, `hyperdrive`) |
| SQL 방언 | SQLite, MySQL | PostgreSQL 추가( `$n` 플레이스홀더 포함) |
| 네트워크 드라이브 드라이버 | 78개 | 80개, `123_link`, `ilanzou`, `halalcloud` 보완. 로컬 파일 시스템에서만 의미가 있는 `Local` 은 제거 |
| 배포 플랫폼 | Cloudflare Workers, EdgeOne, ESA, Vercel, Serverless, Node/Docker | Netlify 추가, EdgeOne / ESA / Vercel용 원클릭 배포 스크립트 보완 |

공식 버전의 `mysql` 드라이버는 Node 컨테이너에서만 동작합니다 — Cloudflare Workers에는 raw TCP가 없으므로 엣지에 배포하면 플랫폼 기본 KV만 사용할 수 있습니다. 본 프로젝트가 추가한 10개 중 8개(`neon`, `turso`, `pgrest`, `pghttp`, `mysqlhttp`, `upstash`, `s3`, `netlifyblobs`)는 HTTP를 사용하므로 엣지 런타임에서도 외부 데이터베이스에 연결할 수 있고, `DATABASE_URL` 한 줄만 채우면 됩니다. 나머지 두 개는 방식이 다릅니다. `r2`는 Cloudflare 버킷 바인딩을, `hyperdrive`는 `mysql2`로 TCP에 직접 연결하므로 Node 환경에서만 사용할 수 있습니다.

자세한 설명은 [외부 스토리지 설정 가이드](../docs/EXTERNAL_STORAGE.md)를 참고하세요.

---

## 수동 배포

### 사전 요구사항

- Node.js **22.x**
- pnpm **9.15.4**(corepack을 통해 활성화)
- Cloudflare Workers에 배포하는 경우 Cloudflare 계정이 필요합니다

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
```

### 로컬 개발

```bash
git clone https://github.com/LegspCpd/openlist-next.git
cd openlist-next
pnpm install

cp .dev.vars.example .dev.vars
openssl rand -hex 32        # JWT_SECRET 생성 후 위 파일에 채워넣기

pnpm run dev:unified        # 공식 프론트엔드를 가져오고 Worker를 시작
pnpm run dev:worker         # Worker만 시작
```

> `pnpm run build`는 먼저 공식 프론트엔드 저장소 OpenList-Frontend를 클론하고 `dist/`로 컴파일한 뒤, 백엔드를 `dist-server/`로 컴파일합니다.
> 로컬에 이미 프론트엔드 산출물이 있다면 `FRONTEND_DIST=/path/to/dist pnpm run build`로 클론을 건너뛸 수 있습니다.
> 의존성 중 GitHub 출신 패키지 두 개(`@hope-ui/solid`, `mpegts.js`)가 있어 첫 설치가 다소 느린 것은 정상입니다.

### Cloudflare Workers에 배포

명령줄 사용:

```bash
npx wrangler login
openssl rand -hex 32 | npx wrangler secret put JWT_SECRET

pnpm run build
pnpm run deploy:worker
```

Cloudflare 백엔드에서 Git 저장소를 연결할 수도 있습니다: 빌드 명령에 `pnpm run build`를 입력하고 출력 디렉터리는 비워두면 wrangler가 `wrangler.jsonc`를 읽습니다.

스토리지에 관해: `wrangler.jsonc`에는 기본적으로 KV 바인딩이 선언되어 있어, 첫 배포 시 wrangler가 자동으로 `openlist-next-kv`를 생성하고 바인딩하며, 이후 배포마다 재사용하므로 수동으로 만들 필요가 없습니다. D1, R2 또는 Durable Objects로 바꾸려면 `wrangler.jsonc`에서 해당 주석을 풀면 됩니다. 구체적인 작성법은 파일의 주석에 적혀 있습니다.

> 참고: 로컬에서 `wrangler deploy`나 `wrangler dev`를 실행하기 전에는 반드시 `pnpm run build`를 먼저 실행하세요.
> `wrangler.jsonc`의 `assets.directory`는 `./dist`를 가리키지만, 이 디렉터리는 기본적으로 존재하지 않습니다(`.gitignore`에서 무시됨).
> 그대로 실행하면 `The directory specified by the "assets.directory" field ... does not exist` 오류가 발생합니다.
> 원클릭 배포 버튼을 쓰거나 백엔드에서 Git 저장소를 연결하면 플랫폼이 자동으로 빌드하므로 영향받지 않습니다.

> `DB_DRIVER`를 `mysql`로 설정하지 마세요 — Cloudflare Workers에는 raw TCP가 없어 이 드라이버는 엣지에서 동작하지 않습니다.
> 외부 MySQL에 연결하려면 `mysqlhttp`(별도의 HTTP 게이트웨이 구축 필요)를 쓰거나 `neon` / `turso`로 바꾸세요.

### 텐센트 클라우드 EdgeOne에 배포

[인터내셔널](https://edgeone.ai/)과 [중국](https://console.cloud.tencent.com/edgeone) 모두 가능합니다.

위의 원클릭 배포 버튼을 누르거나, 콘솔에서 프로젝트를 만들고 Git 저장소를 가져오되 빌드 명령에 `pnpm run build`, 출력 디렉터리에 `dist`를 입력하면 됩니다. 이 설정은 `edgeone.json`에도 있으므로 실제로는 파일을 기준으로 합니다.

> **중요**: `cloud-functions/[[default]].js`는 빌드 산출물이지만 EdgeOne 배포 시 저장소에서 이 파일을 읽어오므로, 반드시 저장소에 커밋해야 하며 `.gitignore`에 넣지 마세요.
> 이 파일이 없으면 EdgeOne에서 `No server-handler detected` 오류를 내고 프로젝트가 순수 정적 사이트로 전락합니다.
> 저장소의 `EdgeOne Artifact Guard` 워크플로는 산출물이 만료되면 자동으로 재빌드하고 커밋하므로 보통 수동 유지보수가 필요 없습니다.

스토리지 측면에서, EdgeOne의 KV와 Blob Web API는 **엣지 함수**에서만 사용할 수 있고 Node 클라우드 함수에서는 가져올 수 없습니다. 참고로 Node 쪽에도 `KV`라는 객체가 보이지만 이는 Redis/RESP 클라이언트이며 KV Web API가 아닙니다. 본 앱은 이를 의도적으로 무시하므로 KV로 사용하지 마세요. 따라서 본 프로젝트는 EdgeOne에서 두 개의 엔트리 포인트를 사용합니다:

| 파일 | 역할 |
|---|---|
| `api/_makers.ts`(빌드 산출물 `cloud-functions/[[default]].js`) | Node 클라우드 함수, 백엔드 본체 |
| `functions/*` | 엣지 함수, KV 프록시 및 스토리지 탐지 담당 |
| `middleware.js` | 엣지 미들웨어, 프론트엔드 라우팅 폴백 담당 |

`DB_DRIVER`를 기본값 `auto`로 두면 프로그램이 아래 순서대로 스토리지를 자동 선택합니다:

1. 외부 데이터베이스( `DATABASE_URL`을 설정한 경우)
2. **KV**: 콘솔의 「KV 스토리지」에서 네임스페이스를 만든 뒤 **엣지 함수**(Node 클라우드 함수 아님)에 바인딩하고, 바인딩 변수명을 `KV`로 입력한 다음 `JWT_SECRET`을 설정합니다(`EO_KV_URLS`는 보통 비워 두며, 비워두면 현재 접속한 도메인이 자동 사용됩니다)
3. **Blob**: 별도 설정 불필요, 첫 쓰기 시 `@edgeone/pages-blob`이 자동으로 데이터베이스를 생성합니다

주의할 점몇 가지(본 프로젝트는 이미 처리해 두었으나, 직접 설정을 고칠 때 유의하세요):

- `edgeone.json`의 `nodeVersion`에는 플랫폼에 미리 설치된 버전을 지정합니다. 공식 문서에 나열된 버전은 14.21.3 / 16.20.2 / 18.20.4 / 20.18.0 / 22.11.0 다섯 개뿐이며, 다른 값을 넣으면 빌드에 실패할 수 있습니다. 이 프로젝트는 `22.11.0`을 사용합니다. 프론트엔드를 받을 때 `scripts/fetch-frontend.mjs`가 업스트림이 pin한 pnpm 11이 Node ≥ 22.13을 요구한다는 것을 감지하고 자동으로 pnpm 10으로 폴백합니다. 이 필드는 콘솔의 프로젝트 설정을 덮어씁니다
- `maxDuration`은 `cloudFunctions.nodejs` 안에 작성해야 하고, `cloudFunctions.maxDuration`으로 쓰면 적용되지 않습니다
- 프론트엔드 라우팅 폴백은 루트의 `middleware.js`가 담당하므로 `edgeone.json`에는 `rewrites`를 두지 않았습니다. Makers는 이제 `{"source": "/*", "destination": "/index.html"}`로 SPA 폴백을 선언하는 것도 지원합니다(일반 리라이트가 아니라 fallback으로 인식됩니다). 다만 같은 폴백을 두 곳에 두면 서로 충돌하기 쉬워 이 프로젝트는 `middleware.js` 한 곳만 유지합니다
- `*.edgeone.cool` 같은 임시 도메인으로 스토리지를 검증하지 마세요. 이 도메인은 사이트 전역 인증 매개변수가 붙어 엣지 함수와 클라우드 함수 사이의 KV 프록시 요청을 차단합니다. 먼저 커스텀 도메인을 바인딩한 뒤 검증하세요

원클릭 배포 버튼을 쓰지 않으려면 Makers CLI를 써도 됩니다:

```bash
EO_PAGES_PROJECT=openlist-next \
EO_PAGES_API_TOKEN=<콘솔에서 발급한 Token> \
pnpm run deploy:edgeone -- --url https://your-domain --deep
```

이 스크립트는 빌드, 배포한 뒤 스토리지가 실제로 사용 가능한지 자동으로 확인합니다.

### Vercel에 배포

배포 버튼을 누르면 배포 페이지 하단에 **Marketplace Database Providers** 목록이 나타나는데, 하나를 선택하고 「연결」을 누르면 됩니다. Vercel이 연결 정보를 환경 변수로 자동 주입하며, 본 프로젝트의 `DB_DRIVER=auto`가 이를 인식하고 자동으로 연결하므로 코드를 고칠 필요가 없습니다.

지원 상황: Neon, Upstash, Supabase, Turso는 바로 사용 가능하고; Nile, Prisma Postgres, AWS RDS는 Postgres-over-HTTP 게이트웨이가 필요하며; Redis(순수 TCP), MongoDB, Convex, MotherDuck은 엣지 환경에서 사용할 수 없습니다. 자세한 설명은 [원클릭 데이터베이스 연결](../docs/ONE_CLICK_DATABASE.md)을 참고하세요.

Vercel 콘솔에서 Import Git Repository로 가져오되 프레임워크 감지를 **Other**로 선택하면 됩니다(설정은 모두 `vercel.json`에 있음). 또는 명령줄 사용:

```bash
npx vercel login
npx vercel deploy --prod --yes

# 또는 빌드, 배포, 스토리지 확인을 한 번에
pnpm run deploy:vercel -- --url https://your-domain
```

Vercel 함수의 단일 실행 상한은 기본 10초(Pro는 60초)로, 디렉터리가 매우 큰 경우 시간초과가 될 수 있으니 데이터베이스 왕복 횟수를 줄이기 위해 `DB_FORMAT=map`을 권장합니다.

### 알리바바 클라우드 ESA에 배포

ESA 콘솔의 「엣지 컴퓨팅 → 함수와 Pages」에서 프로젝트를 만들고 GitHub 저장소를 가져옵니다. 빌드 명령에 `pnpm run build`, 정적 자원 디렉터리에 `./dist`, 함수 파일 경로에 `./dist-server/esa-entry.js`를 입력합니다.

명령줄 사용:

```bash
pnpm install
pnpm run build

npx esa-cli login
npx esa-cli commit
npx esa-cli deploy

# 또는 빌드, 커밋, 배포, 스토리지 확인을 한 번에
pnpm run deploy:esa -- --url https://your-domain
```

`esa.jsonc`에는 두 가지 핵심 설정이 있습니다:

- `entry`는 `./dist-server/esa-entry.js`를 가리킵니다. 서버 산출물을 의도적으로 `dist-server/`에 두지 않고 `dist/`에 두면 정적 파일로 공개 다운로드될 수 있습니다
- `assets.notFoundStrategy`를 `singlePageApplication`으로 설정합니다. 이를 설정하지 않으면 `/login`, `/@manage/*` 같은 프론트엔드 라우팅이 바로 404가 됩니다

ESA는 요청당 KV 하위 요청 횟수 제한이 있으므로, 플랫폼 기본 EdgeKV를 고집한다면 `DB_FORMAT=map`(전체 라이브러리를 하나의 key로, 읽기/쓰기 각 1회)을 권장합니다.

### Netlify에 배포

Netlify에서 Git 저장소를 연결하면 됩니다. `netlify.toml`에 빌드 설정이 이미 작성되어 있고, 명령줄로 `netlify deploy --build --prod`를 써도 됩니다.

Netlify에는 플랫폼级 스토리지가 없으므로 반드시 외부 데이터베이스를 연결해야 합니다. 환경 변수는 **Site configuration → Environment variables**에서 설정하며, 예시:

```bash
JWT_SECRET=<임의 문자열>
DATABASE_URL=postgres://user:pass@ep-xxx.neon.tech/neondb
DB_FORMAT=map
```

> Netlify Functions의 단일 실행 상한은 10초(Pro는 26초)로, 콜드 스타트에 네트워크 드라이브 API 왕복이 더해지면 시간초과가 쉽게 발생하므로, 운영 환경에서는 Cloudflare Workers를 우선 권장합니다.

### Node / Docker에 배포

`DB_DRIVER=mysql`로 TCP에 직접 연결할 수 있는 유일한 상황입니다.

```bash
pnpm install
pnpm run build
pnpm start
```

환경 변수는 루트 디렉터리의 `.env`에 작성합니다( `loadEnv.js`가 읽어옵니다):

```bash
JWT_SECRET=<임의 문자열>
DATABASE_URL=mysql://user:pass@127.0.0.1:3306/openlist
DB_DRIVER=mysql
DB_FORMAT=sql
```

---

## 배포 후 확인

배포 성공과 스토리지 사용 가능은 별개의 문제입니다. 최악의 경우 스토리지 드라이버가 조용히 메모리 모드로 후퇴합니다: 사이트는 열리고 로그인도 되지만, 재시작하면 데이터가 사라집니다.

```bash
curl https://your-domain/api/public/env_check
```

응답 내용에서 특히 주목해서 볼 필드:

- `data.storage.memory`: `true`면 메모리 폴백으로 동작해 재시작 시 데이터가 사라지므로 반드시 처리해야 합니다(이때 `data.config.resolved_driver`는 `memory`입니다)
- `data.jwt.ready`: `JWT_SECRET`이 설정되었는지. 설정되지 않으면 마운트 자격 증명 같은 암호화 필드를 풀 수 없습니다
- `data.ready`: 전체 준비 상태
- `data.issues`: 문제 목록. 각 항목에 `code`(`STORAGE_MEMORY_ONLY`, `JWT_SECRET_MISSING` 등)가 붙어 있어 원인 파악이 가장 빠릅니다

통합 스크립트로 확인(재배포 없이 확인만 함)하게 할 수도 있습니다:

```bash
pnpm run deploy:edgeone -- --no-deploy --url https://your-domain
pnpm run deploy:esa     -- --no-deploy --url https://your-domain
pnpm run deploy:vercel  -- --no-deploy --url https://your-domain
```

종료 코드 `0`은 스토리지 준비 완료, `2`는 아직 준비되지 않음을 의미합니다. EdgeOne에서는 추가로 `/storage-probe`를 한 번 더 읽어 KV와 Blob이 각각 사용 가능한지 알려줍니다.

---

## 기술 아키텍처

### 백엔드

- **실행 환경**: Cloudflare Workers / 텐센트 클라우드 EdgeOne / 알리바바 클라우드 ESA / Vercel / Netlify / Node.js 컨테이너
- **웹 프레임워크**: Hono.js
- **언어**: TypeScript
- **빌드 도구**: Wrangler, esbuild

### 프론트엔드

- **프레임워크**: SolidJS + TypeScript
- **UI 라이브러리**: Hope UI
- **빌드 도구**: Vite

> 프론트엔드는 본 저장소에 없으며, 빌드 시 `scripts/fetch-frontend.mjs`가 공식 저장소에서 가져옵니다.

---

## 설정

### 변수를 어디에 채우는가

변수 이름이 같으면 아래 어디에 채우든 효과는 같습니다.

| 배포 방식 | 채우는 위치 |
|---|---|
| Cloudflare Workers | 콘솔 프로젝트의 Settings → Variables and Secrets, 또는 터미널에서 `wrangler secret put JWT_SECRET` 실행 |
| 텐센트 클라우드 EdgeOne | 콘솔 프로젝트의 「환경 변수」, 또는 원클릭 배포 버튼을 누르면 배포 페이지에서 직접 입력받음 |
| Vercel / Netlify | 프로젝트 설정의 Environment Variables |
| Node / Docker | 루트 디렉터리의 `.env` 파일 |

아래에서는 「변수 이름 —— 무슨 일을 하는지 —— 채워야 하는지」 순으로 하나씩 적어둡니다.

### 필수 항목

| 변수 이름 | 무슨 일을 하는지 | 채워야 하는지 | 채우는 방법 |
|---|---|---|---|
| `JWT_SECRET` | 프로그램 전체의 비밀 키. 로그인 세션 서명, 클라우드 드라이브 자격 증명 같은 필드의 암호화 저장, 정기 작업 인증 이 세 가지에 모두 사용됩니다 | **필수**. 비워두면 설치 후 클라우드 드라이브 마운트가 실패합니다 | 16자 이상의 무작위 문자열. `openssl rand -hex 32`로 문자열을 만들어 채웁니다 |

> [!IMPORTANT]
> `JWT_SECRET`을 바꾸거나 잘못 입력하면 이전에 저장된 클라우드 드라이브 자격 증명을 복호화할 수 없게 되며, 「마운트가 갑자기 다시 입력을 요구함」으로 나타납니다. 같은 데이터를 여러 플랫폼에 배포할 때는 각 플랫폼의 `JWT_SECRET`이 일치해야 합니다.

### 데이터 저장 위치

이 두 변수가 데이터가 어떤 스토리지에, 어떤 구조로 저장되는지 결정합니다.

| 변수 이름 | 무슨 일을 하는지 | 채워야 하는지 | 선택 가능한 값 |
|---|---|---|---|
| `DB_DRIVER` | 데이터를 어떤 스토리지에 저장할지 | 선택 사항, 기본값 `auto` | `auto`, `kv`, `d1`, `r2`, `blob`, `cfkv`, `do`, `neon`, `turso`, `pgrest`, `pghttp`, `mysqlhttp`, `upstash`, `s3`, `hyperdrive`, `netlifyblobs`, `mysql` |
| `DB_FORMAT` | 데이터를 어떤 구조로 구성할지 | 선택 사항, 기본값 `map` | `map`, `key`, `sql` |

- `auto`는 이 순서로 선택합니다. 설정한 외부 데이터베이스 → 플랫폼 기본 스토리지(KV, D1, Blob 등). 확실치 않으면 `auto`를 쓰세요.
- `map`: 전체 데이터베이스를 하나의 JSON으로 저장, 읽기/쓰기 각 1회로 요청 횟수가 가장 적어 KV와 객체 스토리지에 적합합니다.
- `key`: 엔티티마다 하나의 레코드, 예: `users_1`. 엔티티가 많을 때 `map`보다 트래픽을 절약합니다.
- `sql`: 관계형 테이블로 저장하며, 테이블 구조는 Go 버전 OpenList와 같아 Go 버전과 같은 데이터베이스를 공유할 수 있습니다.
- `mysql`은 Node / Docker에서만 사용할 수 있습니다. 엣지 플랫폼은 raw TCP 연결을 지원하지 않아 접속할 수 없습니다.

자주 쓰는 조합:

```bash
# Cloudflare Workers + D1
DB_FORMAT=sql
DB_DRIVER=d1

# EdgeOne + Blob(데이터베이스 생성 불필요, 첫 쓰기 시 자동 생성)
DB_FORMAT=map
DB_DRIVER=blob

# 외부 데이터베이스, 예: Neon
DB_FORMAT=map
DB_DRIVER=auto
DATABASE_URL=postgres://user:pass@ep-xxx.neon.tech/neondb
```

### 외부 데이터베이스(플랫폼 기본 스토리지를 쓰지 않으려면 채우세요)

가장 간단한 방법은 **`DATABASE_URL` 한 줄만 채우고 `DB_DRIVER`는 `auto`로 두는 것**입니다. 프로그램이 프로토콜과 호스트명만 보고 드라이버를 스스로 알아냅니다.

| 변수 이름 | 무슨 일을 하는지 | 채워야 하는지 |
|---|---|---|
| `DATABASE_URL` | 범용 데이터베이스 연결 문자열, 드라이버는 알아낸 벤더에 맞춰 사용됩니다 | 외부 데이터베이스를 쓸 때 보통 이 한 줄만 채우면 됩니다 |
| `SUPABASE_KEY` | Supabase의 읽기/쓰기 키, 연결 문자열 한 줄로는 부족합니다 | Supabase를 쓸 때 필수 |
| `TURSO_AUTH_TOKEN` | Turso의 액세스 토큰 | Turso를 쓸 때 필수 |
| `MYSQL_HTTP_URL` | MySQL / MariaDB의 HTTP 전달 게이트웨이 주소. 엣지 플랫폼에서 MySQL에 접속하려면 이 경로로만 가능합니다 | 엣지에서 MySQL을 쓸 때 필수 |
| `PG_HTTP_URL` | 직접 구축한 Postgres HTTP 게이트웨이 주소 | 직접 구축한 게이트웨이를 쓸 때 필수 |
| `MYSQL_URLS` | MySQL 직접 연결 문자열, Node / Docker에서만 사용 가능 | Node에서 MySQL에 직접 연결할 때 채웁니다 |

각 벤더의 연결 문자열 작성법과 지원하는 변수 별칭은 [외부 스토리지 설정 가이드](../docs/EXTERNAL_STORAGE.md)를 참고하세요.

### 플랫폼 바인딩(직접 채우지 않아도 됨, 바인딩만 하면 됩니다)

이들은 배포 시 플랫폼이 환경에 자동으로 주입합니다. 콘솔에서 리소스를 만들고, 바인딩할 때 이름을 아래와 같이 지정하기만 하면 됩니다.

| 변수 이름 | 무슨 일을 하는지 | 신경 쓸 필요가 있나요 |
|---|---|---|
| `DB` | Cloudflare D1 데이터베이스 바인딩, `DB_DRIVER=d1`에서 사용됩니다 | D1을 쓰려면 바인딩하고 이름을 `DB`로 지정하세요 |
| `KV` | Cloudflare KV / EdgeOne KV의 네임스페이스 바인딩, `DB_DRIVER=kv`에서 사용됩니다 | KV를 쓰려면 바인딩하고 이름을 `KV`로 지정하세요 |
| `HYPERDRIVE` | Cloudflare Hyperdrive 연결 문자열, 엣지에서 MySQL에 접속할 수 있게 합니다, `DB_DRIVER=hyperdrive`에서 사용됩니다 | Hyperdrive를 쓰려면 바인딩하세요 |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | S3 호환 객체 스토리지(R2 / MinIO / B2 등)의 버킷 이름과 액세스 자격 증명, `DB_DRIVER=s3`에서 사용됩니다 | S3 스토리지를 쓰려면 다섯 항목을 모두 채우세요 |
| `CF_ACCOUNT`, `CF_KV_UUID`, `CF_API_KEY` | Cloudflare REST API로 KV를 읽고 씁니다, `DB_DRIVER=cfkv`에서 사용됩니다. 각각 계정 ID, KV 네임스페이스 ID, KV 읽기/쓰기 권한이 있는 API Token입니다 | `cfkv`를 쓰려면 세 항목을 모두 채우세요 |
| `BUCKET` | Cloudflare R2 버킷 바인딩. `DB_DRIVER=r2`에서 사용합니다(`R2_BUCKET` / `OPENLIST_BUCKET` / `OPENLIST_R2`도 허용) | R2를 쓰려면 바인딩하고 이름을 `BUCKET`으로 지정하세요 |

### 기타 변수(대부분 신경 쓰지 않아도 됩니다)

| 변수 이름 | 무슨 일을 하는지 | 채워야 하는지 |
|---|---|---|
| `EO_KV_URLS` | EdgeOne 전용. KV 바인딩은 엣지 함수에만 주입되고 Node 클라우드 함수는 가져올 수 없어, 읽기/쓰기는 **이 배포 자체**의 `/kv-get` `/kv-put` `/kv-delete` `/kv-list` 엣지 함수를 거쳐 전달됩니다. 여기에는 **이 배포의 origin**(예: `https://openlist.example.com`)을 입력합니다(프로토콜+호스트+포트만 사용되며 뒤에 붙은 경로는 무시됩니다) | 보통 비워 둡니다. 비워두면 현재 접속한 도메인이 자동 사용됩니다. 접속 도메인과 배포 도메인이 다르거나(앞단에 CDN/커스텀 도메인) 로컬 디버깅 시에만 직접 입력합니다 |
| `ADMIN_PASS` | 설정하면 설치 마법사를 거치지 않고 이 비밀번호로 관리자 계정을 생성합니다 | 선택 사항, 비워두면 브라우저 마법사에서 설정합니다 |
| `ALLOW_URLS` | CORS 허용 목록, 쉼표로 구분. 비워두면 동일 출처 요청만 허용합니다 | 프론트엔드와 백엔드가 같은 도메인이 아닐 때 채웁니다 |
| `ASSET_URLS` | 프론트엔드 정적 자원을 CDN에서 로드하며, `$version`으로 현재 프론트엔드 버전 번호 자리를 채울 수 있습니다 | CDN을 쓸 때 채웁니다 |
| `MAX_UPLOAD` | 한 번의 전체 업로드 크기 상한, 단위는 바이트 | 선택 사항, 기본값 26214400(25MB) |
| `MAX_UPPART` | 분할 업로드 시 한 조각의 크기 상한, 단위는 바이트 | 선택 사항, 기본값 16777216(16MB) |
| `ALLOW_SEED` | 시드 데이터 출처로 허용할 사이트 허용 목록 | 시드 기능을 쓸 때 채웁니다 |

### 명령줄에서만 사용(환경 변수에 채우지 않아도 됩니다)

| 변수 이름 | 무슨 일을 하는지 |
|---|---|
| `EO_PAGES_PROJECT` | EdgeOne Makers CLI가 배포할 프로젝트 |
| `EO_PAGES_API_TOKEN` | EdgeOne Makers 콘솔의 API Token, CLI에서 사용됩니다 |
| `EO_PAGES_URL` | 배포 후 도메인, `pnpm run deploy:edgeone`에서 배포 후 확인에 사용됩니다 |

모든 변수는 [변수 템플릿](../.dev.vars.example)에 주석과 함께 정리되어 있습니다.

---

## 자주 묻는 질문

| 현상 | 원인과 처리 방법 |
|---|---|
| `No storage backend is available` 표시 | 스토리지가 하나도 구성되지 않음. `DATABASE_URL`을 채우거나, 플랫폼에서 KV / D1 / Blob을 바인딩하세요. 무엇이 빠졌는지는 `/api/public/env_check`의 `data.issues`에서 확인할 수 있습니다 |
| 매번 재시작할 때마다 다시 초기화됨 | 데이터가 영속화되지 않고 메모리 폴백으로 동작함. `/api/public/env_check`의 `data.storage.memory`가 `true`인지(또는 `data.issues`에 `STORAGE_MEMORY_ONLY`가 있는지) 확인하세요 |
| 페이지는 404인데 API는 정상 | 정적 자원이 업로드되지 않음. `dist/`가 빌드 산출되었고 플랫폼의 정적 자원 디렉터리가 이를 가리키는지 확인하세요 |
| `JWT_SECRET`을 바꾼 뒤 로그인이 안 되거나 네트워크 드라이브 마운트가 실패함 | 비밀번호, 네트워크 드라이브 자격 증명, OTP 시크릿은 `JWT_SECRET`으로 암호화한 뒤 저장되므로 키를 바꾸면 복호화할 수 없습니다(로그에 `Failed to decrypt a sealed secret (wrong JWT_SECRET?)`가 남습니다). 원래 값으로 되돌리거나 비밀번호와 자격 증명을 다시 입력하세요 |
| 두 플랫폼이 하나의 스토어를 공유하면 데이터가 어긋남 | 양쪽 `JWT_SECRET`이 달라 암호화 필드를 풀 수 없음. 스토어를 공유하면 같은 값을 써야 하며, 스토어가 따로면 일치시킬 필요가 없습니다 |
| EdgeOne에서 KV가 401을 반환함 | Node 클라우드 함수와 Edge Function의 `JWT_SECRET`이 다름(또는 교체됨). 양쪽을 같은 값으로 맞추거나 `EO_KV_URLS`를 올바른 배포 오리진으로 지정하세요 |
| 로그에 `Error reading config from kv: Not connected`가 뜨고 모든 `/api/*`가 503을 반환함 | Node 클라우드 함수는 KV 네임스페이스를 **Redis/RESP 클라이언트**로 받습니다(KV Web API는 엣지 함수 전용). 앱은 이를 무시하고 Blob으로 폴백합니다(정상 동작). Node에서 KV를 실제로 쓰려면 네임스페이스를 엣지 함수에 바인딩하고 `DB_DRIVER=kv`와 `JWT_SECRET`을 설정하세요 |
| 초기화가 간헐적으로 400 `system has already been initialized`로 실패하고 재시도하면 성공함 | 가짜 '초기화됨'입니다. 스토리지에 연결되지 않으면 앱이 메모리 모드로 폴백하여 같은 인스턴스에서는 첫 초기화가 메모리에만 기록되고, 재시도 시 기존 관리자를 읽어 400을 반환합니다. 스토리지를 고치면 사라집니다 |
| `Storage driver "mysql" is not available in this runtime` 오류 | 엣지 런타임에서 `DB_DRIVER=mysql`을 사용함. 이 드라이버는 Node 컨테이너에서만 사용 가능하니 `mysqlhttp`로 바꾸세요 |
| Supabase에서 404 발생 | `kv` 테이블이 없음. 먼저 `CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);`를 실행하세요. 또한 Supabase는 PostgREST를 사용하므로 KV만 지원하며 `DB_FORMAT=sql`은 쓸 수 없습니다 |
| "오프라인 다운로드"에서 `capability unavailable` 표시 | 이 런타임에는 영속적인 오프라인 다운로드 어댑터가 없어 `/fs/add_offline_download`가 501을 반환합니다. 대신 `/api/fs/seed/offline_download`를 사용하세요(`ALLOW_SEED` 허용 목록을 먼저 설정). 작업 목록의 재시도 / 취소도 마찬가지로 501입니다 |

---

## 자주 쓰는 명령

```bash
pnpm run dev:worker     # Worker 개발 서버 시작
pnpm run dev:unified    # 프론트엔드를 가져오고 Worker 시작
pnpm run build          # 프론트엔드와 백엔드 빌드
pnpm run lint           # TypeScript 타입 검사
pnpm run test:all       # 전체 단위 테스트 실행
pnpm run format         # prettier로 코드 포맷
```

---

## 도움말 및 지원

사용 중 문제가 발생하면 아래 채널로 도움을 받을 수 있습니다:

- 🐛 **버그 또는 기능 요청 제출**: 본 저장소 [_Issues_](https://github.com/LegspCpd/openlist-next/issues)
- 💬 **일반 문의 및 교류**: 본 저장소 [_Discussions_](https://github.com/LegspCpd/openlist-next/discussions) 토론 영역

## 오픈소스 라이선스

본 프로젝트는 [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.txt) 라이선스로 배포됩니다.

## 문의하기

🌐 [@LegspCpd](https://github.com/LegspCpd) · 📦 [openlist-next](https://github.com/LegspCpd/openlist-next) · 🐛 [Issues](https://github.com/LegspCpd/openlist-next/issues)

## 기여자

본 프로젝트는 **LegspCpd**가 개발하고 유지보수합니다.

[![Contributors](https://contrib.rocks/image?repo=LegspCpd/openlist-next)](https://github.com/LegspCpd/openlist-next/graphs/contributors)

---

## 감사의 글

본 프로젝트의 설계와 구현은 아래 오픈소스 프로젝트를 참고했으며, 그 저자와 모든 개발자에게 감사드립니다:

- [Alist](https://github.com/AlistGo/alist) 프로젝트 저자 및 모든 개발자
- [OpenList](https://github.com/OpenListTeam/OpenList)(Go 버전) 프로젝트 저자 및 모든 개발자
- [OpenList-Worker](https://github.com/OpenListTeam/OpenList-Worker)(공식 TypeScript 이식판) 프로젝트 저자 및 모든 개발자
- [openlistnext](https://github.com/Polonium-salts/openlistnext) 커뮤니티 프로젝트 저자 및 모든 개발자

> 위 프로젝트의 개발자는 본 저장소의 기여자가 **아닙니다**. 본 저장소는 LegspCpd가 독립적으로 개발·유지보수하며, 위 프로젝트 및 OpenListTeam과 소속, 인가, 후원 관계가 없이 오픈소스 라이선스가 허용하는 범위 내에서만 그 성과를 차용합니다. 자세한 내용은 [NOTICE.md](../NOTICE.md)를 참고하세요.
>
> 프론트엔드의 저작권은 공식 [OpenList-Frontend](https://github.com/OpenListTeam/OpenList-Frontend) 개발자에게 있으며, 본 저장소에는 프론트엔드 소스가 포함되지 않습니다.
