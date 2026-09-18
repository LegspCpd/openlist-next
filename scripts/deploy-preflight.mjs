#!/usr/bin/env node
/**
 * 部署前检查（deploy preflight）
 *
 * 目的：在「推上去部署」之前，把每个部署平台**实际会执行的入口**真编译一遍、
 * 真调用一次，并核对平台配置里写的路径是否真实存在。
 *
 * 为什么需要它：
 *   线上事故里「部署成功但打不开」占了绝大多数，成因集中在三类 ——
 *   (1) 平台配置指向的入口文件不存在或改了名；
 *   (2) 入口能编译但依赖解析不了（少包 / 引用了该运行时没有的模块）；
 *   (3) 入口能编译也能加载，但导出形状不符合平台约定（没有 fetch / 没有
 *       default handler），于是请求永远走不到后端。
 *   这三类都能在本地静态检出，不必等部署完再猜。
 *
 * 设计约束（照做，别简化）：
 *   - **不做假检查**。每一项要么真跑（esbuild 真编译、真 import、真发一个
 *     Request），要么明确报 SKIP 并说明原因，**不允许**用「文件存在即通过」
 *     这种查字符串的方式冒充功能验证。
 *   - 需要完整依赖（pnpm install 之后）才能跑；缺依赖时会明确告诉你缺什么，
 *     而不是静默通过。
 *   - 只读：不写仓库内文件，临时产物落在系统临时目录。
 *
 * 用法：
 *   node scripts/deploy-preflight.mjs            # 全部平台
 *   node scripts/deploy-preflight.mjs vercel     # 只查指定平台
 */

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath, pathToFileURL } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const require = createRequire(import.meta.url)

// ─────────────────────────── 输出 ───────────────────────────

let failed = 0
let skipped = 0
let passed = 0

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, "/")

function pass(name, detail = "") {
  passed++
  console.log(`  \u2713 ${name}${detail ? ` — ${detail}` : ""}`)
}
function fail(name, detail = "") {
  failed++
  console.log(`  \u2717 ${name}${detail ? ` — ${detail}` : ""}`)
}
function skip(name, why) {
  skipped++
  console.log(`  \u25CB ${name} — SKIP: ${why}`)
}
function head(title) {
  console.log(`\n${"─".repeat(64)}\n${title}\n${"─".repeat(64)}`)
}

// ─────────────────────── 小工具 ───────────────────────

/** 去掉 JSONC 里的注释与尾逗号，得到可 JSON.parse 的文本。 */
function stripJsonc(text) {
  let out = ""
  let inStr = false
  let inLine = false
  let inBlock = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    const n = text[i + 1]
    if (inLine) {
      if (c === "\n") {
        inLine = false
        out += c
      }
      continue
    }
    if (inBlock) {
      if (c === "*" && n === "/") {
        inBlock = false
        i++
      }
      continue
    }
    if (inStr) {
      out += c
      if (c === "\\") {
        out += text[++i] ?? ""
      } else if (c === '"') {
        inStr = false
      }
      continue
    }
    if (c === '"') {
      inStr = true
      out += c
      continue
    }
    if (c === "/" && n === "/") {
      inLine = true
      i++
      continue
    }
    if (c === "/" && n === "*") {
      inBlock = true
      i++
      continue
    }
    out += c
  }
  // 去掉对象/数组里最后一个元素后的逗号
  return out.replace(/,(\s*[}\]])/g, "$1")
}

/**
 * 极简 TOML 读取器：只支持 netlify.toml 用到的那一小撮语法
 * （`[table]`、`[[array-of-table]]`、`[a.b.c]` 嵌套、`key = "str" | num | bool`）。
 *
 * 不引入 TOML 依赖是刻意的：这里只需要读出 `build.command/publish/functions`
 * 几个键来核对路径，为它加一条供应链依赖不划算。
 *
 * 两条硬要求：
 *   - **支持 `[a.b]` 嵌套**，并且当 `a` 是 `[[a]]` 数组时落到最后一个元素上。
 *     netlify.toml 里就有 `[headers.values]` 跟在 `[[headers]]` 之后 —— 不支持
 *     的话会把它解析成顶层键，检查看着通过、其实读错了对象。
 *   - **遇到不认识的语法直接抛错**，不猜。安静的错解析比报错危险得多。
 */
