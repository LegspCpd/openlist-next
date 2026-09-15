#!/usr/bin/env node
/**
 * 三平台部署 + 部署后存储自动探测（EdgeOne / ESA / Vercel）
 *
 * 为什么需要这个脚本
 * ------------------
 * 这三个平台的「存储能不能用」都不是代码能决定的：
 *   - EdgeOne：KV 必须在控制台创建命名空间并绑定到**边缘函数**（Node 云函数拿不到），
 *              Blob 则零配置（`@edgeone/pages-blob` 首次写入自动建库）；
 *   - ESA：EdgeKV 需要绑定，Blob 走 ESA_BLOB binding；
 *   - Vercel：没有平台级存储，必须接外部数据库（Marketplace 一键接库会注入环境变量）。
 * 部署成功 ≠ 存储可用。本脚本在部署后自动跑一遍探测，直接告诉你
 * 「现在实际用的是哪个驱动、KV/Blob 是否可用、下一步该做什么」，
 * 避免「站点能打开但一重启数据就没了」这类最难排查的问题。
 *
 * 用法
 * ----
 *   node scripts/deploy-platform.mjs edgeone
 *   node scripts/deploy-platform.mjs esa
 *   node scripts/deploy-platform.mjs vercel
 *
 * 常用参数
 *   --url <https://...>   部署后要探测的地址（也可用平台环境变量，
 *                         如 EO_PAGES_URL / VERCEL_URL）
 *   --skip-build          跳过构建（复用已有产物）
 *   --no-deploy           不执行部署，只做探测
 *   --deep                EdgeOne：额外做一次 KV 写/读/删往返（需 JWT_SECRET）
 *
 * 说明：平台 CLI 未安装/未登录时不会报错中断，而是打印精确的手工命令，
 * 并继续执行探测（只要你给了 --url）。
 */
import { execSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

/* ────────────────────────────── 参数解析 ────────────────────────────── */

const argv = process.argv.slice(2)

function opt(name) {
  const i = argv.indexOf(name)
  if (i === -1) return null
  return argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : ""
}

function has(name) {
  return argv.includes(name)
}

const platform = argv.find((a) => !a.startsWith("-"))
const skipBuild = has("--skip-build")
const noDeploy = has("--no-deploy")
const deep = has("--deep")

const PLATFORM_HELP = `用法: node scripts/deploy-platform.mjs <edgeone|esa|vercel> [选项]

选项:
  --url <https://...>   部署后探测地址
  --skip-build          跳过构建
  --no-deploy           只探测，不部署
  --deep                EdgeOne 深度探测（KV 写/读/删，需 JWT_SECRET）
`

if (!platform || has("--help") || has("-h")) {
  console.log(PLATFORM_HELP)
  process.exit(0)
}

if (!["edgeone", "esa", "vercel"].includes(platform)) {
  console.error(`未知平台: ${platform}\n\n${PLATFORM_HELP}`)
  process.exit(1)
}

/* ────────────────────────────── 工具函数 ────────────────────────────── */

function run(cmd, { silent = false } = {}) {
  console.log(`\n$ ${cmd}`)
  try {
    return execSync(cmd, {
      cwd: ROOT,
      stdio: silent ? "pipe" : "inherit",
      encoding: "utf8",
      env: { ...process.env },
    })
  } catch (e) {
    return { failed: true, stdout: e.stdout || "", stderr: e.stderr || "" }
  }
}

/** 判断某个 CLI 是否可用（不抛错） */
function hasCli(probeCmd) {
  try {
    execSync(probeCmd, { cwd: ROOT, stdio: "pipe", encoding: "utf8" })
    return true
  } catch {
    return false
  }
}

function section(title) {
  console.log("\n" + "─".repeat(64))
  console.log(title)
  console.log("─".repeat(64))
}

function ok(msg) {
  console.log(`  ✓ ${msg}`)
}
function warn(msg) {
  console.log(`  ! ${msg}`)
}
function bad(msg) {
  console.log(`  ✗ ${msg}`)
}

/* ─────────────────────────── 平台定义 ─────────────────────────── */

const PROJECT_NAME = process.env.EO_PAGES_PROJECT || "openlist"

const PLATFORMS = {
  edgeone: {
    label: "腾讯云 EdgeOne Pages / Makers",
    /** 部署命令：Makers CLI 一次同步 静态资源 + 边缘函数 + KV + 定时触发器 */
    deployCmd() {
      const token = process.env.EO_PAGES_API_TOKEN
      const tokenArg = token ? ` --token "${token}"` : ""
      return `npx --yes edgeone@latest makers deploy . -n ${PROJECT_NAME}${tokenArg} --yes`
    },
    /** CLI 缺失时的兜底说明 */
    manual: [
      `npx --yes edgeone@latest makers deploy . -n ${PROJECT_NAME} --token <EO_PAGES_API_TOKEN> --yes`,
      "或在 EdgeOne 控制台接入 Git 仓库（构建命令 pnpm run build，输出目录 dist）",
    ],
    /** 从环境里猜部署地址 */
    envUrl() {
      return process.env.EO_PAGES_URL || process.env.EDGEONE_PAGES_URL || ""
    },
    /** 平台专属探测（存储能力） */
    extraProbe: probeEdgeOneStorage,
    /** 平台专属提示 */
    notes: [
      "KV 必须在控制台「KV 存储」创建命名空间，并绑定到**边缘函数**，绑定变量名请用 KV",
      "Blob 零配置：@edgeone/pages-blob 首次写入自动创建，无需控制台操作",
      "Node 云函数拿不到 KV，必须经 functions/kv-* 边缘函数代理（需 EO_KV_URLS + JWT_SECRET）",
    ],
  },

  esa: {
    label: "阿里云 ESA（边缘安全加速）函数和 Pages",
    deployCmd() {
      return "npx --yes esa-cli commit && npx --yes esa-cli deploy"
    },
    manual: [
      "npx --yes esa-cli commit   # 生成版本",
      "npx --yes esa-cli deploy   # 选择版本与目标环境，部署到边缘节点",
      "首次需先登录：npx --yes esa-cli login",
      "或在 ESA 控制台「边缘计算 → 函数和 Pages」导入 GitHub 仓库自动构建",
    ],
    envUrl() {
      return process.env.ESA_URL || process.env.ESA_DOMAIN || ""
    },
    extraProbe: null,
    notes: [
      "esa.jsonc 已声明 entry=./dist-server/esa-entry.js 与 assets.notFoundStrategy=singlePageApplication",
      "EdgeKV 由 esa-entry.ts 包装成 env.KV，会被自动识别为 kv 驱动（优先）",
      "ESA 单请求对 KV 子请求有配额上限，建议 DB_FORMAT=map（整库单键）",
    ],
  },

  vercel: {
    label: "Vercel",
    deployCmd() {
      return "npx --yes vercel deploy --prod --yes"
    },
    manual: [
      "npx --yes vercel login",
      "npx --yes vercel deploy --prod --yes",
      "或在 Vercel 控制台 Import Git Repository（配置读 vercel.json）",
    ],
    envUrl() {
      const v = process.env.VERCEL_URL || ""
      return v ? (v.startsWith("http") ? v : `https://${v}`) : ""
    },
    extraProbe: null,
    notes: [
      "Vercel 无平台级 KV，必须接外部数据库（Marketplace 一键连接即可）",
      "Marketplace 注入的环境变量会被 DB_DRIVER=auto 自动识别，见 docs/ONE_CLICK_DATABASE.md",
      "函数执行上限：Hobby 10s / Pro 60s，大目录建议 DB_FORMAT=map",
    ],
  },
}

const cfg = PLATFORMS[platform]

/* ─────────────────────────── 探测实现 ─────────────────────────── */

/**
 * 探测请求超时（毫秒）。
 *
 * 必须有超时：域名解析/建连挂住时 fetch 会一直等下去，让部署脚本卡死；
 * 而探测器本来就是「尽力而为」，超时后按探测失败处理即可。
 */
const PROBE_TIMEOUT_MS = Number(process.env.PROBE_TIMEOUT_MS || 15000)

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, {
    headers: { accept: "application/json", ...headers },
    redirect: "follow",
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  })
  const text = await res.text()
  let body = null
  try {
    body = JSON.parse(text)
  } catch {
    /* 非 JSON（可能是被 SPA 兜底或登录页拦截） */
  }
  return { status: res.status, body, text }
}

