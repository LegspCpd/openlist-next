<div align="center">

# OpenList Next

<p><em>OpenList は多機能なディレクトリ一覧ツールで、さまざまなクラウドストレージ、オブジェクトストレージ、プロトコルサービスに分散したファイルを一つのインターフェースに集約し、閲覧・プレビュー・ダウンロード・共有を行うことができます</em></p>
<p>本リポジトリは公式の <a href="https://github.com/OpenListTeam/OpenList-Worker">OpenList-Worker</a> のコミュニティ派生版であり、TypeScript で記述されており、Cloudflare Workers、Tencent Cloud EdgeOne、Alibaba Cloud ESA などのエッジプラットフォームにデプロイできます</p>
<p>公式バージョンをベースに、本プロジェクトでは「あらゆるエッジプラットフォームから外部データベースに直接接続する」という機能を追加しています</p>

<a href="../LICENSE"><img src="https://img.shields.io/github/license/LegspCpd/openlist-next" alt="License" /></a>
<a href="https://github.com/LegspCpd/openlist-next/actions/workflows/edgeone-artifact-guard.yml"><img src="https://img.shields.io/github/actions/workflow/status/LegspCpd/openlist-next/edgeone-artifact-guard.yml?branch=main" alt="Build status" /></a>
<a href="https://github.com/LegspCpd/openlist-next/issues"><img src="https://img.shields.io/github/issues/LegspCpd/openlist-next" alt="Issues" /></a>
<a href="https://github.com/LegspCpd/openlist-next/discussions"><img src="https://img.shields.io/github/discussions/LegspCpd/openlist-next?color=%23ED8936" alt="Discussions" /></a>

📖 [マルチプラットフォームデプロイガイド](../docs/DEPLOYMENT.md) · 🗄️ [外部ストレージ設定](../docs/EXTERNAL_STORAGE.md) · 🔌 [ワンクリックでデータベースに接続](../docs/ONE_CLICK_DATABASE.md)

</div>

<div align="center">

[English](README_en.md) | [简体中文](../README.md) | [繁體中文](README_zh-TW.md) | 日本語 | [한국어](README_ko.md) | [Français](README_fr.md)