function readTomlSubset(text) {
  const result = {}

  /** 去掉注释：`#` 在双引号内不算注释。 */
  const stripComment = (line) => {
    let inStr = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') inStr = !inStr
      else if (c === "#" && !inStr) return line.slice(0, i)
    }
    return line
  }

  /** 沿 `a.b.c` 下钻；中间段若是数组则落到最后一个元素。 */
  const descend = (segments, asArrayTail) => {
    let node = result
    segments.forEach((seg, idx) => {
      const isLast = idx === segments.length - 1
      if (isLast && asArrayTail) {
        if (!Array.isArray(node[seg])) node[seg] = []
        const entry = {}
        node[seg].push(entry)
        node = entry
        return
      }
      if (Array.isArray(node[seg])) {
        if (!node[seg].length) node[seg].push({})
        node = node[seg][node[seg].length - 1]
        if (isLast) return
        return
      }
      if (!isLast) {
        if (typeof node[seg] !== "object" || node[seg] === null) node[seg] = {}
        node = node[seg]
        return
      }
      if (typeof node[seg] !== "object" || node[seg] === null) node[seg] = {}
      node = node[seg]
    })
    return node
  }

  let cursor = result
  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim()
    if (!line) continue

    const arrayTable = line.match(/^\[\[([^\]]+)\]\]$/)
    if (arrayTable) {
      const segs = arrayTable[1].split(".").map((s) => s.trim())
      cursor = descend(segs, true)
      continue
    }
    const table = line.match(/^\[([^\]]+)\]$/)
    if (table) {
      const segs = table[1].split(".").map((s) => s.trim())
      cursor = descend(segs, false)
      continue
    }
    const kv = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/)
    if (kv) {
      const key = kv[1]
      let value = kv[2].trim()
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1)
      } else if (value === "true" || value === "false") {
        value = value === "true"
      } else if (/^-?\d+$/.test(value)) {
        value = Number(value)
      } else if (value.startsWith("[") || value.startsWith("{")) {
        throw new Error(`netlify.toml: 暂不支持数组/内联表值 "${key} = ${value}"`)
      }
      cursor[key] = value
      continue
    }
    throw new Error(`netlify.toml: 不支持的语法 "${rawLine.trim()}"`)
  }
  return result
}

/** 读 JSON / JSONC，解析失败返回带原因的对象。 */
function readJson(file) {
  if (!fs.existsSync(file)) return { error: `文件不存在: ${rel(file)}` }
  try {
    const text = fs.readFileSync(file, "utf8")
    const isJsonc = file.endsWith(".jsonc")
    return { value: JSON.parse(isJsonc ? stripJsonc(text) : text) }
  } catch (e) {
    return { error: `解析失败: ${e.message}` }
  }
}

/** 取 esbuild；没装就直接告诉用户去装依赖，而不是跳过。 */
function loadEsbuild() {
  try {
    return require("esbuild")
  } catch {
    console.error(
      "\n无法加载 esbuild。本检查需要完整依赖：先在仓库根目录执行 pnpm install。\n",
    )
    process.exit(2)
  }
}

// Node 内建模块。`crypto` 与 `node:crypto` 两种写法都要列 —— esbuild 只按
// 字面量匹配 external，不会自动把带前缀的形式归到不带前缀的名字上。
const NODE_BUILTINS = (() => {
  const names = require("node:module").builtinModules || []
  return new Set([...names, ...names.map((m) => `node:${m}`)])
})()

/** 判断某个 import 路径是否是 Node 内建模块（两种写法都算）。 */
const isNodeBuiltin = (p) => NODE_BUILTINS.has(p) || NODE_BUILTINS.has(`node:${p}`)

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "openlist-preflight-"))