/**
 * 通用探测：/api/public/env_check
 *
 * 这是权威结论 —— 它由 Node 云函数返回**实际生效**的驱动与健康状态。
 */
async function probeEnvCheck(baseUrl) {
  const url = new URL("/api/public/env_check", baseUrl).toString()
  let r
  try {
    r = await fetchJson(url)
  } catch (e) {
    return { ok: false, error: e?.message || String(e) }
  }

  if (!r.body) {
    // 可能被 SPA 兜底返回 HTML，或平台鉴权拦截
    return {
      ok: false,
      status: r.status,
      error:
        r.status === 200
          ? "响应不是 JSON（可能被 SPA 兜底或平台登录页拦截）"
          : `HTTP ${r.status}`,
      raw: r.text.slice(0, 200),
    }
  }

  const storage = r.body.storage || {}
  const jwt = r.body.jwt || {}
  const issues = Array.isArray(r.body.issues) ? r.body.issues : []

  return {
    ok: true,
    driver: String(storage.driver ?? "none"),
    mode: storage.mode ?? null,
    format: String(storage.format ?? "none"),
    available: storage.available !== false,
    platform: storage.platform ?? null,
    configError: storage.configError ?? null,
    error: storage.error ?? null,
    jwtReady: jwt.ready === true,
    ready: r.body.ready === true,
    issues,
    config: r.body.config || {},
  }
}

/** EdgeOne 专属：/storage-probe（KV / Blob 能力） */
async function probeEdgeOneStorage(baseUrl) {
  const u = new URL("/storage-probe", baseUrl)
  if (deep) u.searchParams.set("deep", "1")

  const headers = {}
  if (deep && process.env.JWT_SECRET) {
    headers["X-Internal-Call"] = process.env.JWT_SECRET
  }

  let r
  try {
    r = await fetchJson(u.toString(), headers)
  } catch (e) {
    return { ok: false, error: e?.message || String(e) }
  }
  if (!r.body) {
    return { ok: false, status: r.status, error: `HTTP ${r.status}` }
  }
  return { ok: true, ...r.body }
}

/* ─────────────────────────── 报告输出 ─────────────────────────── */

function reportEnvCheck(p) {
  section("① 存储状态（/api/public/env_check · Node 云函数侧，权威结论）")

  if (!p.ok) {
    bad(`探测失败：${p.error}`)
    if (p.raw) console.log(`      响应片段: ${p.raw}`)
    return false
  }

  const driver = p.driver
  if (driver === "none" || driver === "") {
    bad("没有任何可用存储驱动")
  } else if (driver === "memory") {
    bad(`驱动 = memory（内存兜底）→ 数据不会持久化！`)
  } else {
    ok(`驱动 = ${driver}${p.mode ? `（${p.mode} 模式）` : ""}`)
    ok(`格式 = ${p.format}`)
    if (p.platform) ok(`平台 = ${p.platform}`)
  }

  if (p.configError) bad(`配置错误：${p.configError}`)
  if (p.error) bad(`驱动自检失败：${p.error}`)
  console.log(`  · JWT 密钥就绪: ${p.jwtReady ? "是" : "否（必须配置 JWT_SECRET）"}`)
  console.log(`  · 综合就绪 ready: ${p.ready ? "是" : "否"}`)

  if (p.issues.length) {
    console.log("  · 问题清单:")
    for (const it of p.issues) {
      console.log(`      [${it.level}] ${it.code}: ${it.message}`)
    }
  }

  return driver !== "none" && driver !== "memory" && p.available && p.jwtReady
}

