<div align="center">

# OpenList Next

<p><em>OpenList est un outil polyvalent de liste de répertoires qui permet de centraliser dans une seule interface les fichiers dispersés sur divers disques cloud, stockages d'objets et services de protocole, afin de les parcourir, les prévisualiser, les télécharger et les partager.</em></p>
<p>Ce dépôt est une variante communautaire de l'<a href="https://github.com/OpenListTeam/OpenList-Worker">OpenList-Worker</a> officiel, écrite en TypeScript, et déployable sur des plateformes edge telles que Cloudflare Workers, Tencent Cloud EdgeOne et Alibaba Cloud ESA.</p>
<p>Au-delà de la version officielle, ce projet comble le manque de « connexion directe à une base de données externe depuis n'importe quelle plateforme edge ».</p>

<a href="../LICENSE"><img src="https://img.shields.io/github/license/LegspCpd/openlist-next" alt="License" /></a>
<a href="https://github.com/LegspCpd/openlist-next/actions/workflows/edgeone-artifact-guard.yml"><img src="https://img.shields.io/github/actions/workflow/status/LegspCpd/openlist-next/edgeone-artifact-guard.yml?branch=main" alt="Build status" /></a>
<a href="https://github.com/LegspCpd/openlist-next/issues"><img src="https://img.shields.io/github/issues/LegspCpd/openlist-next" alt="Issues" /></a>
<a href="https://github.com/LegspCpd/openlist-next/discussions"><img src="https://img.shields.io/github/discussions/LegspCpd/openlist-next?color=%23ED8936" alt="Discussions" /></a>

📖 [Guide de déploiement multiplateforme](../docs/DEPLOYMENT.md) · 🗄️ [Configuration du stockage externe](../docs/EXTERNAL_STORAGE.md) · 🔌 [Connexion à une base de données en un clic](../docs/ONE_CLICK_DATABASE.md)

</div>

<div align="center">

[English](README_en.md) | [简体中文](../README.md) | [繁體中文](README_zh-TW.md) | [日本語](README_ja.md) | [한국어](README_ko.md) | Français