/**
 * 真编译一个入口，产物落到临时目录，返回 { file, bytes, externals }。
 *
 * 编译不过时抛出的错误里会带上**未解析的依赖清单**：这类失败在 CI 里通常
 * 意味着「新引了一个依赖但没写进 package.json」，正是要抓的东西。
 */
async function bundle(esbuild, entryAbs, { platform, conditions, target, format }) {
  const outfile = path.join(tmpRoot, `${path.basename(entryAbs).replace(/[^\w.]/g, "_")}.mjs`)
  const result = await esbuild.build({
    entryPoints: [entryAbs],
    bundle: true,
    write: false,
    outfile,
    format,
    target,
    platform,
    ...(conditions ? { conditions } : {}),
    // Node 内建模块一律交给运行时（Workers 由 nodejs_compat 提供，
    // Node 平台本来就有），与 wrangler 的处理方式一致。
    external: [...NODE_BUILTINS],
    metafile: true,
    logLevel: "silent",
  })
  const contents = result.outputFiles[0].contents
  fs.writeFileSync(outfile, contents)

  const externals = new Set()
  const nodeBuiltins = new Set()
  for (const info of Object.values(result.metafile.inputs)) {
    for (const imp of info.imports || []) {
      if (!imp.external) continue
      if (isNodeBuiltin(imp.path)) {
        // 归一到不带前缀的名字，便于去重与展示
        nodeBuiltins.add(imp.path.replace(/^node:/, ""))
      } else {
        externals.add(imp.path)
      }
    }
  }
  return {
    file: outfile,
    bytes: contents.length,
    externals: [...externals].sort(),
    nodeBuiltins: [...nodeBuiltins].sort(),
  }
}

/** 把 esbuild 的报错整理成可读的多行文本。 */
function describeBuildError(e) {
  const errors = e.errors || []
  const unresolved = errors.filter((x) => /Could not resolve/.test(x.text))
  const lines = []
  for (const x of errors.slice(0, 8)) {
    const loc = x.location ? ` (${x.location.file}:${x.location.line})` : ""
    lines.push(`      ${x.text}${loc}`)
  }
  if (unresolved.length) {
    const pkgs = [...new Set(unresolved.map((x) => (x.text.match(/"([^"]+)"/) || [])[1]))]
      .filter(Boolean)
      .sort()
    lines.unshift(
      `      未解析的依赖 ${pkgs.length} 个: ${pkgs.join(", ")}` +
        `\n      （若刚新增依赖，请确认已写进 package.json 并同步 pnpm-lock.yaml）`,
    )
  }
  return lines.join("\n")
}

/** 在超时保护下 import 一个打包产物。 */
async function importBundle(file) {
  return Promise.race([
    import(pathToFileURL(file).href),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("import 超时（15s）")), 15000),
    ),
  ])
}

/**
 * 真发一个请求给入口，断言它返回了 Response。
 *
 * 这是本脚本的核心价值：它验证的不是「文件长什么样」，而是「请求进来之后
 * 有没有东西接住」。status 只作记录、不作断言 —— 未配置存储时返回 503 也是
 * 正确的响应，真正要排除的是「抛异常」和「没有任何响应」。
 */
async function invokeAndAssert(label, fn) {
  const res = await Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("调用超时（20s）")), 20000),
    ),
  ])
  if (!(res instanceof Response)) {
    fail(`${label} 调用`, `返回的不是 Response，而是 ${Object.prototype.toString.call(res)}`)
    return
  }
  pass(`${label} 调用`, `HTTP ${res.status} ${res.headers.get("content-type") || ""}`)
}

// ─────────────────── Cloudflare Workers ───────────────────