function reportEdgeOneStorage(s) {
  section("② EdgeOne 存储能力（/storage-probe · 边缘函数侧，KV 优先）")

  if (!s.ok) {
    warn(`探测失败：${s.error}`)
    warn(
      "若为 404，说明 functions/storage-probe 未随本次部署上传（检查 functions/ 目录是否入库）",
    )
    return
  }

  const kv = s.kv || {}
  const blob = s.blob || {}

  if (kv.available === true) {
    ok(`KV 可用（绑定变量名: ${kv.binding || "?"}）`)
    if (kv.writable === true) ok("KV 写/读/删往返正常")
    else if (kv.writable === false) bad(`KV 不可写：${kv.error || "未知原因"}`)
    else if (deep) warn("KV 深度探测被跳过（缺少内部凭据，设置 JWT_SECRET 可启用）")
  } else {
    warn("KV 不可用")
    if (kv.error) console.log(`      原因: ${kv.error}`)
  }

  if (blob.available === true) ok("Blob 可用（零配置，首次写入自动建库）")
  else if (blob.available === false) warn("Blob 不可用")
  else warn(`Blob 未判定（${blob.note || "边缘层无法探测"}）`)

  if (s.recommended) {
    const conf =
      s.recommendedConfidence === "confirmed"
        ? "已实测"
        : "按 EdgeOne 零配置约定推定"
    ok(`推荐驱动 = ${s.recommended}（${conf}）`)
  } else {
    warn("KV/Blob 均未能确认，请以 ① 的 env_check 结论为准")
  }

  for (const h of s.hints || []) console.log(`  · ${h}`)
}

function reportNextSteps(healthy, extra) {
  section("③ 结论与下一步")

  if (healthy) {
    ok("存储已就绪，可以正常使用（数据会持久化）")
  } else {
    bad("存储尚未就绪 —— 请按下列提示处理后重新部署")
  }

  console.log("\n  平台要点:")
  for (const n of cfg.notes) console.log(`    · ${n}`)

  if (extra) console.log("")
}

/* ─────────────────────────── 主流程 ─────────────────────────── */

async function main() {
  console.log(`\n▶ 目标平台：${cfg.label}`)

  /* 1) 构建 */
  if (!skipBuild) {
    section("构建")
    const r = run("node scripts/fetch-frontend.mjs && node scripts/build-edge.mjs")
    if (r && r.failed) {
      console.error("\n构建失败，已中止。")
      process.exit(1)
    }
  } else {
    console.log("\n(跳过构建)")
  }

  /* 2) 部署 */
  if (!noDeploy) {
    section("部署")
    const r = run(cfg.deployCmd())
    if (r && r.failed) {
      warn("平台 CLI 部署未成功（可能未安装或未登录）。")
      console.log("  请手动执行以下命令之一：")
      for (const line of cfg.manual) console.log(`    ${line}`)
    } else {
      ok("部署命令已执行完成")
    }
  } else {
    console.log("\n(跳过部署，仅探测)")
  }

  /* 3) 探测 */
  const baseUrl = opt("--url") || cfg.envUrl()

  if (!baseUrl) {
    section("探测")
    warn("未提供部署地址，跳过自动探测。")
    console.log(
      `\n  部署完成后可随时手动探测：\n    node scripts/deploy-platform.mjs ${platform} --no-deploy --url https://<你的域名>`,
    )
    console.log(
      `  或直接访问：GET https://<你的域名>/api/public/env_check${
        platform === "edgeone" ? "  与  GET /storage-probe" : ""
      }\n`,
    )
    return
  }

  console.log(`\n探测地址：${baseUrl}`)
  if (/\.edgeone\.cool/i.test(baseUrl)) {
    warn(
      "检测到 EdgeOne 临时域名（*.edgeone.cool）：该域名带全站鉴权参数，" +
        "会拦截边缘函数↔云函数的 KV 代理回调，建议绑定自定义域名后再验证",
    )
  }

  const envCheck = await probeEnvCheck(baseUrl)
  const healthy = reportEnvCheck(envCheck)

  if (cfg.extraProbe) {
    const extra = await cfg.extraProbe(baseUrl)
    reportEdgeOneStorage(extra)
  }

  reportNextSteps(healthy, true)

  process.exitCode = healthy ? 0 : 2
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
