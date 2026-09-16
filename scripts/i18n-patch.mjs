/**
 * 用仓库自带的翻译补丁，补齐官方翻译包里缺失或仍是英文的条目。
 *
 * 为什么需要这一步：
 *   官方前端 src/app/i18n.ts 合并字典的方式是 `{ ...enDict, ...localeDict }`
 *   —— 先铺英文、再用当前语言覆盖。所以某个键只要在翻译包里不存在，
 *   界面上就直接显示英文。
 *
 *   而翻译包由 Crowdin 异步产出（release 资产 i18n.tar.gz），必然落后于英文源。
 *   实测 zh-CN 的 init.json 只有 11 个键，同一提交的英文源有 51 个，
 *   于是整个「初始化向导」（环境检查 / 创建管理员 / 完成）在中文界面下全是英文；
 *   zh-TW 更严重：init.json / plugins.json 整份是英文，另有 260 余条未翻译。
 *
 * 补丁文件放 scripts/i18n-overrides/<语言代码>.json，按语言包文件名分组：
 *   { "init.json": { "next": "下一步" }, "br.json": { "backup": "备份" } }
 * 只覆盖列出的键，其余原样保留。上游补齐后同名键仍会被这里覆盖，
 * 值一致时没有影响；想撤销某条，把补丁里的键删掉即可。
 *
 * 白名单文件 <语言代码>.allowed.json 列出「故意保持英文」的键（品牌词/技术缩写）：
 *   一个数组，元素是 "drivers.json::115 Cloud.cookie" 这样的字符串（`*` 可作通配），
 *   或 { "pattern": "...", "why": "..." }，方便写清楚为什么该保持英文。
 * 打完补丁后仍与英文逐字相同的键，只在这份白名单里才不算缺口，
 * 否则会在构建日志里点名报出来 —— 免得上游新增文案时界面悄悄变回英文。
 *
 * 用法：
 *   node scripts/i18n-patch.mjs <前端仓库目录>            # 打补丁并报告缺口
 *   node scripts/i18n-patch.mjs <前端仓库目录> --report   # 只报告，不写文件
 *
 * 注意：设置了 FRONTEND_DIST（直接用现成的 dist 产物）时不会走这里 ——
 * 那种模式没有前端源码可改，补丁无法生效。
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OVERRIDE_DIR = path.join(__dirname, "i18n-overrides")
const ALLOWED_SUFFIX = ".allowed.json"

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/
const LOG = "[i18n-patch]"

/** 把嵌套对象拍平成 "a.b.c" -> value */
function flatten(obj, prefix = "", out = new Map()) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out)
    else out.set(key, v)
  }
  return out
}

/**
 * 同 flatten，但遇到「键名本身带点」与「嵌套同路径」撞车时直接抛错。
 * 例如文件里既有字面量键 "status.enabled"、又有嵌套 { status: { enabled } }：
 * 只按点号路径取值会读到哪一个取决于遍历顺序，那种文件没法安全打补丁。
 */
function flattenStrict(obj) {
  const out = new Map()
  const walk = (node, prefix) => {
    for (const [k, v] of Object.entries(node ?? {})) {
      const key = prefix ? `${prefix}.${k}` : k
      if (v && typeof v === "object" && !Array.isArray(v)) walk(v, key)
      else {
        if (out.has(key)) throw new Error(`ambiguous key path: ${key}`)
        out.set(key, v)
      }
    }
  }
  walk(obj, "")
  return out
}

/** 按点号路径逐段查值；任一段不是字面量键就返回 undefined（不猜、不做拆分） */
function lookupLiteral(obj, key) {
  let cur = obj
  for (const seg of key.split(".")) {
    if (!cur || typeof cur !== "object" || !Object.prototype.hasOwnProperty.call(cur, seg)) {
      return undefined
    }
    cur = cur[seg]
  }
  return cur
}

/**
 * 把 patch 深合并进 target。
 * 返回 { changed, leaves }：changed 是真正变了的键（日志用），
 * leaves 是补丁里所有叶子（路径 + 目标值），用于写完回读校验。
 */