async function checkCloudflare(esbuild) {
  head("Cloudflare Workers / Pages（wrangler.jsonc）")

  const cfgPath = path.join(ROOT, "wrangler.jsonc")
  const cfg = readJson(cfgPath)
  if (cfg.error) {
    fail("wrangler.jsonc 可解析", cfg.error)
    return
  }
  pass("wrangler.jsonc 可解析")
  const w = cfg.value

  // 入口
  const mainAbs = w.main ? path.join(ROOT, w.main) : null
  if (!mainAbs) {
    fail("声明了 main 入口", "wrangler.jsonc 缺少 main 字段")
  } else if (!fs.existsSync(mainAbs)) {
    fail("main 入口存在", `${w.main} 不存在`)
  } else {
    pass("main 入口存在", w.main)
  }

  // compatibility_date：必须是合法日期且不能是未来
  if (!w.compatibility_date || !/^\d{4}-\d{2}-\d{2}$/.test(w.compatibility_date)) {
    fail("compatibility_date 合法", `当前值 ${JSON.stringify(w.compatibility_date)}`)
  } else {
    const d = new Date(`${w.compatibility_date}T00:00:00Z`)
    const tomorrow = new Date(Date.now() + 86400000)
    if (Number.isNaN(d.getTime())) {
      fail("compatibility_date 合法", "不是真实日期")
    } else if (d > tomorrow) {
      fail("compatibility_date 合法", `${w.compatibility_date} 是未来日期，部署会失败`)
    } else {
      pass("compatibility_date 合法", w.compatibility_date)
    }
  }

  // assets.directory：构建产物目录
  const assetsDir = w.assets?.directory
  if (!assetsDir) {
    fail("声明了 assets.directory", "缺失时 Workers 部署不会带上前端静态资源")
  } else {
    const abs = path.join(ROOT, assetsDir)
    const gi = fs.existsSync(path.join(ROOT, ".gitignore"))
      ? fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8")
      : ""
    if (!fs.existsSync(abs)) {
      skip(
        `静态资源目录 ${assetsDir}`,
        "尚未构建（先跑 pnpm run build）。已确认该目录被 .gitignore 覆盖: " +
          (gi.includes(assetsDir.replace(/^\.\//, "")) ? "是" : "否"),
      )
    } else if (!fs.existsSync(path.join(abs, "index.html"))) {
      fail(`静态资源目录 ${assetsDir}`, "存在但缺少 index.html")
    } else {
      pass(`静态资源目录 ${assetsDir}`, "含 index.html")
    }
  }

  // 真编译。
  // 解析条件取 workerd —— 与 wrangler 打包 Worker 时一致；`platform: neutral`
  // 表示「不按 Node 也不按浏览器取舍内置模块」，符合 Workers 的实际情况。
  if (!mainAbs || !fs.existsSync(mainAbs)) return
  let bundleInfo
  try {
    bundleInfo = await bundle(esbuild, mainAbs, {
      platform: "neutral",
      conditions: ["workerd", "worker", "browser"],
      mainFields: ["module", "main"],
      target: "es2022",
      format: "esm",
    })
    pass("入口可编译（workerd 解析条件）", `${bundleInfo.bytes} bytes`)
  } catch (e) {
    fail("入口可编译（workerd 解析条件）")
    console.log(describeBuildError(e))
    return
  }

  // 绑定校验：这几类错误 wrangler 会在部署时直接拒绝，且信息不直观，
  // 对应上游 issue #35（binding 缺 name）、#44（KV 命名空间）、#37。
  const bindingProblems = []

  const kvNamespaces = Array.isArray(w.kv_namespaces) ? w.kv_namespaces : []
  kvNamespaces.forEach((kv, i) => {
    if (!kv || typeof kv.binding !== "string" || !kv.binding.trim()) {
      bindingProblems.push(`kv_namespaces[${i}] 缺少非空的 binding 名称`)
    }
    // 空字符串 id 会被 wrangler 校验拒绝（"should have a string id field"）；
    // 想让它自动预配就必须**完全省略** id。
    if (kv && "id" in kv && String(kv.id).trim() === "") {
      bindingProblems.push(`kv_namespaces[${i}] 的 id 是空字符串（应完全省略该字段）`)
    }
  })

  const d1 = Array.isArray(w.d1_databases) ? w.d1_databases : []
  d1.forEach((db, i) => {
    if (!db || typeof db.binding !== "string" || !db.binding.trim()) {
      bindingProblems.push(`d1_databases[${i}] 缺少非空的 binding 名称`)
    }
    if (db && "database_id" in db && String(db.database_id).trim() === "") {
      bindingProblems.push(
        `d1_databases[${i}] 的 database_id 是空字符串（应完全省略该字段）`,
      )
    }
  })

  const r2 = Array.isArray(w.r2_buckets) ? w.r2_buckets : []
  r2.forEach((b, i) => {
    if (!b || typeof b.binding !== "string" || !b.binding.trim()) {
      bindingProblems.push(`r2_buckets[${i}] 缺少非空的 binding 名称`)
    }
  })

  if (bindingProblems.length) {
    for (const p of bindingProblems) fail("绑定配置合法", p)
  } else {
    pass(
      "绑定配置合法",
      `kv=${kvNamespaces.length} d1=${d1.length} r2=${r2.length}`,
    )
  }

  // Durable Object 的 class_name 必须在入口里真的导出 —— 否则部署报
  // "Cannot find class" / 运行时 1101。
  const doBindings = w.durable_objects?.bindings
  if (Array.isArray(doBindings) && doBindings.length) {
    const entrySrc = fs.readFileSync(mainAbs, "utf8")
    for (const b of doBindings) {
      const cls = b?.class_name
      if (!cls) {
        fail("Durable Object 绑定", `bindings 中有一项缺少 class_name`)
        continue
      }
      // export class X / export { X } / export const X
      const exported = new RegExp(
        `export\\s+(?:class|const|let|var|function)\\s+${cls}\\b|export\\s*\\{[^}]*\\b${cls}\\b`,
      ).test(entrySrc)
      if (!exported) {
        fail("Durable Object 类已导出", `${cls} 未从 ${w.main} 导出`)
      } else {
        pass("Durable Object 类已导出", `${cls}（binding ${b.name}）`)
      }
    }
  }

  // nodejs_compat：**依赖闭包**里用到 Node 内建模块时，必须声明该 flag。
  //
  // 判断依据取自打包结果而不是入口文件的文本：内建模块通常出现在更深一层的
  // 依赖里（例如 mysql2 需要 net/tls），只 grep 入口文件会永远判成「不需要」，
  // 那样这条检查等于没写。
  const flags = Array.isArray(w.compatibility_flags) ? w.compatibility_flags : []
  const used = bundleInfo.nodeBuiltins
  if (used.length && !flags.includes("nodejs_compat")) {
    fail(
      "声明 nodejs_compat",
      `依赖闭包用到 Node 内建模块（${used.join(", ")}），但 compatibility_flags 为 ${JSON.stringify(flags)}`,
    )
  } else if (used.length) {
    pass("声明 nodejs_compat", `依赖闭包用到 ${used.length} 个 Node 内建模块`)
  } else {
    pass("声明 nodejs_compat", "依赖闭包未引用 Node 内建模块")
  }

  // 闭包里未被打包的外部依赖：Workers 只能由运行时提供，列出来便于核对
  if (bundleInfo.externals.length) {
    skip(
      "闭包外部依赖",
      `以下模块未被打包、需由运行时提供: ${bundleInfo.externals.join(", ")}`,
    )
  }
}

// ───────────────────────── Vercel ─────────────────────────

async function checkVercel(esbuild) {
  head("Vercel（vercel.json）")

  const cfg = readJson(path.join(ROOT, "vercel.json"))
  if (cfg.error) {
    fail("vercel.json 可解析", cfg.error)
    return
  }
  pass("vercel.json 可解析")
  const v = cfg.value

  // functions：每个键都必须是一个真实文件
  const fnKeys = Object.keys(v.functions || {})
  if (!fnKeys.length) {
    fail("声明了 functions", "vercel.json 未声明任何 Serverless Function")
  }
  let firstFnEntry = null
  for (const key of fnKeys) {
    const abs = path.join(ROOT, key)
    if (!fs.existsSync(abs)) {
      fail(`Function ${key} 存在`, "文件不存在，部署时会被跳过")
    } else {
      pass(`Function ${key} 存在`)
      if (!firstFnEntry) firstFnEntry = abs
    }
  }

  // outputDirectory
  if (v.outputDirectory) pass("声明了 outputDirectory", v.outputDirectory)
  else fail("声明了 outputDirectory", "缺失时 Vercel 无法确定静态产物目录")

  // rewrites：destination 指向的 Function 必须存在
  const rewrites = Array.isArray(v.rewrites) ? v.rewrites : []
  if (!rewrites.length) {
    fail("声明了 rewrites", "缺少重写规则时 API 路径不会进 Function")
  }
  for (const r of rewrites) {
    const dest = String(r.destination || "")
    const isFn = dest.includes("[...route]")
    if (isFn && !fnKeys.some((k) => k.includes("[...route]"))) {
      fail(`rewrite ${r.source}`, `destination ${dest} 指向未声明的 Function`)
    } else if (!dest.startsWith("/")) {
      fail(`rewrite ${r.source}`, `destination ${dest} 必须以 / 开头`)
    }
  }
  if (rewrites.length) pass("rewrites 目标可达", `${rewrites.length} 条`)

  // 真编译 + 真调用
  if (!firstFnEntry) return
  let info
  try {
    info = await bundle(esbuild, firstFnEntry, {
      platform: "node",
      target: "node22",
      format: "esm",
    })
    pass("Function 可编译（node22 / esm）", `${info.bytes} bytes`)
  } catch (e) {
    fail("Function 可编译（node22 / esm）")
    console.log(describeBuildError(e))
    return
  }

  try {
    const mod = await importBundle(info.file)
    const get = mod.GET
    if (typeof get !== "function") {
      fail("导出 Vercel 句柄", `未导出 GET，实际导出: ${Object.keys(mod).join(", ") || "(空)"}`)
      return
    }
    pass("导出 Vercel 句柄", "GET/POST/... 形式")
    await invokeAndAssert(
      "GET /api/public/env_check",
      () => get(new Request("https://preflight.local/api/public/env_check")),
    )
  } catch (e) {
    fail("加载并调用 Function", String(e.message || e))
  }
}

// ───────────────────────── Netlify ─────────────────────────

async function checkNetlify(esbuild) {
  head("Netlify（netlify.toml）")

  const cfgPath = path.join(ROOT, "netlify.toml")
  if (!fs.existsSync(cfgPath)) {
    fail("netlify.toml 存在")
    return
  }
  let cfg
  try {
    cfg = readTomlSubset(fs.readFileSync(cfgPath, "utf8"))
    pass("netlify.toml 可解析")
  } catch (e) {
    fail("netlify.toml 可解析", e.message)
    return
  }

  const build = cfg.build || {}
  if (!build.command) fail("声明 build.command")
  else pass("声明 build.command", build.command)
  if (!build.publish) fail("声明 build.publish")
  else pass("声明 build.publish", build.publish)
  if (!build.functions) {
    fail("声明 build.functions", "缺失时 netlify/functions 不会被识别")
  } else {
    const abs = path.join(ROOT, build.functions)
    if (!fs.existsSync(abs)) fail("函数目录存在", `${build.functions} 不存在`)
    else pass("函数目录存在", build.functions)
  }

  // 目录下每个函数入口都要能编译
  const fnDir = path.join(ROOT, build.functions || "netlify/functions")
  const fnFiles = fs.existsSync(fnDir)
    ? fs
        .readdirSync(fnDir)
        .filter((f) => /\.(ts|js|mjs|cts)$/.test(f))
        .map((f) => path.join(fnDir, f))
    : []
  if (!fnFiles.length) fail("函数目录内有入口文件", `${rel(fnDir)} 为空`)

  let apiEntry = null
  for (const f of fnFiles) {
    try {
      const info = await bundle(esbuild, f, {
        platform: "node",
        target: "node22",
        format: "esm",
      })
      pass(`函数可编译 ${rel(f)}`, `${info.bytes} bytes`)
      if (path.basename(f).startsWith("api.")) apiEntry = info.file
    } catch (e) {
      fail(`函数可编译 ${rel(f)}`)
      console.log(describeBuildError(e))
    }
  }

  // 真调用 Netlify Function v2 的默认导出
  if (!apiEntry) return
  try {
    const mod = await importBundle(apiEntry)
    const handler = mod.default
    if (typeof handler !== "function") {
      fail("导出 Netlify handler", `default 不是函数，实际导出: ${Object.keys(mod).join(", ")}`)
      return
    }
    pass("导出 Netlify handler", "default(req, context)")
    await invokeAndAssert("POST /api/public/env_check", () =>
      handler(new Request("https://preflight.local/api/public/env_check"), {}),
    )
    // config.path 必须覆盖 /api/*
    const paths = mod.config?.path
    if (!Array.isArray(paths) || !paths.some((p) => String(p).startsWith("/api"))) {
      fail("config.path 覆盖 /api/*", `实际为 ${JSON.stringify(paths)}`)
    } else {
      pass("config.path 覆盖 /api/*", paths.join(", "))
    }
  } catch (e) {
    fail("加载并调用 Netlify Function", String(e.message || e))
  }
}

// ───────────────────────── EdgeOne ─────────────────────────

function checkEdgeOne() {
  head("EdgeOne Makers（edgeone.json）")

  const cfg = readJson(path.join(ROOT, "edgeone.json"))
  if (cfg.error) {
    fail("edgeone.json 可解析", cfg.error)
    return
  }
  pass("edgeone.json 可解析")

  if (cfg.value.outputDirectory) pass("声明了 outputDirectory", cfg.value.outputDirectory)
  else fail("声明了 outputDirectory")

  // 云函数产物：缺失会被平台判为「纯静态项目」（No server-handler detected），
  // 表现为部署成功但所有 /api/* 404 —— 因此这里必须检查它确实在仓库里。
  const artifact = path.join(ROOT, "cloud-functions", "[[default]].js")
  if (!fs.existsSync(artifact)) {
    fail("云函数产物存在", "cloud-functions/[[default]].js 缺失，EdgeOne 会退化为纯静态项目")
  } else {
    const size = fs.statSync(artifact).size
    if (size < 10000) {
      fail("云函数产物非空壳", `仅 ${size} bytes，疑似未完整构建`)
    } else {
      pass("云函数产物存在", `${size} bytes`)
    }
  }

  const schedules = cfg.value.schedules
  if (Array.isArray(schedules)) {
    for (const s of schedules) {
      if (!s.name || !s.cron || !s.path) {
        fail(`定时任务 ${s.name || "(无名)"}`, "缺少 name / cron / path 之一")
      }
    }
    if (schedules.length) pass("定时任务字段完整", `${schedules.length} 个`)
  }
}

// ─────────────────────────── 主流程 ───────────────────────────

const ALL = ["cloudflare", "vercel", "netlify", "edgeone"]

async function main() {
  const want = process.argv.slice(2).filter((a) => !a.startsWith("-"))
  const targets = want.length ? want : ALL
  const unknown = targets.filter((t) => !ALL.includes(t))
  if (unknown.length) {
    console.error(`未知平台: ${unknown.join(", ")}（可选: ${ALL.join(", ")}）`)
    process.exit(2)
  }

  console.log("\nOpenList Next · 部署前检查（真编译 + 真调用）")
  const needsEsbuild = targets.some((t) => t !== "edgeone")
  const esbuild = needsEsbuild ? loadEsbuild() : null

  for (const t of targets) {
    if (t === "cloudflare") await checkCloudflare(esbuild)
    else if (t === "vercel") await checkVercel(esbuild)
    else if (t === "netlify") await checkNetlify(esbuild)
    else if (t === "edgeone") checkEdgeOne()
  }

  console.log(`\n${"═".repeat(64)}`)
  console.log(`通过 ${passed} 项，失败 ${failed} 项，跳过 ${skipped} 项`)
  console.log("═".repeat(64))

  try {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
  } catch {
    // 临时目录清理失败不影响结论
  }

  if (failed > 0) {
    console.log("\n存在未通过的检查项，请先修掉再部署。\n")
    process.exit(1)
  }
  console.log("\n全部检查通过。\n")
}

main().catch((e) => {
  console.error("\n部署前检查异常中止:", e?.stack || e)
  process.exit(2)
})