[Projet amont](https://github.com/OpenListTeam/OpenList-Worker) · [Guide de contribution](../CONTRIBUTING.md) · [Licence](../LICENSE) · [Déclaration d'origine et de licence](../NOTICE.md)

</div>

> [!WARNING]
> Ce projet **n'est pas** une publication officielle d'OpenList et n'entretient aucune relation d'affiliation, d'autorisation ou de parrainage avec OpenListTeam.
> En cas de problème lors de l'utilisation, veuillez ouvrir une Issue dans ce dépôt plutôt que de signaler le problème sur le dépôt officiel.
> Les explications sur l'origine du code, les droits d'auteur et la licence sont disponibles dans [NOTICE.md](../NOTICE.md).

---

## Déploiement en un clic

Cliquez sur les boutons ci-dessous pour déployer ce projet sur la plateforme correspondante :

<div align="center">

| EdgeOne · Site international | EdgeOne · Site Chine | Cloudflare Workers |
| :---: | :---: | :---: |
| [![Déployer avec EdgeOne](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?project-name=openlist-next&repository-url=https://github.com/LegspCpd/openlist-next&install-command=pnpm%20install%20--no-frozen-lockfile&build-command=pnpm%20run%20build&output-directory=dist&env=JWT_SECRET) | [![Déployer avec EdgeOne](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://console.cloud.tencent.com/edgeone/makers/new?project-name=openlist-next&repository-url=https://github.com/LegspCpd/openlist-next&install-command=pnpm%20install%20--no-frozen-lockfile&build-command=pnpm%20run%20build&output-directory=dist&env=JWT_SECRET) | [![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/LegspCpd/openlist-next) |

| Vercel | Netlify |
| :---: | :---: |
| [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/LegspCpd/openlist-next) | [![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/LegspCpd/openlist-next) |

</div>

Après le déploiement, vous devez encore configurer les variables d'environnement. Parmi elles, `JWT_SECRET` est obligatoire et peut être généré avec `openssl rand -hex 32`.

- EdgeOne : [Console internationale](https://console.edgeone.ai/makers) · [Console Chine](https://console.cloud.tencent.com/edgeone/makers)
- Cloudflare : [Tableau de bord Worker](https://dash.cloudflare.com/)
- Vercel : Paramètres du projet → Variables d'environnement
- Netlify : Site configuration → Variables d'environnement

Quelques variables courantes :

- `JWT_SECRET` : clé utilisée pour la signature de session et le chiffrement des champs, **obligatoire**
- `ADMIN_PASS` : optionnel ; s'il est défini, l'assistant d'installation est ignoré et le compte administrateur est initialisé directement avec ce mot de passe
- `DB_FORMAT` : comment les données sont organisées, `map` (par défaut) / `key` / `sql`
- `DB_DRIVER` : où les données sont stockées, `auto` (par défaut, détection automatique) / `kv` / `d1` / `blob` / `neon` / `turso` / …
- `DATABASE_URL` : chaîne de connexion à la base de données externe. Si vous la renseignez tout en gardant `DB_DRIVER=auto`, le programme s'y connectera automatiquement

> [!IMPORTANT]
> Si Cloudflare indique « 无法获取存储库内容 », effectuez d'abord un [Fork](https://github.com/LegspCpd/openlist-next/fork) de ce dépôt, puis déployez en utilisant la méthode « Connexion au dépôt GitHub ».

---

## Présentation des fonctionnalités

OpenList est un système de liste et de gestion de fichiers multi-stockage agrégé, fonctionnant sur les plateformes de calcul en edge, qui permet de unifier dans une seule interface les fichiers dispersés sur différents disques cloud, stockages d'objets et services de protocole, afin de les parcourir, les prévisualiser, les télécharger et les gérer.

OpenList-Worker est un portage TypeScript + Serverless du projet officiel [OpenListTeam/OpenList](https://github.com/OpenListTeam/OpenList), dont le back-end a été réécrit en TypeScript (à partir de Go) pour s'exécuter sur Workers, tout en conservant la même interface et la même expérience d'interaction côté front-end.

### Agrégation de stockage

**81 pilotes de stockage** intégrés, permettant de monter divers backends de stockage immédiatement :

- **Disques cloud chinois** : Alibaba Cloud Drive (plateforme ouverte/partage), Quark Cloud (plateforme ouverte/version UC TV), Baidu Netdisk (albums), 115 Cloud (plateforme ouverte/partage), 123 Cloud (plateforme ouverte/partage), Tianyi Cloud (189/PC/TV), China Mobile Cloud (139/Hecaiyun), Wo Cloud, Xunlei Cloud, Tencent Weiyun, Lanzou Cloud, PikPak (partage), Doubao Cloud, Guangya Cloud, Chaoxing Group Cloud, Lenovo NAS (partage), Teambition Cloud, WPS Cloud, Alibaba Docs, HalalCloud, MediaTrack, etc.
- **Disques cloud internationaux** : Google Drive (albums), OneDrive (application/lien de partage), Dropbox, MEGA, MediaFire, Proton Drive, Yandex Disk, Degoo, Bunny Storage, TeraBox, etc.
- **Stockage d'objets** : compatible S3 (AWS/OSS/COS/MinIO, etc.), UPYUN USS, Azure Blob, WebDAV, FTP, SFTP, SMB, IPFS, etc.
- **Hébergement de code** : GitHub, GitHub Releases, CNB Releases
- **Logiciels de cloud disque** : OpenList (partage), AList V3, Cloudreve V3/V4, Kodbox (Kedaoyun), Seafile, Teldrive, Febbox, etc.
- **Autres pilotes** : NetEase Cloud Music, Misskey, Emby, hébergement d'images Cloudflare, etc.

Outre les stockages réels ci-dessus, des pilotes virtuels/fonctionnels tels que `Local`, `Alias`, `UrlTree`, `AutoIndex`, `Strm`, `Crypt`, `Virtual`, `Chunk` sont également fournis, utilisables pour le montage local, les alias d'adresse, les listes d'URL, le stockage chiffré et le découpage (chunking).

### Capacités principales

- **Navigation de fichiers** : parcours unifié de l'arborescence des répertoires, avec prévisualisation en ligne des formats image, vidéo, audio, document, code, archive, etc.
- **Téléversement et téléchargement** : téléversement multi-stockage, téléchargement par lots, transmission en flux et redirection vers les liens directs.
- **Partage de fichiers** : génération de liens de partage avec durée de validité, mot de passe et contrôle des permissions, avec prise en charge de l'accès anonyme et du partage de répertoires.
- **Recherche en texte intégral** : recherche rapide de fichiers dans les stockages indexés.
- **Tâches hors ligne** : file d'attente de tâches en arrière-plan, prenant en charge les opérations par lots et le traitement asynchrone.
- **Interfaces externes** : expose le stockage agrégé via les protocoles compatibles WebDAV ou S3, facilitant le montage dans des outils tiers.
- **Service MCP** : fournit un point de terminaison Model Context Protocol, appelable et intégrable par des clients tels que des assistants IA.

### Gestion des permissions

- **Gestion des permissions** : contrôle d'accès basé sur les rôles (RBAC), avec prise en charge du regroupement d'utilisateurs, des droits de lecture/écriture au niveau des répertoires et des quotas.
- **Méthodes d'authentification** : compte/mot de passe intégrés, avec prise en charge de la vérification TOTP, de la connexion WebAuthn/FIDO, de l'authentification unique SSO et de l'authentification d'annuaire LDAP.
- **Renforcement de la sécurité** : sessions JWT, protection CSRF, protection contre le clickjacking (X-Frame-Options), politique de sécurité du contenu (CSP).
- **Vérification de l'état de santé** : fournit la sonde de vivacité `/health` et la sonde de préparation `/healthz`, utilisables pour la surveillance et les alertes.

### Déploiement sur plateforme

- **Plateformes d'exécution** : Cloudflare Workers, Tencent Cloud EdgeOne Makers, Alibaba Cloud ESA, Vercel, Netlify et environnement conteneur Node.js.
- **Stockage des données** : stockage intégré à la plateforme (KV / D1 / Blob …) ou toute base de données externe.
- **Déploiement en un clic** : prend en charge les boutons de déploiement en un clic pour EdgeOne, Cloudflare Workers, Vercel et Netlify.

---

## Différences avec la version officielle

| | OpenList-Worker officiel | Ce projet |
|---|---|---|
| Pilote de stockage | 7 | 15, avec l'ajout de neon / turso / pgrest / pghttp / mysqlhttp / upstash / r2 / s3 |
| Dialecte SQL | SQLite, MySQL | Ajout de PostgreSQL (avec espaces réservés `$n`) |
| Pilote de disque cloud | 78 | 81, complété avec `123_link`, `ilanzou`, `halalcloud` |
| Plateforme de déploiement | Cloudflare Workers, EdgeOne, ESA, Serverless | Ajout de Vercel, Netlify, Node/Docker |

Le pilote `mysql` de la version officielle ne peut s'exécuter que dans un conteneur Node — Cloudflare Workers n'ayant pas de TCP brut, le déploiement en edge ne peut utiliser que le KV intégré à la plateforme. Les 8 pilotes de stockage ajoutés par ce projet sont tous implémentés à partir de `fetch`, permettant ainsi de se connecter à une base de données externe même au moment de l'exécution en edge ; il suffit de renseigner une `DATABASE_URL`.

Pour plus de détails, voir [le guide de configuration du stockage externe](../docs/EXTERNAL_STORAGE.md).

---

## Déploiement manuel

### Prérequis

- Node.js **22.x**
- pnpm **9.15.4** (activé via corepack)
- Pour un déploiement sur Cloudflare Workers, un compte Cloudflare est requis

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
```

### Développement local

```bash
git clone https://github.com/LegspCpd/openlist-next.git
cd openlist-next
pnpm install

cp .dev.vars.example .dev.vars
openssl rand -hex 32        # génère JWT_SECRET, à renseigner dans le fichier ci-dessus

pnpm run dev:unified        # récupère le front-end officiel et démarre Worker
pnpm run dev:worker         # démarre uniquement Worker
```

> `pnpm run build` clone d'abord le dépôt front-end officiel OpenList-Frontend et compile `dist/`, puis compile le back-end dans `dist-server/`.
> Si vous disposez déjà des artefacts front-end en local, vous pouvez utiliser `FRONTEND_DIST=/path/to/dist pnpm run build` pour ignorer le clonage.
> Deux paquets provenant de GitHub se trouvent dans les dépendances (`@hope-ui/solid`, `mpegts.js`) ; une première installation plus lente est normale.

### Déploiement sur Cloudflare Workers

Via la ligne de commande :

```bash
npx wrangler login
openssl rand -hex 32 | npx wrangler secret put JWT_SECRET

pnpm run build
pnpm run deploy:worker
```

Vous pouvez également connecter un dépôt Git depuis le tableau de bord Cloudflare : renseignez `pnpm run build` comme commande de build, ne renseignez pas le répertoire de sortie, wrangler lira `wrangler.jsonc`.

Concernant le stockage : un binding KV est déjà déclaré par défaut dans `wrangler.jsonc` ; lors du premier déploiement, wrangler crée automatiquement `openlist-next-kv` et l'associe, puis il est réutilisé à chaque déploiement sans création manuelle. Pour passer à D1, R2 ou Durable Objects, il suffit d'activer le commentaire correspondant dans `wrangler.jsonc` ; la syntaxe exacte est indiquée dans les commentaires du fichier.

> Note : avant d'exécuter `wrangler deploy` ou `wrangler dev` en local, vous devez toujours lancer `pnpm run build`.
> Le champ `assets.directory` de `wrangler.jsonc` pointe vers `./dist`, et ce répertoire n'existe pas par défaut (il est ignoré par `.gitignore`),
> le lancer directement renvoie l'erreur `The directory specified by the "assets.directory" field ... does not exist`.
> Lors de l'utilisation du bouton de déploiement en un clic ou de la connexion à un dépôt Git depuis le tableau de bord, la plateforme construit automatiquement et n'est pas affectée.

> Ne configurez pas `DB_DRIVER` sur `mysql` — Cloudflare Workers n'ayant pas de TCP brut, ce pilote ne peut pas s'exécuter en edge.
> Pour vous connecter à un MySQL externe, utilisez `mysqlhttp` (nécessite une passerelle HTTP auto-hébergée), ou basculez sur `neon` / `turso`.

### Déploiement sur Tencent Cloud EdgeOne

Le [site international](https://edgeone.ai/) et le [site Chine](https://console.cloud.tencent.com/edgeone) sont tous deux disponibles.

Vous pouvez cliquer sur le bouton de déploiement en un clic ci-dessus, ou créer un projet dans la console et importer un dépôt Git ; renseignez `pnpm run build` comme commande de build et `dist` comme répertoire de sortie. Ces configurations figurent également dans `edgeone.json`, le fichier faisant foi.

> **Important** : `cloud-functions/[[default]].js` est un artefact de build, mais EdgeOne le lit dans le dépôt lors du déploiement ; il doit donc être commité dans le dépôt et ne pas être ajouté à `.gitignore`.
> Sans ce fichier, EdgeOne renvoie `No server-handler detected` et le projet dégrade en un site purement statique.
> Le workflow `EdgeOne Artifact Guard` du dépôt reconstruit et commit automatiquement l'artefact lorsqu'il expire ; aucune maintenance manuelle n'est généralement nécessaire.

Côté stockage, le KV et le Blob d'EdgeOne ne sont injectés qu'aux **fonctions edge**, pas aux fonctions cloud Node. Ce projet utilise donc deux points d'entrée sur EdgeOne :

| Fichier | Rôle |
|---|---|
| `api/_makers.ts` (artefact de build `cloud-functions/[[default]].js`) | Fonction cloud Node, corps du back-end |
| `functions/*` | Fonctions edge, responsables du proxy KV et de la sonde de stockage |
| `middleware.js` | Middleware edge, responsable du repli de routage du front-end |

Lorsque `DB_DRIVER` garde la valeur par défaut `auto`, le programme sélectionne automatiquement le stockage dans l'ordre suivant :

1. Base de données externe (si vous avez configuré `DATABASE_URL`)
2. **KV** : créez un espace de noms dans le « KV Storage » de la console, puis associez-le aux **fonctions edge** (et non aux fonctions cloud Node) ; renseignez `KV` comme nom de variable de binding, puis configurez `EO_KV_URLS` et `JWT_SECRET`
3. **Blob** : aucune configuration requise ; `@edgeone/pages-blob` crée automatiquement la base lors de la première écriture

Quelques pièges à surveiller (déjà traités par ce projet, à garder à l'esprit si vous modifiez la configuration vous-même) :

- Le `nodeVersion` dans `edgeone.json` doit être l'une des versions préinstallées par la plateforme (14.21.3 / 16.20.2 / 18.20.4 / 20.18.0 / 22.11.0) ; toute autre valeur provoque un échec de build
- `maxDuration` doit être placé dans `cloudFunctions.nodejs` ; écrit comme `cloudFunctions.maxDuration`, il n'a aucun effet
- Le repli de routage du front-end est géré par `middleware.js` à la racine. Les `rewrites` de `edgeone.json` ne s'appliquent qu'aux ressources statiques ; la documentation officielle indique explicitement ne pas prendre en charge le routage front-end, et ajouter `/*` risquerait de correspondre aux fichiers statiques
- N'utilisez pas de domaine temporaire tel que `*.edgeone.cool` pour vérifier le stockage ; ce domaine inclut des paramètres d'authentification à l'échelle du site qui bloquent les requêtes de proxy KV entre les fonctions edge et les fonctions cloud. Liez d'abord un domaine personnalisé avant de vérifier

Si vous ne souhaitez pas utiliser le bouton de déploiement en un clic, vous pouvez également utiliser Makers CLI :

```bash
EO_PAGES_PROJECT=openlist-next \
EO_PAGES_API_TOKEN=<Token obtenu depuis la console> \
pnpm run deploy:edgeone -- --url https://votre-domaine --deep
```

Ce script construit, déploie, puis vérifie automatiquement si le stockage est réellement disponible.

### Déploiement sur Vercel

Après avoir cliqué sur le bouton de déploiement, une liste **Marketplace Database Providers** apparaît en bas de la page de déploiement ; sélectionnez-en un et cliquez sur « Connecter ». Vercel injecte automatiquement les informations de connexion sous forme de variables d'environnement, et le `DB_DRIVER=auto` de ce projet les reconnaît et s'y connecte automatiquement, sans modifier le code.

Prise en charge : Neon, Upstash, Supabase, Turso sont utilisables directement ; Nile, Prisma Postgres, AWS RDS nécessitent une passerelle Postgres-over-HTTP ; Redis (TCP pur), MongoDB, Convex, MotherDuck ne peuvent pas être utilisés en environnement edge. Pour l'explication complète, voir [Connexion à une base de données en un clic](../docs/ONE_CLICK_DATABASE.md).

Vous pouvez également importer un dépôt Git dans la console Vercel, choisir **Other** pour la détection du framework (la configuration est dans `vercel.json`), ou utiliser la ligne de commande :

```bash
npx vercel login
npx vercel deploy --prod --yes

# Ou une seule commande pour build, déploiement et vérification du stockage
pnpm run deploy:vercel -- --url https://votre-domaine
```

La limite d'exécution unique des fonctions Vercel est de 10 secondes par défaut (60 secondes en Pro) ; avec un répertoire très volumineux, un dépassement de délai peut survenir. Il est recommandé d'utiliser `DB_FORMAT=map` pour réduire le nombre d'allers-retours avec la base de données.

### Déploiement sur Alibaba Cloud ESA

Créez un projet dans « Edge Computing → Functions et Pages » de la console ESA, puis importez le dépôt GitHub. Renseignez `pnpm run build` comme commande de build, `./dist` comme répertoire de ressources statiques et `./dist-server/esa-entry.js` comme chemin du fichier de fonction.

Vous pouvez également utiliser la ligne de commande :

```bash
pnpm install
pnpm run build

npx esa-cli login
npx esa-cli commit
npx esa-cli deploy

# Ou une seule commande pour build, commit, déploiement et vérification du stockage
pnpm run deploy:esa -- --url https://votre-domaine
```

Deux configurations essentielles figurent dans `esa.jsonc` :

- `entry` pointe vers `./dist-server/esa-entry.js`. Les artefacts serveur sont volontairement placés dans `dist-server/` plutôt que `dist/`, sinon ils seraient téléchargeables publiquement en tant que fichiers statiques
- `assets.notFoundStrategy` est défini sur `singlePageApplication`. Sans cette configuration, les routes front-end telles que `/login`, `/@manage/*` renverraient directement une erreur 404

ESA limite le nombre de sous-requêtes KV par requête ; si vous tenez à utiliser l'EdgeKV intégré à la plateforme, il est recommandé d'utiliser `DB_FORMAT=map` (une seule clé pour toute la base, une lecture et une écriture chacune).

### Déploiement sur Netlify

Il suffit de connecter un dépôt Git dans Netlify ; la configuration de build est déjà renseignée dans `netlify.toml` ; vous pouvez également utiliser la ligne de commande `netlify deploy --build --prod`.

Netlify n'ayant pas de stockage au niveau de la plateforme, vous devez vous connecter à une base de données externe. Les variables d'environnement se configurent dans **Site configuration → Environment variables**, par exemple :

```bash
JWT_SECRET=<chaîne aléatoire>
DATABASE_URL=postgres://user:pass@ep-xxx.neon.tech/neondb
DB_FORMAT=map
```

> La limite d'exécution unique de Netlify Functions est de 10 secondes (26 secondes en Pro) ; le démarrage à froid combiné aux allers-retours de l'API du disque cloud provoque facilement un dépassement de délai. Pour la production, il est recommandé de privilégier Cloudflare Workers.

### Déploiement sur Node / Docker

C'est le seul cas permettant de se connecter directement en TCP avec `DB_DRIVER=mysql`.

```bash
pnpm install
pnpm run build
pnpm start
```

Les variables d'environnement sont écrites dans `.env` à la racine (lu par `loadEnv.js`) :

```bash
JWT_SECRET=<chaîne aléatoire>
DATABASE_URL=mysql://user:pass@127.0.0.1:3306/openlist
DB_DRIVER=mysql
DB_FORMAT=sql
```

---

## Vérifications après déploiement

La réussite du déploiement et la disponibilité du stockage sont deux choses distinctes. Le pire des cas est un pilote de stockage qui retombe silencieusement en mode mémoire : le site s'ouvre, on peut se connecter, mais les données disparaissent après un redémarrage.

```bash
curl https://votre-domaine/api/public/env_check
```

Dans la réponse, portez une attention particulière aux champs suivants :

- `storage.driver` : le pilote réellement actif. S'il vaut `memory`, les données ne sont pas persistées et vous devez y remédier
- `jwt.ready` : indique si `JWT_SECRET` est configuré. S'il ne l'est pas, les champs chiffrés comme les identifiants de montage ne peuvent pas être déchiffrés
- `ready` : indique si l'ensemble est prêt

Vous pouvez également demander au script unifié de vérifier pour vous (vérification uniquement, sans redéploiement) :

```bash
pnpm run deploy:edgeone -- --no-deploy --url https://votre-domaine
pnpm run deploy:esa     -- --no-deploy --url https://votre-domaine
pnpm run deploy:vercel  -- --no-deploy --url https://votre-domaine
```

Le code de sortie `0` signifie que le stockage est prêt, `2` qu'il ne l'est pas encore. Sur EdgeOne, une lecture supplémentaire de `/storage-probe` indique si KV et Blob sont respectivement utilisables.

---

## Architecture technique

### Back-end

- **Environnement d'exécution** : Cloudflare Workers / Tencent Cloud EdgeOne / Alibaba Cloud ESA / Vercel / Netlify / conteneur Node.js
- **Framework Web** : Hono.js
- **Langage** : TypeScript
- **Outils de build** : Wrangler, esbuild

### Front-end

- **Framework** : React 19 + TypeScript
- **Bibliothèque UI** : Ant Design / Material-UI
- **Outils de build** : Vite

> Le front-end ne se trouve pas dans ce dépôt ; il est récupéré depuis le dépôt officiel par `scripts/fetch-frontend.mjs` au moment du build.

---

## Configuration

### Stockage des données

Deux variables déterminent où les données sont stockées et comment elles sont organisées.

**`DB_DRIVER`** — où les données sont stockées

- `auto` (défaut) : détection automatique. Utilise la base de données externe si configurée, sinon le stockage intégré à la plateforme
- Stockage de plateforme : `kv`, `d1`, `r2`, `blob`, `cfkv`, `do`
- Base de données externe : `neon`, `turso`, `pgrest`, `pghttp`, `mysqlhttp`, `upstash`, `s3`
- `mysql` : uniquement disponible dans un conteneur Node

**`DB_FORMAT`** — comment les données sont organisées

- `map` (défaut) : toute la base de données stockée en un seul JSON, une lecture et une écriture chacune, adapté au KV et au stockage d'objets
- `key` : un enregistrement par entité, par exemple `users_1` ; plus économique que `map` lorsqu'il y a beaucoup d'entités
- `sql` : stockage dans des tables relationnelles, dont la structure est identique à la version Go d'OpenList, permettant de partager la même base avec la version Go

Quelques combinaisons courantes :

```bash
# Cloudflare Workers + D1
DB_FORMAT=sql
DB_DRIVER=d1

# EdgeOne + Blob (zéro configuration)
DB_FORMAT=map
DB_DRIVER=blob

# Base de données externe, par exemple Neon
DB_FORMAT=map
DB_DRIVER=auto
DATABASE_URL=postgres://user:pass@ep-xxx.neon.tech/neondb
```

### Sécurité

- `JWT_SECRET` : obligatoire. Utilisé pour la signature de session, le chiffrement des identifiants de montage, ainsi que l'authentification des tâches planifiées
- `ADMIN_PASS` : optionnel. S'il est défini, l'assistant d'installation est ignoré et le compte administrateur est initialisé directement avec ce mot de passe

### Base de données externe

Renseignez une seule chaîne de connexion en gardant `DB_DRIVER=auto` ; le programme sélectionne automatiquement le pilote en fonction du protocole et du nom d'hôte :

| Chaîne de connexion | Pilote utilisé |
|---|---|
| `postgres://…@ep-xxx.neon.tech/…` | `neon` |
| `postgresql://…@db.xxx.supabase.co/…` | `pgrest`, nécessite de renseigner en plus `SUPABASE_KEY` |
| `libsql://xxx.turso.io` | `turso`, nécessite de renseigner en plus `TURSO_AUTH_TOKEN` |
| `redis://xxx.upstash.io` | `upstash` |
| `mysql://…` | `mysqlhttp`, nécessite de renseigner en plus `MYSQL_HTTP_URL` |

Les variables spécifiques aux fournisseurs (`NEON_DATABASE_URL`, `TURSO_DATABASE_URL`, etc.) ont la priorité sur `DATABASE_URL`.

La liste complète des pilotes et des exemples de configuration pour chaque base de données sont disponibles dans [le guide de configuration du stockage externe](../docs/EXTERNAL_STORAGE.md), et un modèle de variables dans [`.dev.vars.example`](../.dev.vars.example).

### Autres variables

- `ALLOW_URLS` : liste blanche multi-origines, séparée par des virgules. Si non renseignée, seules les requêtes de même origine sont autorisées
- `MAX_UPLOAD` : taille maximale par téléversement, 26 214 400 octets (25 Mo) par défaut
- `MAX_UPPART` : taille maximale d'une seule tranche en téléversement par fragments, 16 777 216 octets (16 Mo) par défaut
- `ALLOW_SEED` : liste blanche des hôtes autorisés comme source de données initiales

---

## Questions fréquentes

| Symptôme | Cause et solution |
|---|---|
| Affichage de `No storage backend is available` | Aucun binding de stockage n'est configuré. Renseignez `DATABASE_URL`, ou associez KV / D1 sur la plateforme |
| Réinitialisation nécessaire à chaque redémarrage | Les données ne sont pas persistées. Vérifiez si `storage.driver` renvoyé par `/api/public/env_check` vaut `memory` |
| Page 404 mais API fonctionnelle | Les ressources statiques n'ont pas été téléversées. Vérifiez que le build a produit `dist/` et que le répertoire de ressources statiques de la plateforme pointe dessus |
| Déploiement sur deux plateformes, données incohérentes | Les `JWT_SECRET` des deux côtés diffèrent, empêchant le déchiffrement des champs chiffrés. Gardez-les identiques des deux côtés |
| Erreur `mysql2 is not available` | Utilisation de `DB_DRIVER=mysql` en environnement edge ; ce pilote n'est disponible que dans un conteneur Node. Basculez sur `mysqlhttp` |
| Supabase renvoie 404 | La table `kv` n'existe pas ; exécutez d'abord `CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);` |

---

## Commandes courantes

```bash
pnpm run dev:worker     # Démarre le serveur de développement Worker
pnpm run dev:unified    # Récupère le front-end et démarre Worker
pnpm run build          # Build du front-end et du back-end
pnpm run lint           # Vérification de types TypeScript
pnpm run test:all       # Exécute tous les tests unitaires
pnpm run format         # Formate le code avec prettier
```

---

## Aide et support

Si vous rencontrez des problèmes lors de l'utilisation, vous pouvez obtenir de l'aide via les canaux suivants :

- 🐛 **Soumettre un bug ou une demande de fonctionnalité** : rendez-vous dans les [_Issues_](https://github.com/LegspCpd/openlist-next/issues) de ce dépôt
- 💬 **Questions générales et discussions** : rendez-vous dans la section [_Discussions_](https://github.com/LegspCpd/openlist-next/discussions) de ce dépôt

## Licence open source

Ce projet est publié sous la licence [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.txt).

## Nous contacter

🌐 [@LegspCpd](https://github.com/LegspCpd) · 📦 [openlist-next](https://github.com/LegspCpd/openlist-next) · 🐛 [Issues](https://github.com/LegspCpd/openlist-next/issues)

## Contributeurs

Ce projet est développé et maintenu par **LegspCpd**.

[![Contributors](https://contrib.rocks/image?repo=LegspCpd/openlist-next)](https://github.com/LegspCpd/openlist-next/graphs/contributors)

---

## Remerciements

La conception et l'implémentation de ce projet s'inspirent des projets open source suivants ; merci à leurs auteurs et à l'ensemble des développeurs :

- [Alist](https://github.com/AlistGo/alist) — auteurs du projet et l'ensemble des développeurs
- [OpenList](https://github.com/OpenListTeam/OpenList) (version Go) — auteurs du projet et l'ensemble des développeurs
- [OpenList-Worker](https://github.com/OpenListTeam/OpenList-Worker) (portage officiel TypeScript) — auteurs du projet et l'ensemble des développeurs
- [openlistnext](https://github.com/Polonium-salts/openlistnext) — auteurs du projet communautaire et l'ensemble des développeurs

> Les développeurs de ces projets **ne sont pas** des contributeurs de ce dépôt. Ce dépôt est développé et maintenu indépendamment par LegspCpd, sans relation d'affiliation, d'autorisation ou de parrainage avec ces projets ni avec OpenListTeam, et ne s'en inspire que dans la limite autorisée par la licence open source. Voir [NOTICE.md](../NOTICE.md) pour plus de détails.
>
> Les droits d'auteur du front-end appartiennent aux développeurs officiels de [OpenList-Frontend](https://github.com/OpenListTeam/OpenList-Frontend) ; ce dépôt ne contient pas le code source du front-end.