[上流プロジェクト](https://github.com/OpenListTeam/OpenList-Worker) · [貢献ガイドライン](../CONTRIBUTING.md) · [ライセンス](../LICENSE) · [出典とライセンスに関する声明](../NOTICE.md)

</div>

> [!WARNING]
> 本プロジェクトは OpenList の公式リリース**ではなく**、OpenListTeam との間に所属・認可・推奨の関係は一切ありません。
> 使用中に問題が発生した場合は、本リポジトリに Issue を作成してください。公式リポジトリに報告しないでください。
> コードの出典、著作権、ライセンスに関する説明は [NOTICE.md](../NOTICE.md) を参照してください。

---

## はじめに

OpenList Next は、複数のクラウドストレージ、オブジェクトストレージ、プロトコルサービスに散らばったファイルを 1 つの画面に集約し、閲覧・プレビュー・ダウンロード・共有・管理を可能にします。バックエンドは TypeScript で書かれており、エッジコンピューティングプラットフォーム上で動作します。

公式の [OpenList-Worker](https://github.com/OpenListTeam/OpenList-Worker) をベースにしており、そこに「どのエッジプラットフォームからでも外部データベースに直接接続できる」という点を追加しています。両者の違いは下の[機能概要](#機能概要)の比較表にまとめています。

順番に読み進めるか、必要な項目へ直接ジャンプしてください：

- [ワンクリックデプロイ](#ワンクリックデプロイ) —— ボタンで EdgeOne、Cloudflare Workers、Vercel、Netlify にデプロイ
- [機能概要](#機能概要) —— 対応するクラウドストレージ、できること、公式版との違い
- [環境変数](#環境変数) —— 各変数の役割、設定が必要かどうか、設定方法
- [手動デプロイ](#手動デプロイ) —— ローカルで動かす、またはコマンドラインから各プラットフォームへデプロイ
- [デプロイ後の確認](#デプロイ後の確認) —— ストレージが本当に接続されているか、メモリへのフォールバックに気づかず放置していないか
- [技術アーキテクチャ](#技術アーキテクチャ) —— 使用しているフレームワークとビルドツール
- [よくある質問](#よくある質問) —— よくあるエラーの原因と対処方法

---

## ワンクリックデプロイ

下のボタンをクリックすると、本プロジェクトを対応するプラットフォームにデプロイできます：

<div align="center">

| EdgeOne · 国際版 | EdgeOne · 中国版 | Cloudflare Workers |
| :---: | :---: | :---: |
| [![EdgeOne でデプロイ](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?project-name=openlist-next&repository-url=https://github.com/LegspCpd/openlist-next&install-command=pnpm%20install%20--no-frozen-lockfile&build-command=pnpm%20run%20build&output-directory=dist&env=JWT_SECRET) | [![EdgeOne でデプロイ](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://console.cloud.tencent.com/edgeone/makers/new?project-name=openlist-next&repository-url=https://github.com/LegspCpd/openlist-next&install-command=pnpm%20install%20--no-frozen-lockfile&build-command=pnpm%20run%20build&output-directory=dist&env=JWT_SECRET) | [![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/LegspCpd/openlist-next) |

| Vercel | Netlify |
| :---: | :---: |
| [![Vercel でデプロイ](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/LegspCpd/openlist-next) | [![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/LegspCpd/openlist-next) |

</div>

デプロイ完了後、環境変数の設定が必要です。その中でも `JWT_SECRET` は必須であり、`openssl rand -hex 32` で生成できます。

- EdgeOne：[国際版コンソール](https://console.edgeone.ai/makers) · [中国版コンソール](https://console.cloud.tencent.com/edgeone/makers)
- Cloudflare：[Worker 管理画面](https://dash.cloudflare.com/)
- Vercel：プロジェクト設定 → Environment Variables
- Netlify：Site configuration → Environment variables

よく使う変数は以下のとおりです：

- `JWT_SECRET`：セッション署名およびフィールド暗号化に用いる鍵、**必須**
- `ADMIN_PASS`：任意。設定するとインストールウィザードをスキップし、このパスワードで管理者アカウントを直接初期化します
- `DB_FORMAT`：データの構成方法。`map`（デフォルト）/ `key` / `sql`
- `DB_DRIVER`：データの保存先。`auto`（デフォルト、自動判別）/ `kv` / `d1` / `blob` / `neon` / `turso` / …
- `DATABASE_URL`：外部データベースの接続文字列。これを入力し `DB_DRIVER=auto` のままにしておくと、プログラムが自動的に接続します

> [!IMPORTANT]
> Cloudflare から「リポジトリの内容を取得できません」と表示された場合は、まず本リポジトリを [Fork](https://github.com/LegspCpd/openlist-next/fork) し、改めて「GitHub リポジトリに接続」する方法でデプロイしてください。

---

## 機能概要

この節では 4 つの点を扱います。どのストレージをマウントできるか、どのようなコア機能があるか、権限をどう管理するか、どこにデプロイできるか。最後の項目で公式版との違いをまとめています。

ここで挙げる機能は公式の [OpenList-Worker](https://github.com/OpenListTeam/OpenList-Worker) によるものです。公式 [OpenListTeam/OpenList](https://github.com/OpenListTeam/OpenList) の TypeScript + Serverless 移植版であり、画面と操作感は両者で同じで、違いはストレージとデプロイの 2 点だけです。

### ストレージ集約

**80 個のストレージドライバー**を内蔵しており、さまざまなストレージバックエンドをそのままマウントできます：

- **国内クラウドストレージ**：Alibaba Cloud Drive（オープンプラットフォーム／共有）、Quark クラウドドライブ（オープンプラットフォーム／UC TV 版）、Baidu クラウドドライブ（アルバム）、115 クラウドドライブ（オープンプラットフォーム／共有）、123 クラウドドライブ（オープンプラットフォーム／共有）、Tianyi クラウドドライブ（189／PC／TV）、China Mobile クラウドドライブ（139／Hecaiyun）、Woja クラウドドライブ、Xunlei クラウドドライブ、Tencent Weiyun、Lanzou、PikPak（共有）、Doubao クラウドドライブ、Guangya ドライブ、Chaoxing グループクラウドドライブ、Lenovo NAS 共有、Teambition クラウドドライブ、WPS クラウドドライブ、Ali ドキュメント、HalalCloud、MediaTrack など
- **海外クラウドストレージ**：Google Drive（アルバム）、OneDrive（アプリ／共有リンク）、Dropbox、MEGA、MediaFire、Proton Drive、Yandex Disk、Degoo、Bunny Storage、TeraBox など
- **オブジェクトストレージ**：S3 互換（AWS／OSS／COS／MinIO など）、UPYUN USS、Azure Blob、WebDAV、IPFS など
- **コードホスティング**：GitHub、GitHub Releases、CNB Releases
- **クラウドドライブソフトウェア**：OpenList（共有）、AList V3、Cloudreve V3／V4、Kodbox（可道雲）、Seafile、Teldrive、Febbox など
- **その他のドライバー**：NetEase Cloud Music、Misskey、Emby、Cloudflare 画像ホスティングなど

上記の実ストレージに加え、`Alias`、`UrlTree`、`AutoIndex`、`Strm`、`Crypt`、`Virtual`、`Chunk` といった仮想／機能型ドライバーも用意されており、アドレスの別名、URL リスト、暗号化ストレージ、チャンク分割などのシナリオに利用できます。

### コア機能

- **ファイル閲覧**：統合されたディレクトリツリーによる閲覧。画像、動画、音声、文書、コード、圧縮ファイルなどのオンラインプレビューに対応。
- **アップロード／ダウンロード**：ストレージをまたいだアップロード、一括ダウンロード、ストリーミング転送、および直リンクへのジャンプ。
- **ファイル共有**：有効期限・パスワード・権限管理付きの共有リンクを生成し、匿名アクセスやディレクトリ共有に対応。
- **全文検索**：インデックス済みのストレージ内でファイルを高速に検索。
- **オフラインダウンロード（制限あり）**：`/api/fs/seed/offline_download` が seed データ（トレント、直リンク、CAS）を解析して対象ストレージへ同期的に書き込みます。`ALLOW_SEED` の許可リストと `OFFLINE_DOWNLOAD` 権限が必要です。バックグラウンドのタスクキューはありません。`/fs/add_offline_download` とタスクの再試行 / キャンセルは未実装（501）です。
- **外部インターフェース**：集約したストレージを WebDAV または S3 互換プロトコルとして外部に公開し、サードパーティツールへのマウントが容易。
- **MCP サービス**：Model Context Protocol のエンドポイントを提供し、AI アシスタントなどのクライアントから統合して呼び出し可能。

### 権限管理

- **権限管理**：3 つのロール（管理者 / 一般ユーザー / ゲスト）に加え、ディレクトリ単位の読み書き権限（メタデータの `read_users` / `write_users`。サブディレクトリも指定可）に対応。
- **認証方式**：内蔵のアカウント／パスワードに加え、TOTP 認証、WebAuthn ログイン（パスキー。既定では無効で、設定で有効化が必要）、SSO シングルサインオン、LDAP ディレクトリ認証に対応。
- **セキュリティ強化**：JWT セッション、同一オリジン CORS ポリシー（`ALLOW_URLS` で許可しない限り任意の Origin は返しません）、クリックジャッキング対策（`X-Frame-Options: DENY`）、コンテンツセキュリティポリシー（CSP）、HSTS。
- **ヘルスチェック**：`/api/healthz` が準備完了プローブです。実際にストレージを 1 回読み、利用できない場合は 503 を返すため、監視・アラートにはこちらを使ってください。`/api/health` は生存マーカーにすぎず、ストレージの状態は反映しません。

### プラットフォームデプロイ

- **実行プラットフォーム**：Cloudflare Workers、Tencent Cloud EdgeOne Makers、Alibaba Cloud ESA、Vercel、Netlify、および Node.js コンテナ環境。
- **データストレージ**：プラットフォーム標準のストレージ（KV／D1／Blob …）または任意の外部データベース。
- **ワンクリックデプロイ**：EdgeOne、Cloudflare Workers、Vercel、Netlify のワンクリックデプロイボタンに対応。

### 公式バージョンとの違い

| | 公式 OpenList-Worker | 本プロジェクト |
|---|---|---|
| ストレージドライバー | 6 個 | 16 個、10 個を新規追加（`neon`、`turso`、`pgrest`、`pghttp`、`mysqlhttp`、`upstash`、`s3`、`r2`、`netlifyblobs`、`hyperdrive`）|
| SQL 方言 | SQLite、MySQL | PostgreSQL を追加（$n プレースホルダーを含む） |
| クラウドドライブドライバー | 78 個 | 80 個、`123_link`、`ilanzou`、`halalcloud` を補完。ローカルファイルシステムでしか意味のない `Local` は削除 |
| デプロイプラットフォーム | Cloudflare Workers、EdgeOne、ESA、Vercel、Serverless、Node／Docker | Netlify を追加し、EdgeOne / ESA / Vercel 向けのワンコマンドデプロイスクリプトも補完 |

公式バージョンの `mysql` ドライバーは Node コンテナでのみ動作します——Cloudflare Workers には生 TCP がないため、エッジにデプロイするとプラットフォーム標準の KV しか使えません。本プロジェクトが追加した 10 個のうち 8 個（`neon`、`turso`、`pgrest`、`pghttp`、`mysqlhttp`、`upstash`、`s3`、`netlifyblobs`）は HTTP 経由なので、エッジランタイムでも外部データベースに接続でき、`DATABASE_URL` を 1 行入力するだけで済みます。残り 2 つの方式は異なり、`r2` は Cloudflare のバケットバインディングを、`hyperdrive` は `mysql2` による TCP 直結を使うため Node 環境でのみ利用できます。

詳細は [外部ストレージ設定ガイド](../docs/EXTERNAL_STORAGE.md) を参照してください。

---

## 環境変数

### 変数の設定場所

同じ変数名を、以下のいずれかに設定しても効果は同じです。

| デプロイ方式 | 設定場所 |
|---|---|
| Cloudflare Workers | コンソールのプロジェクト Settings → Variables and Secrets、またはターミナルで `wrangler secret put JWT_SECRET` を実行 |
| 騰訊雲 EdgeOne | コンソールのプロジェクトの「環境変数」。ワンクリックデプロイボタンを押すと、デプロイページで直接入力を求められます |
| Vercel / Netlify | プロジェクト設定の Environment Variables |
| Node / Docker | ルートディレクトリの `.env` ファイル |

以下は「変数名 —— 説明 —— 設定が必要か」の順で箇条書きにしています。

### 必須の変数

| 変数名 | 説明 | 設定必須か | 設定方法 |
|---|---|---|---|
| `JWT_SECRET` | プログラム全体のシークレット。以下の 3 つにすべて使われます：ログインセッションの署名、ドライブ認証情報などのフィールドの暗号化保存、定期タスクの認証 | **必須**。未設定の場合、インストール後にドライブをマウントすると失敗します | ランダムな文字列（16 文字以上）。`openssl rand -hex 32` で生成した文字列を入力 |

> [!IMPORTANT]
> `JWT_SECRET` を変更したり間違えて入力したりすると、これまでに保存したドライブ認証情報が復号できなくなり、「マウント時に突然再入力を求められる」ようになります。同一のデータを複数のプラットフォームにデプロイする場合、各プラットフォームの `JWT_SECRET` は一致させる必要があります。

### データの保存先

この 2 つの変数が、データをどのストレージに落とすか、どの構成で保存するかを決めます。

| 変数名 | 説明 | 設定必須か | 選択肢 |
|---|---|---|---|
| `DB_DRIVER` | データをどのストレージに保存するか | 任意、デフォルトは `auto` | `auto`、`kv`、`d1`、`r2`、`blob`、`cfkv`、`do`、`neon`、`turso`、`pgrest`、`pghttp`、`mysqlhttp`、`upstash`、`s3`、`hyperdrive`、`netlifyblobs`、`mysql` |
| `DB_FORMAT` | データをどの構成で整理するか | 任意、デフォルトは `map` | `map`、`key`、`sql` |

- `auto` は以下の順で選びます：設定した外部データベース → プラットフォーム標準のストレージ（KV、D1、Blob など）。迷ったら `auto` を使ってください。
- `map`：ストア全体を 1 つの JSON として保存し、読み書きをそれぞれ 1 回行います。リクエスト回数が最も少なく、KV やオブジェクトストレージに適しています。
- `key`：エンティティごとに 1 レコード（例：`users_1`）を保存します。エンティティが多い場合は `map` より通信量を抑えられます。
- `sql`：リレーショナルテーブルで保存します。テーブル構造は Go 版 OpenList と同じで、Go 版と同じデータベースを共有できます。
- `mysql` は Node / Docker でのみ利用可能です。エッジプラットフォームには生 TCP がないため接続できません。

よく使う組み合わせの例：

```bash
# Cloudflare Workers + D1
DB_FORMAT=sql
DB_DRIVER=d1

# EdgeOne + Blob（データベース作成不要、初回書き込み時に自動作成）
DB_FORMAT=map
DB_DRIVER=blob

# 外部データベース（Neon など）
DB_FORMAT=map
DB_DRIVER=auto
DATABASE_URL=postgres://user:pass@ep-xxx.neon.tech/neondb
```

### 外部データベース（プラットフォーム標準ストレージを使わない場合）

最も簡単な方法は **`DATABASE_URL` を 1 件だけ設定し、`DB_DRIVER` は `auto` のままにしておく** ことです。プログラムがプロトコルとホスト名から自動的にどのベンダーかを判別します。

| 変数名 | 説明 | 設定必須か |
|---|---|---|
| `DATABASE_URL` | 汎用のデータベース接続文字列。どのベンダーかを判別するとそのベンダーのドライバーを使用します | 外部データベースを使う場合、この 1 件でたいてい十分 |
| `SUPABASE_KEY` | Supabase の読み書きキー。接続文字列だけでは不足します | Supabase を使う場合は必須 |
| `TURSO_AUTH_TOKEN` | Turso のアクセストークン | Turso を使う場合は必須 |
| `MYSQL_HTTP_URL` | MySQL / MariaDB の HTTP 転送ゲートウェイのアドレス。エッジプラットフォームから MySQL に接続するにはこれ経由しかありません | エッジで MySQL を使う場合は必須 |
| `PG_HTTP_URL` | 自分で立てた Postgres HTTP ゲートウェイのアドレス | 自前のゲートウェイを使う場合は必須 |
| `MYSQL_URLS` | MySQL 直接接続の接続文字列。Node / Docker のみ利用可能 | Node で MySQL に直接接続する場合に設定 |

各ベンダーの接続文字列の書き方や、サポートされている変数の別名については[外部ストレージ設定ガイド](../docs/EXTERNAL_STORAGE.md)を参照してください。

### プラットフォームバインディング（手動入力不要、バインドするだけ）

これらはデプロイ時にプラットフォームから環境へ自動で注入されます。コンソールでリソースを作成し、バインド時に名前を以下のようにするだけで済みます。

| 変数名 | 説明 | 設定が必要か |
|---|---|---|
| `DB` | Cloudflare D1 データベースのバインディング。`DB_DRIVER=d1` で使用します | D1 を使うならバインドし、名前は `DB` に |
| `KV` | Cloudflare KV / EdgeOne KV の名前空間バインディング。`DB_DRIVER=kv` で使用します | KV を使うならバインドし、名前は `KV` に |
| `HYPERDRIVE` | Cloudflare Hyperdrive の接続文字列。エッジから MySQL にアクセスできるようにします。`DB_DRIVER=hyperdrive` で使用します | Hyperdrive を使うならバインド |
| `S3_BUCKET`、`S3_REGION`、`S3_ENDPOINT`、`S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY` | S3 互換オブジェクトストレージ（R2 / MinIO / B2 など）のバケット名とアクセス認証情報。`DB_DRIVER=s3` で使用します | S3 ストレージを使うなら 5 項目すべてを設定 |
| `CF_ACCOUNT`、`CF_KV_UUID`、`CF_API_KEY` | Cloudflare REST API 経由で KV を読み書きする際の値。`DB_DRIVER=cfkv` で使用します。それぞれアカウント ID、KV 名前空間 ID、KV の読み書き権限を持つ API Token です | `cfkv` を使うなら 3 項目すべてを設定 |
| `BUCKET` | Cloudflare R2 のバケットバインディング。`DB_DRIVER=r2` で使用します（`R2_BUCKET`／`OPENLIST_BUCKET`／`OPENLIST_R2` も可） | R2 を使うならバインドし、名前を `BUCKET` にする |

### その他の変数（たいていは設定不要）

| 変数名 | 説明 | 設定必須か |
|---|---|---|
| `EO_KV_URLS` | EdgeOne 専用。KV バインディングはエッジ関数にのみ注入され、Node クラウド関数からは取得できないため、読み書きは**このデプロイ自身**の `/kv-get` `/kv-put` `/kv-delete` `/kv-list` エッジ関数を経由して転送されます。ここには**このデプロイの origin**（例：`https://openlist.example.com`）を設定します（プロトコル+ホスト+ポートのみ取得され、後続のパスは無視されます） | 通常は空のままにします。空ならアクセス中のドメインが自動使用されます。アクセスするドメインとデプロイ先ドメインが異なる場合（手前に CDN や独自ドメインがある場合）やローカルデバッグの場合にのみ手動設定します |
| `ADMIN_PASS` | これを設定するとインストールウィザードを経ずに、このパスワードで管理者アカウントを作成します | 任意。未設定ならブラウザのウィザードで設定 |
| `ALLOW_URLS` | CORS の許可リスト。カンマ区切り。未設定の場合は同一オリジンからのリクエストのみ許可 | フロントエンドとバックエンドが別ドメインの場合に設定 |
| `ASSET_URLS` | フロントエンドの静的リソースを CDN から読み込むようにします。`$version` で現在のフロントエンドバージョン番号をプレースホルダとして使えます | CDN を使う場合に設定 |
| `MAX_UPLOAD` | 1 回の全体アップロードのサイズ上限。単位はバイト | 任意。デフォルトは 26214400（25MB） |
| `MAX_UPPART` | チャンクアップロード時の 1 チャンクのサイズ上限。単位はバイト | 任意。デフォルトは 16777216（16MB） |
| `ALLOW_SEED` | シードデータのソースとして許可するサイトの許可リスト | シード機能を使う場合に設定 |

### コマンドライン専用（環境変数には入れません）

| 変数名 | 説明 |
|---|---|
| `EO_PAGES_PROJECT` | EdgeOne Makers CLI がデプロイするプロジェクト |
| `EO_PAGES_API_TOKEN` | EdgeOne Makers コンソールの API Token。CLI が使用します |
| `EO_PAGES_URL` | デプロイ後のドメイン。`pnpm run deploy:edgeone` がデプロイ後の確認に使用します |

すべての変数は[変数テンプレート](../.dev.vars.example)にコメント付きで列挙されています。

---

## 手動デプロイ

### 前提条件

- Node.js **22.x**
- pnpm **9.15.4**（corepack 経由で有効化）
- Cloudflare Workers にデプロイする場合は、Cloudflare アカウントが必要

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
```

### ローカル開発

```bash
git clone https://github.com/LegspCpd/openlist-next.git
cd openlist-next
pnpm install

cp .dev.vars.example .dev.vars
openssl rand -hex 32        # JWT_SECRET を生成し、上のファイルに記入する

pnpm run dev:unified        # 公式フロントエンドを取得して Worker を起動する
pnpm run dev:worker         # Worker のみを起動する
```

> `pnpm run build` はまず公式フロントエンドリポジトリ OpenList-Frontend をクローンして `dist/` をコンパイルし、その後バックエンドを `dist-server/` にコンパイルします。
> すでにローカルにフロントエンドの成果物がある場合は、`FRONTEND_DIST=/path/to/dist pnpm run build` とすることでクローンをスキップできます。
> 依存関係の中に GitHub 由来のパッケージ（`@hope-ui/solid`、`mpegts.js`）が 2 つあり、初回インストールは時間がかかるのが正常です。

### Cloudflare Workers へのデプロイ

コマンドラインを使用する場合：

```bash
npx wrangler login
openssl rand -hex 32 | npx wrangler secret put JWT_SECRET

pnpm run build
pnpm run deploy:worker
```

また、Cloudflare 管理画面で Git リポジトリを接続することもできます。ビルドコマンドに `pnpm run build` を入力し、出力ディレクトリは空のままにしておけば、wrangler が `wrangler.jsonc` を読み取ります。

ストレージについて：`wrangler.jsonc` にはデフォルトで KV バインディングが宣言されており、初回デプロイ時に wrangler が自動的に `openlist-next-kv` を作成してバインドします。以降のデプロイでは毎回再利用され、手動で作成する必要はありません。D1、R2、Durable Objects に変更したい場合は、`wrangler.jsonc` 内の該当するコメントを有効にするだけです。具体的な書き方はファイル内のコメントに記載されています。

> 注意：ローカルで `wrangler deploy` や `wrangler dev` を実行する前には、必ず先に `pnpm run build` を実行してください。
> `wrangler.jsonc` 内の `assets.directory` は `./dist` を指していますが、このディレクトリはデフォルトでは存在しません（`.gitignore` によって無視されています）。
> そのまま実行すると `The directory specified by the "assets.directory" field ... does not exist` と表示されます。
> ワンクリックデプロイボタンや管理画面で Git リポジトリを接続する場合は、プラットフォームが自動的にビルドするため、影響はありません。

> `DB_DRIVER` を `mysql` に設定してはいけません——Cloudflare Workers には生 TCP がないため、このドライバーはエッジでは動作しません。
> 外部 MySQL に接続する場合は、`mysqlhttp`（HTTP ゲートウェイを自前で構築する必要あり）を使用するか、`neon`／`turso` に切り替えてください。

### Tencent Cloud EdgeOne へのデプロイ

[国際版](https://edgeone.ai/) と [中国版](https://console.cloud.tencent.com/edgeone) のどちらでも可能です。

上のワンクリックデプロイボタンをクリックするか、コンソールでプロジェクトを作成して Git リポジトリをインポートします。ビルドコマンドに `pnpm run build`、出力ディレクトリに `dist` を入力します。これらの設定は `edgeone.json` にも記載されており、実際の設定はファイルが優先されます。

> **重要**：`cloud-functions/[[default]].js` はビルド成果物ですが、EdgeOne はデプロイ時にリポジトリからこれを読み取るため、リポジトリにコミットする必要があり、`.gitignore` に追加してはいけません。
> このファイルがないと、EdgeOne は `No server-handler detected` を報告し、プロジェクトは単なる静的サイトへと退化します。
> リポジトリ内の `EdgeOne Artifact Guard` ワークフローは、成果物の有効期限が切れた際に自動的に再構築してコミットするため、通常は手動でメンテナンスする必要はありません。

ストレージについて、EdgeOne の KV と Blob の Web API は**エッジ関数**でのみ利用でき、Node クラウド関数からは取得できません。なお Node 側にも `KV` という名前のオブジェクトは見えますが、それは Redis/RESP クライアントであり KV Web API ではありません。本アプリはそれを意図的に無視するため、KV として使わないでください。そのため本プロジェクトでは EdgeOne 上で 2 つのエントリーポイントを使用しています：

| ファイル | 役割 |
|---|---|
| `api/_makers.ts`（ビルド成果物 `cloud-functions/[[default]].js`） | Node クラウド関数、バックエンド本体 |
| `functions/*` | エッジ関数。KV プロキシとストレージプローブを担当 |
| `middleware.js` | エッジミドルウェア。フロントエンドのルーティングフォールバックを担当 |

`DB_DRIVER` をデフォルトの `auto` のままにしておくと、プログラムは以下の順序でストレージを自動選択します：

1. 外部データベース（もし `DATABASE_URL` を設定した場合）
2. **KV**：コンソールの「KV ストレージ」で名前空間を作成し、それを**エッジ関数**（Node クラウド関数ではない）にバインドする。バインド変数名には `KV` を入力し、`JWT_SECRET` を設定する（`EO_KV_URLS` は通常空のままで、空ならアクセス中のドメインが自動使用される）
3. **Blob**：設定は一切不要。最初の書き込み時に `@edgeone/pages-blob` が自動的にストレージを作成する

注意すべきいくつかの落とし穴があります（本プロジェクトではすでに対処済みですが、自分で設定を変更する際は留意してください）：

- `edgeone.json` の `nodeVersion` にはプラットフォームにプリインストールされたバージョンを指定します。公式ドキュメントに記載されているのは 14.21.3／16.20.2／18.20.4／20.18.0／22.11.0 の 5 つだけで、それ以外を指定するとビルドに失敗する可能性があります。本プロジェクトは `22.11.0` を使用します。フロントエンド取得時、`scripts/fetch-frontend.mjs` は上流が pin している pnpm 11 が Node ≥ 22.13 を要求することに気づき、自動的に pnpm 10 へフォールバックします。このフィールドはコンソール側のプロジェクト設定を上書きします
- `maxDuration` は `cloudFunctions.nodejs` の中に書く必要があり、`cloudFunctions.maxDuration` と書いても効力を持ちません
- フロントエンドのルーティングフォールバックはルートの `middleware.js` が担当するため、`edgeone.json` に `rewrites` は設定していません。Makers は現在 `{"source": "/*", "destination": "/index.html"}` による SPA フォールバックの宣言にも対応しています（通常のリライトではなく fallback として認識されます）が、同じフォールバックを 2 か所に書くと衝突しやすいため、本プロジェクトは `middleware.js` の 1 か所だけにしています
- ストレージの検証に `*.edgeone.cool` のような一時ドメインを使用しないでください。このドメインには全サイト認証パラメーターが付与されており、エッジ関数とクラウド関数間の KV プロキシリクエストを遮断します。検証する前に必ずカスタムドメインをバインドしてください

ワンクリックデプロイボタンを使いたくない場合は、Makers CLI も利用できます：

```bash
EO_PAGES_PROJECT=openlist-next \
EO_PAGES_API_TOKEN=<コンソールで取得した Token> \
pnpm run deploy:edgeone -- --url https://あなたのドメイン --deep
```

このスクリプトはビルド、デプロイを行い、その後ストレージが実際に利用可能かどうかを自動的にチェックします。

### Vercel へのデプロイ

デプロイボタンをクリックすると、デプロイページの下部に **Marketplace Database Providers** のリストが表示されるので、いずれかを選んで「接続」をクリックするだけです。Vercel は接続情報を自動的に環境変数として注入し、本プロジェクトの `DB_DRIVER=auto` がそれを認識して自動的に接続するため、コードを変更する必要はありません。

対応状況：Neon、Upstash、Supabase、Turso はそのまま利用可能。Nile、Prisma Postgres、AWS RDS には Postgres-over-HTTP ゲートウェイが必要。Redis（純 TCP）、MongoDB、Convex、MotherDuck はエッジ環境では利用できません。詳細は [ワンクリックでデータベースに接続](../docs/ONE_CLICK_DATABASE.md) を参照してください。

また、Vercel コンソールで Import Git Repository を選び、フレームワーク検出で **Other** を選ぶ（設定はすべて `vercel.json` に記載）か、コマンドラインを使用することもできます：

```bash
npx vercel login
npx vercel deploy --prod --yes

# または、ビルド・デプロイ・ストレージチェックを 1 コマンドで完了する
pnpm run deploy:vercel -- --url https://あなたのドメイン
```

Vercel の関数の 1 回の実行上限はデフォルトで 10 秒（Pro は 60 秒）で、ディレクトリが非常に大きい場合はタイムアウトする可能性があるため、`DB_FORMAT=map` を使用してデータベースへの往復回数を減らすことをおすすめします。

### Alibaba Cloud ESA へのデプロイ

ESA コンソールの「エッジコンピューティング → 関数と Pages」でプロジェクトを作成し、GitHub リポジトリをインポートします。ビルドコマンドに `pnpm run build`、静的リソースディレクトリに `./dist`、関数ファイルのパスに `./dist-server/esa-entry.js` を入力します。

コマンドラインも利用できます：

```bash
pnpm install
pnpm run build

npx esa-cli login
npx esa-cli commit
npx esa-cli deploy

# または、ビルド・コミット・デプロイ・ストレージチェックを 1 コマンドで完了する
pnpm run deploy:esa -- --url https://あなたのドメイン
```

`esa.jsonc` には 2 つの重要な設定があります：

- `entry` は `./dist-server/esa-entry.js` を指します。サーバー側の成果物は、静的ファイルとして公開ダウンロードされてしまわないよう、意図的に `dist-server/` ではなく `dist/` の外に置かれています
- `assets.notFoundStrategy` を `singlePageApplication` に設定します。これを設定しないと、`/login`、`/@manage/*` のようなフロントエンドルーティングが直接 404 になります

ESA はリクエストごとに KV サブリクエストの回数制限があり、プラットフォーム標準の EdgeKV を使い続ける場合は `DB_FORMAT=map`（データベース全体を 1 つの key とし、読み書きそれぞれ 1 回）の使用をおすすめします。

### Netlify へのデプロイ

Netlify で Git リポジトリを接続するだけです。`netlify.toml` にはすでにビルド設定が記述されています。コマンドラインでは `netlify deploy --build --prod` も利用できます。

Netlify にはプラットフォームレベルのストレージがないため、外部データベースへの接続が必須です。環境変数は **Site configuration → Environment variables** で設定します。例えば：

```bash
JWT_SECRET=<ランダムな文字列>
DATABASE_URL=postgres://user:pass@ep-xxx.neon.tech/neondb
DB_FORMAT=map
```

> Netlify Functions の 1 回の実行上限は 10 秒（Pro は 26 秒）で、コールドスタートにクラウドストレージ API の往復が加わるとタイムアウトしやすいため、本番環境では Cloudflare Workers を優先することをおすすめします。

### Node / Docker へのデプロイ

これが `DB_DRIVER=mysql` で TCP に直接接続できる唯一のシナリオです。

```bash
pnpm install
pnpm run build
pnpm start
```

環境変数はルートディレクトリの `.env` に記述します（`loadEnv.js` が読み取ります）：

```bash
JWT_SECRET=<ランダムな文字列>
DATABASE_URL=mysql://user:pass@127.0.0.1:3306/openlist
DB_DRIVER=mysql
DB_FORMAT=sql
```

---

## デプロイ後の確認

デプロイが成功することと、ストレージが利用可能であることは別の問題です。最悪の場合、ストレージドライバーがこっそりメモリモードに退避してしまいます。サイトは開き、ログインもできますが、再起動するとデータが消えてしまいます。

```bash
curl https://あなたのドメイン/api/public/env_check
```

返された内容の中で、特に以下のフィールドを確認してください：

- `data.storage.memory`：`true` はメモリへのフォールバックを意味し、再起動でデータが失われるため必ず対処が必要です（この場合 `data.config.resolved_driver` は `memory` です）
- `data.jwt.ready`：`JWT_SECRET` が設定されているかどうか。設定されていないと、マウント認証情報などの暗号化フィールドを復号できません
- `data.ready`：全体として準備完了かどうか
- `data.issues`：問題の一覧。各項目に `code`（`STORAGE_MEMORY_ONLY`、`JWT_SECRET_MISSING` など）が付いており、切り分けの取っ掛かりとして最も速い

統合スクリプトにチェックを任せることもできます（チェックのみで、再デプロイはしません）：

```bash
pnpm run deploy:edgeone -- --no-deploy --url https://あなたのドメイン
pnpm run deploy:esa     -- --no-deploy --url https://あなたのドメイン
pnpm run deploy:vercel  -- --no-deploy --url https://あなたのドメイン
```

終了コード `0` はストレージが準備完了であることを、終了コード `2` はまだ準備ができていないことを意味します。EdgeOne ではさらに `/storage-probe` を 1 回読み取り、KV と Blob がそれぞれ利用可能かどうかを通知します。

---

## 技術アーキテクチャ

### バックエンド

- **実行環境**：Cloudflare Workers／Tencent Cloud EdgeOne／Alibaba Cloud ESA／Vercel／Netlify／Node.js コンテナ
- **Web フレームワーク**：Hono.js
- **言語**：TypeScript
- **ビルドツール**：Wrangler、esbuild

### フロントエンド

- **フレームワーク**：SolidJS + TypeScript
- **UI ライブラリ**：Hope UI
- **ビルドツール**：Vite

> フロントエンドは本リポジトリにはなく、ビルド時に `scripts/fetch-frontend.mjs` によって公式リポジトリから取得されます。

---

## よくある質問

| 現象 | 原因と対処法 |
|---|---|
| `No storage backend is available` と表示される | ストレージが一つも設定されていない。`DATABASE_URL` を入力するか、プラットフォーム上で KV／D1／Blob をバインドする。どれが欠けているかは `/api/public/env_check` の `data.issues` で確認できる |
| 毎回再起動時に再初期化が必要になる | データが永続化されず、メモリへのフォールバックになっている。`/api/public/env_check` の `data.storage.memory` が `true` か（または `data.issues` に `STORAGE_MEMORY_ONLY` があるか）を確認する |
| ページが 404 になるが API は正常 | 静的リソースがアップロードされていない。`dist/` がビルドで出力されていること、およびプラットフォームの静的リソースディレクトリがそこを指していることを確認する |
| `JWT_SECRET` を変更したらログインできない、またはネットディスクのマウントに失敗する | パスワード、ネットディスクの認証情報、OTP シークレットは `JWT_SECRET` で暗号化してから保存されるため、鍵を変更すると復号できない（ログには `Failed to decrypt a sealed secret (wrong JWT_SECRET?)` と出る）。元の値に戻すか、パスワードとネットディスクの認証情報を入れ直す |
| 2 つのプラットフォームが 1 つのストアを共有するとデータが壊れる | 両者の `JWT_SECRET` が異なるため、暗号化フィールドを復号できない。1 つのストアを共有する場合は同じ値にする必要がある（ストアが別々なら一致不要） |
| EdgeOne で KV が 401 を返す | Node クラウド関数と Edge Function の `JWT_SECRET` が一致していない（またはローテートされた）。両者で同じ値にするか、`EO_KV_URLS` を正しいデプロイ先のオリジンに向ける |
| ログに `Error reading config from kv: Not connected` が出て、すべての `/api/*` が 503 を返す | Node クラウド関数には KV 名前空間が **Redis/RESP クライアント**として渡されています（KV Web API はエッジ関数のみ）。アプリはそれを無視して Blob にフォールバックします（想定どおりの動作）。Node から KV を実際に使うには、名前空間をエッジ関数にバインドし、`DB_DRIVER=kv` と `JWT_SECRET` を設定してください |
| 初期化が時々 400 `system has already been initialized` で失敗し、再試行すると成功する | 偽の「初期化済み」です。ストレージに到達できないとアプリはメモリ動作に退避するため、同じインスタンスでは最初の初期化がメモリにしか書かれず、再試行時に既存の管理者を読んで 400 を返します。ストレージを直せば解消します |
| `Storage driver "mysql" is not available in this runtime` と報告される | エッジランタイムで `DB_DRIVER=mysql` を使用しているが、このドライバーは Node コンテナでのみ利用可能。`mysqlhttp` に変更する |
| Supabase で 404 になる | `kv` テーブルが存在しない。まず `CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);` を実行する。なお Supabase は PostgREST 経由のため KV のみ対応で、`DB_FORMAT=sql` は使用できない |
| 「オフラインダウンロード」で `capability unavailable` と表示される | このランタイムには永続化可能なオフラインダウンロードアダプターがなく、`/fs/add_offline_download` は 501 を返します。代わりに `/api/fs/seed/offline_download` を使用してください（先に `ALLOW_SEED` の許可リストを設定）。タスク一覧の再試行 / キャンセルも同様に 501 です |

---

## よく使うコマンド

```bash
pnpm run dev:worker     # Worker 開発サーバーを起動する
pnpm run dev:unified    # フロントエンドを取得して Worker を起動する
pnpm run build          # フロントエンドとバックエンドをビルドする
pnpm run lint           # TypeScript の型チェックを行う
pnpm run test:all       # すべての単体テストを実行する
pnpm run format         # prettier でコードをフォーマットする
```

---

## ヘルプとサポート

利用中に問題が発生した場合は、以下のチャネルからヘルプを得ることができます：

- 🐛 **バグ報告や機能リクエスト**：本リポジトリの [_Issues_](https://github.com/LegspCpd/openlist-next/issues) へ
- 💬 **一般的な質問や議論**：本リポジトリの [_Discussions_](https://github.com/LegspCpd/openlist-next/discussions) 掲示板へ

## オープンソースライセンス

本プロジェクトは [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.txt) ライセンスの下で公開されています。

## お問い合わせ

🌐 [@LegspCpd](https://github.com/LegspCpd) · 📦 [openlist-next](https://github.com/LegspCpd/openlist-next) · 🐛 [Issues](https://github.com/LegspCpd/openlist-next/issues)

## 貢献者

本プロジェクトは **LegspCpd** によって開発・保守されています。

[![Contributors](https://contrib.rocks/image?repo=LegspCpd/openlist-next)](https://github.com/LegspCpd/openlist-next/graphs/contributors)

---

## 謝辞

本プロジェクトの設計と実装は以下のオープンソースプロジェクトを参考にしており、それぞれの作者およびすべての開発者の皆様に感謝いたします：

- [Alist](https://github.com/AlistGo/alist) プロジェクトの作者およびすべての開発者
- [OpenList](https://github.com/OpenListTeam/OpenList)（Go 版）プロジェクトの作者およびすべての開発者
- [OpenList-Worker](https://github.com/OpenListTeam/OpenList-Worker)（公式 TypeScript 移植版）プロジェクトの作者およびすべての開発者
- [openlistnext](https://github.com/Polonium-salts/openlistnext) コミュニティプロジェクトの作者およびすべての開発者

> 上記のプロジェクトの開発者**は**本リポジトリの貢献者ではありません。本リポジトリは LegspCpd によって独立して開発・保守されており、これらのプロジェクトおよび OpenListTeam との間に所属・認可・推奨の関係はなく、オープンソースライセンスの許す範囲内でのみその成果を参考にしています。詳細は [NOTICE.md](../NOTICE.md) を参照してください。
>
> フロントエンドの著作権は公式の [OpenList-Frontend](https://github.com/OpenListTeam/OpenList-Frontend) の開発者に帰属します。本リポジトリにはフロントエンドのソースコードは含まれていません。
