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
 *   于是整个「初始化向导」（环境检查 / 创建管理员 / 完成）在中文界面下全是英文。
 *   另外个别键虽然存在、值却是英文原文（如 br.json 的 backup = "Backup"）。
 *
 * 补丁文件放 scripts/i18n-overrides/<语言代码>.json，按语言包文件名分组：
 *   { "init.json": { "next": "下一步" }, "br.json": { "backup": "备份" } }
 * 只覆盖列出的键，其余原样保留。上游补齐后同名键仍会被这里覆盖，
 * 值一致时没有影响；想撤销某条，把补丁里的键删掉即可。
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
 * 把 patch 深合并进 target，返回真正发生变化的键（点号路径）。
 * 这样日志里能明确说清「动了哪几条」，而不是笼统地说打过了。
 */
function deepMerge(target, patch, prefix = "") {
  const changed = []
  for (const [k, v] of Object.entries(patch)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (!target[k] || typeof target[k] !== "object") target[k] = {}
      changed.push(...deepMerge(target[k], v, key))
    } else {
      if (target[k] !== v) changed.push(key)
      target[k] = v
    }
  }
  return changed
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf-8"))
}

/** 覆盖补丁目录下所有语言 */
function applyOverrides(langRoot, reportOnly) {
  if (!fs.existsSync(OVERRIDE_DIR)) {
    console.log(`${LOG} no override dir, nothing to do`)
    return
  }
  const localeFiles = fs
    .readdirSync(OVERRIDE_DIR)
    .filter((f) => f.endsWith(".json"))

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
      const changed = deepMerge(data, entries)
      if (!changed.length) {
        console.log(`${LOG} ${locale}/${fileName}: already up to date`)
        continue
      }
      if (!reportOnly) {
        fs.writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`, "utf-8")
      }
      console.log(
        `${LOG} ${locale}/${fileName}: ${reportOnly ? "would patch" : "patched"} ` +
          `${changed.length} key(s) -> ${changed.join(", ")}`,
      )
    }
  }
}

/**
 * 打完补丁后仍然「会显示英文」的地方还有哪些。
 *
 * 判据两条，都对应用户能看到的现象：
 *   - 缺键：键在英文源里有、翻译包里没有 → 合并时回落英文
 *   - 同值：值和英文逐字相同且不含中文 → Crowdin 没过翻译
 * 只警告不失败：翻译缺口不该把构建搞挂，但要在构建日志里留痕。
 */
function reportGaps(langRoot) {
  const enDir = path.join(langRoot, "en")
  if (!fs.existsSync(enDir)) return
  const enFiles = fs.readdirSync(enDir).filter((f) => f.endsWith(".json"))

  for (const locale of fs
    .readdirSync(langRoot)
    .filter((d) => d !== "en" && fs.statSync(path.join(langRoot, d)).isDirectory())) {
    const missing = []
    const untranslated = []
    for (const f of enFiles) {
      const localeFile = path.join(langRoot, locale, f)
      if (!fs.existsSync(localeFile)) {
        missing.push(`${f} (whole file)`)
        continue
      }
      const en = flatten(readJson(path.join(enDir, f)))
      const loc = flatten(readJson(localeFile))
      for (const [k, v] of en) {
        if (!loc.has(k)) {
          missing.push(`${f}::${k}`)
          continue
        }
        const lv = loc.get(k)
        if (typeof v === "string" && v === lv && !CJK.test(lv)) {
          untranslated.push(`${f}::${k} = ${JSON.stringify(lv)}`)
        }
      }
    }

    if (!missing.length && !untranslated.length) {
      console.log(`${LOG} ${locale}: no gaps, UI will be fully translated`)
      continue
    }
    if (missing.length) {
      console.log(
        `${LOG} ${locale}: ${missing.length} key(s) still missing (will fall back to English): ` +
          missing.slice(0, 10).join(", ") +
          (missing.length > 10 ? `, ...(+${missing.length - 10})` : ""),
      )
    }
    if (untranslated.length) {
      console.log(
        `${LOG} ${locale}: ${untranslated.length} key(s) identical to English ` +
          `(check whether they are brand names): ` +
          untranslated.slice(0, 10).join(", ") +
          (untranslated.length > 10 ? `, ...(+${untranslated.length - 10})` : ""),
      )
    }
    console.log(
      `${LOG} ${locale}: 若上述条目确实该翻译，把中文加进 scripts/i18n-overrides/${locale}.json 即可`,
    )
  }
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
  if (!reportOnly) reportGaps(langRoot)
}

main()
