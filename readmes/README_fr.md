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

## Introduction

OpenList Next rassemble dans une seule interface les fichiers dispersés entre plusieurs cloud drives, stockages objet et services à protocole, pour les parcourir, les prévisualiser, les télécharger, les partager et les gérer.

Il dérive de la version officielle [OpenList-Worker](https://github.com/OpenListTeam/OpenList-Worker) et y ajoute une chose : se connecter à une base de données externe depuis n'importe quelle plateforme edge. Voir le tableau comparatif dans la [Présentation des fonctionnalités](#présentation-des-fonctionnalités).

Lisez dans l'ordre, ou allez directement à ce qui vous intéresse :

- [Déploiement en un clic](#déploiement-en-un-clic) — déployer sur EdgeOne, Cloudflare Workers, Vercel ou Netlify en un clic
- [Présentation des fonctionnalités](#présentation-des-fonctionnalités) — quels cloud drives sont pris en charge, ce que le projet sait faire, et ses différences avec la version officielle
- [Variables d'environnement](#variables-denvironnement) — ce que fait chaque variable, si elle est nécessaire, et quoi y mettre
- [Déploiement manuel](#déploiement-manuel) — le lancer en local, ou déployer en ligne de commande
- [Vérifications après déploiement](#vérifications-après-déploiement) — confirmer que le stockage est réellement connecté, et non retombé silencieusement en mémoire
- [Architecture technique](#architecture-technique) — les frameworks et outils de build utilisés
- [Questions fréquentes](#questions-fréquentes) — causes et solutions des erreurs courantes

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

Après le déploiement, il reste à configurer les variables d'environnement ; `JWT_SECRET` est obligatoire (`openssl rand -hex 32`). Voir [Variables d'environnement](#variables-denvironnement) pour la signification et l'emplacement de chacune.

- EdgeOne : [Console internationale](https://console.edgeone.ai/makers) · [Console Chine](https://console.cloud.tencent.com/edgeone/makers)
- Cloudflare : [Tableau de bord Worker](https://dash.cloudflare.com/)
- Vercel : Paramètres du projet → Variables d'environnement
- Netlify : Site configuration → Variables d'environnement

> [!IMPORTANT]
> Si Cloudflare indique « Impossible de récupérer le contenu du dépôt », effectuez d'abord un [Fork](https://github.com/LegspCpd/openlist-next/fork) de ce dépôt, puis déployez en utilisant la méthode « Connexion au dépôt GitHub ».

---

## Présentation des fonctionnalités

Ces capacités proviennent de la version officielle [OpenList-Worker](https://github.com/OpenListTeam/OpenList-Worker), portage TypeScript + Serverless de [OpenListTeam/OpenList](https://github.com/OpenListTeam/OpenList). L'interface et les interactions sont identiques des deux côtés ; les différences se limitent au stockage et au déploiement.

### Agrégation de stockage

**80 pilotes de stockage** intégrés, permettant de monter divers backends de stockage immédiatement :

- **Disques cloud chinois** : Alibaba Cloud Drive (plateforme ouverte/partage), Quark Cloud (plateforme ouverte/version UC TV), Baidu Netdisk (albums), 115 Cloud (plateforme ouverte/partage), 123 Cloud (plateforme ouverte/partage), Tianyi Cloud (189/PC/TV), China Mobile Cloud (139/Hecaiyun), Wo Cloud, Xunlei Cloud, Tencent Weiyun, Lanzou Cloud, PikPak (partage), Doubao Cloud, Guangya Cloud, Chaoxing Group Cloud, Lenovo NAS (partage), Teambition Cloud, WPS Cloud, Alibaba Docs, HalalCloud, MediaTrack, etc.
- **Disques cloud internationaux** : Google Drive (albums), OneDrive (application/lien de partage), Dropbox, MEGA, MediaFire, Proton Drive, Yandex Disk, Degoo, Bunny Storage, TeraBox, etc.
- **Stockage d'objets** : compatible S3 (AWS/OSS/COS/MinIO, etc.), UPYUN USS, Azure Blob, WebDAV, IPFS, etc.
- **Hébergement de code** : GitHub, GitHub Releases, CNB Releases
- **Logiciels de cloud disque** : OpenList (partage), AList V3, Cloudreve V3/V4, Kodbox (Kedaoyun), Seafile, Teldrive, Febbox, etc.
- **Autres pilotes** : NetEase Cloud Music, Misskey, Emby, hébergement d'images Cloudflare, etc.

Outre les stockages réels ci-dessus, des pilotes virtuels/fonctionnels tels que `Alias`, `UrlTree`, `AutoIndex`, `Strm`, `Crypt`, `Virtual`, `Chunk` sont également fournis, utilisables pour les alias d'adresse, les listes d'URL, le stockage chiffré et le découpage (chunking).

### Capacités principales

- **Navigation de fichiers** : parcours unifié de l'arborescence des répertoires, avec prévisualisation en ligne des formats image, vidéo, audio, document, code, archive, etc.
- **Téléversement et téléchargement** : téléversement multi-stockage, téléchargement par lots, transmission en flux et redirection vers les liens directs.
- **Partage de fichiers** : génération de liens de partage avec durée de validité, mot de passe et contrôle des permissions, avec prise en charge de l'accès anonyme et du partage de répertoires.
- **Recherche en texte intégral** : recherche rapide de fichiers dans les stockages indexés.
- **Téléchargement hors ligne (limité)** : `/api/fs/seed/offline_download` analyse les données seed (torrent, lien direct, CAS) et les écrit de façon synchrone dans le stockage cible ; il faut au préalable la liste blanche `ALLOW_SEED` et la permission `OFFLINE_DOWNLOAD`. Il n'y a pas de file d'attente de tâches en arrière-plan : `/fs/add_offline_download` ainsi que les opérations de relance / annulation des tâches ne sont pas implémentées (elles renvoient 501).
- **Interfaces externes** : expose le stockage agrégé via les protocoles compatibles WebDAV ou S3, facilitant le montage dans des outils tiers.
- **Service MCP** : fournit un point de terminaison Model Context Protocol, appelable et intégrable par des clients tels que des assistants IA.

### Gestion des permissions

- **Gestion des permissions** : trois rôles (administrateur / utilisateur standard / invité), avec des droits de lecture/écriture par répertoire (les champs `read_users` / `write_users` des métadonnées, sous-répertoires inclus en option).
- **Méthodes d'authentification** : compte/mot de passe intégrés, avec prise en charge de la vérification TOTP, de la connexion WebAuthn (clés d'accès — désactivée par défaut, à activer dans les réglages), de l'authentification unique SSO et de l'authentification d'annuaire LDAP.
- **Renforcement de la sécurité** : sessions JWT, politique CORS de même origine (aucun Origin arbitraire n'est renvoyé sauf s'il figure dans `ALLOW_URLS`), protection contre le clickjacking (`X-Frame-Options: DENY`), politique de sécurité du contenu (CSP) et HSTS.
- **Vérification de l'état de santé** : `/api/healthz` est la sonde de préparation — elle lit réellement le stockage une fois et renvoie 503 s'il est indisponible, c'est donc elle qu'il faut brancher à la supervision. `/api/health` n'est qu'un marqueur de vivacité et ne reflète pas l'état du stockage.

### Déploiement sur plateforme

- **Plateformes d'exécution** : Cloudflare Workers, Tencent Cloud EdgeOne Makers, Alibaba Cloud ESA, Vercel, Netlify et environnement conteneur Node.js.
- **Stockage des données** : stockage intégré à la plateforme (KV / D1 / Blob …) ou toute base de données externe.
- **Déploiement en un clic** : prend en charge les boutons de déploiement en un clic pour EdgeOne, Cloudflare Workers, Vercel et Netlify.

### Différences avec la version officielle

| | OpenList-Worker officiel | Ce projet |
|---|---|---|
| Pilote de stockage | 6 | 16, avec 10 ajouts (`neon`, `turso`, `pgrest`, `pghttp`, `mysqlhttp`, `upstash`, `s3`, `r2`, `netlifyblobs`, `hyperdrive`) |
| Dialecte SQL | SQLite, MySQL | Ajout de PostgreSQL (avec espaces réservés `$n`) |
| Pilote de disque cloud | 78 | 80, complété avec `123_link`, `ilanzou`, `halalcloud` ; `Local` supprimé (il n'a de sens que sur un système de fichiers local) |
| Plateforme de déploiement | Cloudflare Workers, EdgeOne, ESA, Vercel, Serverless, Node/Docker | ajout de Netlify, et scripts de déploiement en une commande pour EdgeOne / ESA / Vercel |

Sur les 10 pilotes ajoutés par ce projet, 8 passent par HTTP (`neon` `turso` `pgrest` `pghttp` `mysqlhttp` `upstash` `s3` `netlifyblobs`) et peuvent donc joindre une base externe même en périphérie : une `DATABASE_URL` suffit. Les deux autres diffèrent — `r2` utilise un binding de bucket Cloudflare et `hyperdrive` se connecte en TCP brut via `mysql2`, donc uniquement sur Node. Le pilote `mysql` officiel est lui aussi réservé au conteneur Node, faute de TCP brut.

Pour plus de détails, voir [le guide de configuration du stockage externe](../docs/EXTERNAL_STORAGE.md).

---

## Variables d'environnement

Où les renseigner : Cloudflare dans Settings → Variables and Secrets, EdgeOne dans les variables d'environnement du projet, Vercel / Netlify dans les paramètres du projet, Node / Docker dans le fichier `.env` à la racine.

### Liste des variables

| Nom de variable | Obligatoire ? | Description |
|---|---|---|
| `JWT_SECRET` | **Obligatoire** | Signature des sessions, chiffrement des identifiants, authentification des tâches planifiées. À générer avec `openssl rand -hex 32` |
| `ADMIN_PASS` | Optionnel | S'il est défini, l'assistant d'installation est ignoré et le compte administrateur est créé avec ce mot de passe |
| `DB_DRIVER` | Optionnel, `auto` | Où sont stockées les données. `auto` essaie d'abord la base externe, puis le stockage intégré à la plateforme. Valeurs : `kv` `d1` `r2` `blob` `cfkv` `do` `neon` `turso` `pgrest` `pghttp` `mysqlhttp` `upstash` `s3` `hyperdrive` `netlifyblobs` `mysql` (Node uniquement) |
| `DB_FORMAT` | Optionnel, `map` | `map` stocke tout en un seul JSON — le moins de requêtes ; `key` stocke un enregistrement par entité, plus léger que `map` quand il y en a beaucoup ; `sql` utilise des tables relationnelles et peut partager une base avec la version Go d'OpenList |
| `DATABASE_URL` | Avec une base externe | Chaîne de connexion générique ; le fournisseur est déduit du protocole et du nom d'hôte. En général celle-ci suffit |
| `SUPABASE_KEY` | Avec Supabase | Clé de lecture/écriture Supabase |
| `TURSO_AUTH_TOKEN` | Avec Turso | Jeton d'accès Turso |
| `MYSQL_HTTP_URL` | Avec MySQL en périphérie | Passerelle de transfert HTTP pour MySQL / MariaDB — le seul moyen d'atteindre MySQL depuis une plateforme edge |
| `PG_HTTP_URL` | Avec votre propre passerelle | Adresse de votre passerelle HTTP Postgres auto-hébergée |
| `MYSQL_URLS` | Connexion directe à MySQL depuis Node | Chaîne de connexion MySQL directe, Node / Docker uniquement |
| `ALLOW_URLS` | Front-end et back-end sur des domaines différents | Liste blanche CORS séparée par des virgules ; même origine uniquement si vide |
| `ASSET_URLS` | Avec un CDN | Sert les ressources statiques du front-end depuis un CDN ; `$version` est remplacé par la version courante du front-end |
| `MAX_UPLOAD` | Optionnel | Taille maximale d'un téléversement complet, en octets. 26 214 400 (25 Mo) par défaut |
| `MAX_UPPART` | Optionnel | Taille maximale d'une tranche, en octets. 16 777 216 (16 Mo) par défaut |
| `ALLOW_SEED` | Avec la fonction de seed | Liste blanche des sites autorisés comme source de données initiales |
| `EO_KV_URLS` | Généralement vide | Propre à EdgeOne. La fonction cloud Node ne reçoit pas la liaison KV et passe par les fonctions edge ; renseignez **l'origine de ce déploiement**, par ex. `https://openlist.example.com`. Vide, le domaine consulté est utilisé — à renseigner seulement s'il diffère du domaine de déploiement, ou en débogage local |

> Changer `JWT_SECRET` rend indéchiffrables les mots de passe et identifiants de cloud déjà stockés. Si plusieurs plateformes partagent la même base, la valeur doit être identique partout.

Pour la chaîne de connexion de chaque fournisseur et les alias de variables pris en charge, voir [le guide de configuration du stockage externe](../docs/EXTERNAL_STORAGE.md).

### Liaisons de plateforme (à lier, rien à saisir)

La plateforme les injecte au déploiement. Créez la ressource, puis nommez la liaison comme ci-dessous.

| Nom de variable | Usage |
|---|---|
| `DB` | Liaison de base Cloudflare D1, avec `DB_DRIVER=d1` |
| `KV` | Liaison d'espace de noms Cloudflare KV / EdgeOne KV, avec `DB_DRIVER=kv` |
| `BUCKET` | Liaison de bucket Cloudflare R2, avec `DB_DRIVER=r2` (accepte aussi `R2_BUCKET` / `OPENLIST_BUCKET` / `OPENLIST_R2`) |
| `HYPERDRIVE` | Chaîne de connexion Cloudflare Hyperdrive, pour atteindre MySQL depuis la périphérie, avec `DB_DRIVER=hyperdrive` |
| `S3_BUCKET` `S3_REGION` `S3_ENDPOINT` `S3_ACCESS_KEY_ID` `S3_SECRET_ACCESS_KEY` | Nom de bucket et identifiants pour un stockage compatible S3 (R2 / MinIO / B2, etc.), avec `DB_DRIVER=s3` |
| `CF_ACCOUNT` `CF_KV_UUID` `CF_API_KEY` | Lecture/écriture du KV via l'API REST Cloudflare, avec `DB_DRIVER=cfkv` (ID de compte, ID d'espace de noms, jeton avec droit de lecture/écriture KV) |

### Ligne de commande uniquement

| Nom de variable | Usage |
|---|---|
| `EO_PAGES_PROJECT` | Projet vers lequel la CLI EdgeOne Makers déploie |
| `EO_PAGES_API_TOKEN` | Jeton d'API de la console EdgeOne Makers, pour la CLI |
| `EO_PAGES_URL` | Domaine après déploiement, utilisé par `pnpm run deploy:edgeone` pour la vérification |

Le modèle de variables est dans [`.dev.vars.example`](../.dev.vars.example).

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

Côté stockage, les API Web du KV et du Blob d'EdgeOne ne sont disponibles que pour les **fonctions edge**, pas pour les fonctions cloud Node. À noter : côté Node, un objet nommé `KV` est bien visible, mais il s'agit d'un client Redis/RESP et non de l'API Web KV — l'application l'ignore volontairement, ne l'utilisez donc pas comme KV. Ce projet utilise donc deux points d'entrée sur EdgeOne :

| Fichier | Rôle |
|---|---|
| `api/_makers.ts` (artefact de build `cloud-functions/[[default]].js`) | Fonction cloud Node, corps du back-end |
| `functions/*` | Fonctions edge, responsables du proxy KV et de la sonde de stockage |
| `middleware.js` | Middleware edge, responsable du repli de routage du front-end |

Lorsque `DB_DRIVER` garde la valeur par défaut `auto`, le programme sélectionne automatiquement le stockage dans l'ordre suivant :

1. Base de données externe (si vous avez configuré `DATABASE_URL`)
2. **KV** : créez un espace de noms dans le « KV Storage » de la console, puis associez-le aux **fonctions edge** (et non aux fonctions cloud Node) ; renseignez `KV` comme nom de variable de binding, puis définissez `JWT_SECRET` (`EO_KV_URLS` reste généralement vide — une valeur vide fait utiliser automatiquement le domaine que vous consultez)
3. **Blob** : aucune configuration requise ; `@edgeone/pages-blob` crée automatiquement la base lors de la première écriture

Quelques pièges à surveiller (déjà traités par ce projet, à garder à l'esprit si vous modifiez la configuration vous-même) :

- Le `nodeVersion` de `edgeone.json` doit être l'une des versions préinstallées par la plateforme. La documentation officielle n'en liste que cinq : 14.21.3 / 16.20.2 / 18.20.4 / 20.18.0 / 22.11.0 ; toute autre valeur peut faire échouer le build. Ce projet utilise `22.11.0` : lors de la récupération du front-end, `scripts/fetch-frontend.mjs` constate que le pnpm 11 épinglé en amont exige Node >= 22.13 et bascule automatiquement sur pnpm 10. Ce champ écrase les réglages du projet dans la console
- `maxDuration` doit être placé dans `cloudFunctions.nodejs` ; écrit comme `cloudFunctions.maxDuration`, il n'a aucun effet
- Le repli de routage du front-end est géré par `middleware.js` à la racine, donc `edgeone.json` ne définit aucun `rewrites`. Makers accepte désormais aussi `{"source": "/*", "destination": "/index.html"}` comme fallback SPA (il est reconnu comme tel, et non comme une réécriture ordinaire), mais avoir le même repli à deux endroits invite aux conflits : ce projet ne garde que celui de `middleware.js`
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

Un déploiement réussi ne garantit pas un stockage utilisable — le pilote peut retomber silencieusement en mode mémoire : le site s'ouvre et la connexion fonctionne, mais tout est perdu au redémarrage.

```bash
curl https://votre-domaine/api/public/env_check
```

Dans la réponse, portez une attention particulière aux champs suivants :

- `data.storage.memory` : `true` signifie que le stockage en mémoire a pris le relais et que les données sont perdues au redémarrage — à corriger impérativement (dans ce cas `data.config.resolved_driver` vaut `memory`)
- `data.jwt.ready` : indique si `JWT_SECRET` est configuré. S'il ne l'est pas, les champs chiffrés comme les identifiants de montage ne peuvent pas être déchiffrés
- `data.ready` : indique si l'ensemble est prêt
- `data.issues` : la liste des problèmes, chaque entrée portant un `code` (tel que `STORAGE_MEMORY_ONLY` ou `JWT_SECRET_MISSING`) — l'endroit le plus rapide pour commencer le diagnostic

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

- **Framework** : SolidJS + TypeScript
- **Bibliothèque UI** : Hope UI
- **Outils de build** : Vite

> Le front-end ne se trouve pas dans ce dépôt ; il est récupéré depuis le dépôt officiel par `scripts/fetch-frontend.mjs` au moment du build.

---

## Questions fréquentes

| Symptôme | Cause et solution |
|---|---|
| Affichage de `No storage backend is available` | Aucun stockage n'est configuré. Renseignez `DATABASE_URL`, ou associez KV / D1 / Blob sur la plateforme. Le champ `data.issues` de `/api/public/env_check` indique lequel manque |
| Réinitialisation nécessaire à chaque redémarrage | Les données ne sont pas persistées et le stockage en mémoire a pris le relais. Vérifiez `/api/public/env_check` : `data.storage.memory` vaut `true` (ou `data.issues` contient `STORAGE_MEMORY_ONLY`) |
| Page 404 mais API fonctionnelle | Les ressources statiques n'ont pas été téléversées. Vérifiez que le build a produit `dist/` et que le répertoire de ressources statiques de la plateforme pointe dessus |
| Connexion impossible ou montages disque en échec après un changement de `JWT_SECRET` | Les mots de passe, les identifiants de disque réseau et les secrets OTP sont chiffrés avec `JWT_SECRET` avant d'être enregistrés ; une nouvelle clé ne peut donc pas les déchiffrer (le journal affiche `Failed to decrypt a sealed secret (wrong JWT_SECRET?)`). Rétablissez l'ancienne valeur, ou saisissez à nouveau le mot de passe et les identifiants |
| Données incohérentes lorsque deux plateformes partagent un même stockage | Les `JWT_SECRET` des deux côtés diffèrent, empêchant le déchiffrement des champs chiffrés. Deux plateformes partageant un même stockage doivent utiliser la même valeur ; ce n'est pas nécessaire si les stockages sont distincts |
| KV renvoie 401 sur EdgeOne | Le `JWT_SECRET` diffère entre la fonction cloud Node et l'Edge Function (ou a été renouvelé). Utilisez la même valeur des deux côtés, ou pointez `EO_KV_URLS` vers l'origine de déploiement correcte |
| Les logs affichent `Error reading config from kv: Not connected` et tous les `/api/*` renvoient 503 | La fonction cloud Node reçoit l'espace de noms KV comme un **client Redis/RESP** (l'API Web KV n'est disponible que pour les fonctions edge). L'application l'ignore et se rabat sur Blob — c'est le comportement attendu. Pour vraiment utiliser le KV depuis Node, liez l'espace de noms aux fonctions edge et définissez `DB_DRIVER=kv` + `JWT_SECRET` |
| L'initialisation échoue par intermittence avec 400 `system has already been initialized`, puis réussit au nouvel essai | Faux « déjà initialisé » : quand le stockage est injoignable, l'application se rabat sur la mémoire ; la première initialisation n'écrit qu'en mémoire et un nouvel essai sur la même instance trouve un administrateur existant et renvoie 400. Réparez le stockage et cela disparaît |
| Erreur `Storage driver "mysql" is not available in this runtime` | `DB_DRIVER=mysql` est défini en environnement edge, or ce pilote ne fonctionne que dans un conteneur Node. Basculez sur `mysqlhttp` |
| Supabase renvoie 404 | La table `kv` n'existe pas ; créez-la d'abord : `CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);`. À noter : Supabase passe par PostgREST, qui ne prend en charge que le KV — `DB_FORMAT=sql` n'est pas disponible |
| Un clic sur « téléchargement hors ligne » renvoie `capability unavailable` | Ce runtime n'a pas d'adaptateur de téléchargement hors ligne persistant : `/fs/add_offline_download` renvoie 501. Utilisez plutôt `/api/fs/seed/offline_download` (configurez d'abord la liste blanche `ALLOW_SEED`) ; les relances / annulations de la liste des tâches renvoient aussi 501 |

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

- 🐛 **Bug ou demande de fonctionnalité** : [_Issues_](https://github.com/LegspCpd/openlist-next/issues)
- 💬 **Questions et discussions** : [_Discussions_](https://github.com/LegspCpd/openlist-next/discussions)

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
