#!/usr/bin/env node
/**
 * 已提交密钥扫描（secret scan）
 *
 * 只扫 **git 跟踪的文件** —— 那才是会被推到远端、被打进部署产物、被搜索引擎
 * 抓走的那一批。工作区里的临时文件不在此列（它们本来就不上云）。
 *
 * 设计原则：
 *   - **只报「确定是凭据」的形态**，不做熵值猜测。误报会让这条检查被忽略，
 *     而一条被忽略的检查等于没有。宁可少报，也不刷屏。
 *   - 例外必须显式登记在 scripts/secret-scan.allow.json 里并写明理由，
 *     而不是在代码里悄悄跳过 —— 否则「为什么这个能过」无人可查。
 *   - 生成产物（cloud-functions/[[default]].js 等）不扫：它是依赖库的打包结果，
 *     里面出现的 PGP armor 常量之类字符串没有判定价值，扫它只会制造噪音。
 *
 * 用法：
 *   node scripts/secret-scan.mjs
 */

import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

/** 生成产物：内容是依赖库打包结果，不做凭据判定。 */
const GENERATED = [
  "cloud-functions/",
  "dist/",
  "dist-server/",
  "node_modules/",
]

const MAX_BYTES = 2 * 1024 * 1024

/**
 * 规则表。每条都必须是「拿到就能用」的确定形态。
 * `id` 用于在 allow 文件里精确豁免。
 */
const RULES = [
  {
    id: "pem-private-key",
    // 必须带 `-----` 才算真 PEM。openpgp 之类的库里有 "BEGIN PGP PRIVATE KEY
    // BLOCK" 这类 armor 常量，不带短横线，不是密钥。
    re: /-----BEGIN(?: [A-Z]+)* PRIVATE KEY-----/,
    what: "PEM 私钥内容",
  },
  {
    id: "github-token",
    re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b/,
    what: "GitHub 访问令牌",
  },
  {
    id: "github-pat",
    re: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
    what: "GitHub 细粒度个人令牌",
  },
  {
    id: "aws-access-key-id",
    re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
    what: "AWS Access Key ID",
  },
  {
    id: "google-api-key",
    re: /\bAIza[0-9A-Za-z_-]{35}\b/,
    what: "Google API Key",
  },
  {
    id: "slack-token",
    re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
    what: "Slack 令牌",
  },
  {
    id: "openai-api-key",
    re: /\bsk-[A-Za-z0-9]{32,}\b/,
    what: "OpenAI 风格 API Key",
  },
  {
    id: "gcp-service-account-json",
    re: /"type"\s*:\s*"service_account"/,
    what: "GCP 服务账号 JSON",
  },
]

/** 不应该被跟踪的文件名形态。 */
const FORBIDDEN_TRACKED = [
  {
    id: "tracked-dotenv",
    test: (p) =>
      /(^|\/)\.env(\.[^/]+)?$/.test(p) && !/\.(example|sample|template)$/.test(p),
    what: "被跟踪的真实 .env（示例文件应命名为 *.example）",
  },
  {
    id: "tracked-key-material",
    test: (p) => /\.(pem|p12|pfx|jks|keystore)$/i.test(p),
    what: "被跟踪的密钥/证书文件",
  },
]

function loadAllow() {
  const file = path.join(__dirname, "secret-scan.allow.json")
  if (!fs.existsSync(file)) return { entries: [] }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"))
    return { entries: Array.isArray(parsed.entries) ? parsed.entries : [] }
  } catch (e) {
    console.error(`secret-scan.allow.json 解析失败: ${e.message}`)
    process.exit(2)
  }
}

const allow = loadAllow()

/**
 * 找出为这条 finding 登记的豁免条目（没有则 undefined）。
 * 三种写法：
 *   { id, why }                     —— 该条规则整体豁免
 *   { id, file, why }               —— 该文件里的该规则豁免
 *   { id, file, contains, why }     —— 该文件里含指定文本的那一行豁免
 *   { file, why }（不写 id）         —— 整个文件跳过，用于「文件本身就是规则定义」
 */
function findAllowEntry(finding) {
  return allow.entries.find((e) => {
    if (!e.id && e.file === finding.file) return true
    if (e.id !== finding.id) return false
    if (e.file && e.file !== finding.file) return false
    if (e.contains && !finding.line.includes(e.contains)) return false
    return true
  })
}

const isAllowed = (finding) => Boolean(findAllowEntry(finding))

function trackedFiles() {
  const out = execFileSync("git", ["ls-files", "-z"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
  return out.split("\0").filter(Boolean)
}

function isGenerated(p) {
  return GENERATED.some((g) => p === g.replace(/\/$/, "") || p.startsWith(g))
}

function looksBinary(buf) {
  const n = Math.min(buf.length, 8192)
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true
  return false
}

function main() {
  const files = trackedFiles()
  const findings = []
  let scanned = 0

  for (const p of files) {
    if (isGenerated(p)) continue

    for (const rule of FORBIDDEN_TRACKED) {
      if (rule.test(p)) {
        findings.push({ id: rule.id, file: p, line: p, what: rule.what })
      }
    }

    const abs = path.join(ROOT, p)
    let stat
    try {
      stat = fs.statSync(abs)
    } catch {
      continue // 已删除但仍在索引里的条目
    }
    if (!stat.isFile() || stat.size > MAX_BYTES) continue

    const buf = fs.readFileSync(abs)
    if (looksBinary(buf)) continue
    scanned++

    const lines = buf.toString("utf8").split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      for (const rule of RULES) {
        if (rule.re.test(lines[i])) {
          findings.push({
            id: rule.id,
            file: p,
            line: lines[i].trim().slice(0, 200),
            lineNo: i + 1,
            what: rule.what,
          })
        }
      }
    }
  }

  const real = findings.filter((f) => !isAllowed(f))

  console.log(`\n已提交内容密钥扫描：检查了 ${scanned} 个被跟踪文件`)
  console.log("─".repeat(64))

  if (findings.length && real.length !== findings.length) {
    // 同一豁免条目可能覆盖多条命中，展示时按「文件 + 规则」去重
    const seen = new Set()
    console.log(`\n已登记豁免（${findings.length - real.length} 条命中）：`)
    for (const f of findings) {
      const entry = findAllowEntry(f)
      if (!entry) continue
      const key = `${f.file}::${f.id}`
      if (seen.has(key)) continue
      seen.add(key)
      console.log(`  · ${f.file}  [${f.id}]  ${entry.why || "(未写理由！请补上)"}`)
    }
  }

  if (real.length) {
    console.log(`\n发现 ${real.length} 处疑似凭据：\n`)
    for (const f of real) {
      console.log(`  ✗ ${f.file}${f.lineNo ? `:${f.lineNo}` : ""}  [${f.id}] ${f.what}`)
      console.log(`      ${f.line}`)
    }
    console.log(
      "\n处理方式：真的凭据请立刻更换并改为从环境变量读取；" +
        "确认是文档示例/协议常量，则在 scripts/secret-scan.allow.json 登记并写明理由。\n",
    )
    process.exit(1)
  }

  console.log("\n未发现已提交的凭据。\n")
}

main()