function deepMerge(target, patch, prefix = "", acc = { changed: [], leaves: [] }) {
  for (const [k, v] of Object.entries(patch)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (!target[k] || typeof target[k] !== "object") target[k] = {}
      deepMerge(target[k], v, key, acc)
    } else {
      if (target[k] !== v) acc.changed.push(key)
      acc.leaves.push({ path: key, value: v })
      target[k] = v
    }
  }
  return acc
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf-8"))
}

/**
 * 写完回读校验：确认补丁的每一条真的落到了界面会读到的那条路径上。
 *
 * 为什么需要：前端是按 `键.键.键` 取值、按嵌套对象存翻译的。万一哪天官方文件
 * 改成字面量键 "status.enabled"，我们的嵌套写法会另建一个对象、把补丁「架空」，
 * 而日志照样会说 patched N key(s) —— 界面依然是英文。这一步就是堵这个。
 * 属于「补丁本身有问题」，所以直接按失败处理，不像翻译缺口那样只警告。
 */
function verifyPatched(file, leaves) {
  let patched
  try {
    patched = readJson(file)
  } catch (err) {
    console.error(`${LOG} VERIFY FAILED ${file}: unreadable after patch: ${err.message}`)
    process.exitCode = 1
    return
  }
  try {
    flattenStrict(patched)
  } catch (err) {
    console.error(
      `${LOG} VERIFY FAILED ${file}: ${err.message} ` +
        `(键名带点的字面量与嵌套写法撞车，按点号路径取值不可靠)`,
    )
    process.exitCode = 1
    return
  }
  const bad = leaves.filter((l) => lookupLiteral(patched, l.path) !== l.value)
  if (bad.length) {
    console.error(
      `${LOG} VERIFY FAILED ${file}: ${bad.length}/${leaves.length} patched key(s) not reachable, ` +
        `UI would still show English: ${bad.slice(0, 5).map((b) => b.path).join(", ")}` +
        (bad.length > 5 ? `, ...(+${bad.length - 5})` : ""),
    )
    process.exitCode = 1
  }
}

/** 覆盖补丁目录下所有语言；<语言>.allowed.json 是白名单，不是补丁，跳过 */
function applyOverrides(langRoot, reportOnly) {
  if (!fs.existsSync(OVERRIDE_DIR)) {
    console.log(`${LOG} no override dir, nothing to do`)
    return
  }
  const localeFiles = fs
    .readdirSync(OVERRIDE_DIR)
    .filter((f) => f.endsWith(".json") && !f.endsWith(ALLOWED_SUFFIX))

  for (const localeFile of localeFiles) {
    const locale = localeFile.replace(/\.json$/, "")
    const langDir = path.join(langRoot, locale)
    if (!fs.existsSync(langDir)) {
      console.warn(
        `${LOG} ${locale}: language dir not found (translation pack missing?), skipped`,
      )
      continue
    }

    let patch
    try {
      patch = readJson(path.join(OVERRIDE_DIR, localeFile))
    } catch (err) {
      console.warn(`${LOG} ${locale}: invalid patch file, skipped: ${err.message}`)
      continue
    }

    for (const [fileName, entries] of Object.entries(patch)) {
      const target = path.join(langDir, fileName)
      if (!fs.existsSync(target)) {
        console.warn(`${LOG} ${locale}/${fileName}: not in translation pack, skipped`)
        continue
      }
      let data
      try {
        data = readJson(target)
      } catch (err) {
        console.warn(`${LOG} ${locale}/${fileName}: unreadable, skipped: ${err.message}`)
        continue
      }
      const { changed, leaves } = deepMerge(data, entries)
      if (!reportOnly) {
        fs.writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`, "utf-8")
        verifyPatched(target, leaves)
      }
      if (!changed.length) {
        console.log(`${LOG} ${locale}/${fileName}: already up to date`)
        continue
      }
      console.log(
        `${LOG} ${locale}/${fileName}: ${reportOnly ? "would patch" : "patched"} ` +
          `${changed.length} key(s) -> ${changed.join(", ")}`,
      )
    }
  }
}

/** 读 <语言>.allowed.json，返回判定函数："drivers.json::*.cookie" 里的 * 当通配符 */
function loadAllowed(locale) {
  const file = path.join(OVERRIDE_DIR, `${locale}${ALLOWED_SUFFIX}`)
  if (!fs.existsSync(file)) return { patterns: [], test: () => false }
  let entries
  try {
    entries = readJson(file)
  } catch (err) {
    console.warn(`${LOG} ${locale}: invalid allowlist, ignored: ${err.message}`)
    return { patterns: [], test: () => false }
  }
  const patterns = (Array.isArray(entries) ? entries : [])
    .map((it) => (typeof it === "string" ? it : it?.pattern))
    .filter((p) => typeof p === "string" && p)
  const regexes = patterns.map((p) => {
    const escaped = p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")
    return new RegExp(`^${escaped}$`)
  })
  return { patterns, test: (id) => regexes.some((re) => re.test(id)) }
}

/**
 * 打完补丁后仍然「会显示英文」的地方还有哪些。
 *
 * 判据两条，都对应用户能看到的现象：
 *   - 缺键：键在英文源里有、翻译包里没有 → 合并时回落英文（白名单管不着，永远算缺口）
 *   - 同值：值和英文逐字相同且不含中文 → Crowdin 没过翻译
 * 命中白名单的算「有意保留英文」，只报数量；没命中的逐条点名。
 * 只警告不失败：翻译缺口不该把构建搞挂，但要在构建日志里留痕。
 */
function reportGaps(langRoot) {
  const enDir = path.join(langRoot, "en")
  if (!fs.existsSync(enDir)) return
  const enFiles = fs.readdirSync(enDir).filter((f) => f.endsWith(".json"))
  let totalActionable = 0

  for (const locale of fs
    .readdirSync(langRoot)
    .filter((d) => d !== "en" && fs.statSync(path.join(langRoot, d)).isDirectory())) {
    const allowed = loadAllowed(locale)
    const missing = []
    const untranslated = []
    const keptEnglish = []

    for (const f of enFiles) {
      const localeFile = path.join(langRoot, locale, f)
      if (!fs.existsSync(localeFile)) {
        missing.push(`${f} (whole file)`)
        continue
      }
      const en = flatten(readJson(path.join(enDir, f)))
      const loc = flatten(readJson(localeFile))
      for (const [k, v] of en) {
        const id = `${f}::${k}`
        const lv = loc.get(k)
        if (lv === undefined) {
          missing.push(`${id} = ${JSON.stringify(v)}`)
          continue
        }
        const sameStr =
          typeof v === "string" && typeof lv === "string" && v === lv && v.trim() !== ""
        const sameArr =
          Array.isArray(v) && Array.isArray(lv) && JSON.stringify(v) === JSON.stringify(lv)
        if (!(sameStr || sameArr)) continue
        if (CJK.test(lv)) continue
        if (allowed.test(id)) keptEnglish.push(id)
        else untranslated.push(`${id} = ${JSON.stringify(lv)}`)
      }
    }

    const actionable = missing.length + untranslated.length
    totalActionable += actionable
    if (!actionable) {
      console.log(
        `${LOG} ${locale}: no gaps, UI will be fully translated` +
          (keptEnglish.length
            ? ` (${keptEnglish.length} brand/technical term(s) kept in English on purpose)`
            : ""),
      )
      continue
    }
    console.log(
      `${LOG} ${locale}: ACTION REQUIRED — ${actionable} key(s) would show English in this locale`,
    )
    for (const it of missing) console.log(`${LOG}   missing      ${it}`)
    for (const it of untranslated) console.log(`${LOG}   untranslated ${it}`)
    console.log(
      `${LOG}   fix: add them to scripts/i18n-overrides/${locale}.json ` +
        `(or to ${locale}${ALLOWED_SUFFIX} if English is correct there)`,
    )
  }

  if (totalActionable === 0) console.log(`${LOG} all locales fully translated`)
}

function main() {
  const args = process.argv.slice(2)
  const reportOnly = args.includes("--report")
  const repo = args.find((a) => !a.startsWith("-"))

  if (!repo) {
    console.error(`${LOG} usage: node scripts/i18n-patch.mjs <frontendRepoDir> [--report]`)
    process.exit(1)
  }

  const langRoot = path.join(path.resolve(repo), "src", "lang")
  if (!fs.existsSync(langRoot)) {
    console.warn(`${LOG} ${langRoot} not found (frontend repo incomplete?), skipped`)
    return
  }

  applyOverrides(langRoot, reportOnly)
  reportGaps(langRoot)
}

main()
