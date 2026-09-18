/**
 * 存储驱动的「界面里能选」与「选了真能跑」一致性审计。
 *
 * 这个脚本查四件事，任何一条不通过都意味着用户会在界面上看到一个跑不起来的驱动：
 *
 *   A. 配置里的每个驱动，在 createDriver()（internal/op/storage.ts）里能不能路由到实现。
 *      —— 路由是一条上千行的 if/else 链，宽泛条件（startsWith("123")、includes("pikpak")…）
 *      排在前面就会把后面的精确驱动名吞掉。被吞掉的驱动在界面上照样能建、照样让用户
 *      填表，保存后跑的却是另一个实现，表现是「挂载成功、一打开就报错」。
 *   B. 配置里让用户填的字段，是不是驱动真正读取的字段（drivers/<目录>/types.ts 的
 *      Addition 声明）。缺字段＝用户没有入口填；多字段＝界面上的空旋钮。
 *   C. 反向检查：驱动要读、但配置里没有的字段（B 的另一半）。
 *   D. 界面标签有没有对应的语言包条目（需要前端源码，用 --frontend=<目录> 指定）：
 *      驱动名 drivers.drivers.<键>、字段 drivers.<键>.<字段>、下拉选项 …s.<值>、
 *      帮助文案 …-tips（字段标了 help 才会取）。缺哪一条，界面上就显示哪一串键名。
 *
 * 用法（不需要 tsx，直接 node 跑）：
 *   node scripts/audit-driver-configs.mjs
 *   node scripts/audit-driver-configs.mjs --frontend=../OpenList-Frontend
 *
 * 退出码非 0 表示存在 A / B / C 类问题（D 类需要前端源码，缺源码时跳过）。
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "")

/** 从源码里切出一段以 open 开头、到配对 close 结束的字面量 */
function sliceLiteral(src, anchor, open, close) {
  const at = src.indexOf(anchor)
  if (at < 0) throw new Error(`找不到锚点: ${anchor}`)
  const from = src.indexOf(open, at)
  let depth = 0
  for (let i = from; i < src.length; i++) {
    if (src[i] === open) depth++
    else if (src[i] === close) {
      depth--
      if (depth === 0) return src.slice(from, i + 1)
    }
  }
  throw new Error(`括号不配平: ${anchor}`)
}

const adminSrc = fs.readFileSync(
  path.join(ROOT, "src/backend/server/admin.ts"),
  "utf8",
)
const storageSrc = fs.readFileSync(
  path.join(ROOT, "src/backend/internal/op/storage.ts"),
  "utf8",
)

const inlineCfg = new Function(
  `return ${sliceLiteral(adminSrc, "const driverConfigs", "{", "}").replace(
    /common:\s*COMMON_FIELDS/g,
    "common: []",
  )}`,
)()
const extraSrc = fs.readFileSync(
  path.join(ROOT, "src/backend/server/driver-configs.extra.ts"),
  "utf8",
)
const extraCfg = new Function(
  `return ${sliceLiteral(extraSrc, "const EXTRA_DRIVER_CONFIGS", "{", "}").replace(
    /common:\s*COMMON_FIELDS/g,
    "common: []",
  )}`,
)()
const all = { ...inlineCfg, ...extraCfg }

// ---------- 类名 → 驱动目录 ----------
const classDir = {}
for (const m of storageSrc.matchAll(
  /import\s*\{([^}]*)\}\s*from\s*"([^"]*drivers\/[^"]+)"/g,
)) {
  const dir = m[2].split("drivers/")[1].replace(/\/.*$/, "")
  for (const n of m[1].split(",")) {
    const name = n.trim().split(/\s+as\s+/).pop().trim()
    if (name) classDir[name] = dir
  }
}
for (const m of storageSrc.matchAll(/import\s+(\w+)\s+from\s*"([^"]*drivers\/[^"]+)"/g))
  classDir[m[1]] = m[2].split("drivers/")[1].replace(/\/.*$/, "")
classDir["getSFTPDriver"] = "sftp"
classDir["getFTPDriver"] = "ftp"

// ---------- 切出 createDriver 的分支，条件直接求值（不能用「或」近似） ----------
const fnStart = storageSrc.indexOf("async function createDriver(")
const fnBrace = storageSrc.indexOf("{", fnStart)
let depth = 0
let fnEnd = -1
for (let i = fnBrace; i < storageSrc.length; i++) {
  if (storageSrc[i] === "{") depth++
  else if (storageSrc[i] === "}") {
    depth--
    if (depth === 0) {
      fnEnd = i
      break
    }
  }
}
const fnBody = storageSrc.slice(fnBrace, fnEnd + 1)
const lineOf = (i) => storageSrc.slice(0, fnBrace + i).split("\n").length
const bounds = [...fnBody.matchAll(/\n {2}(?:\} else )?if \(/g)].map(
  (m) => m.index + m[0].length - 1,
)

const branches = []
for (let i = 0; i < bounds.length; i++) {
  const chunk = fnBody.slice(bounds[i], i + 1 < bounds.length ? bounds[i + 1] : fnBody.length)
  const condEnd = chunk.indexOf(") {")
  if (condEnd < 0) continue
  const cond = chunk.slice(0, condEnd + 1)
  const body = chunk.slice(condEnd)
  const dirs = new Set()
  for (const c of body.matchAll(/await import\("([^"]+)"\)/g)) {
    const d = c[1].split("drivers/")[1]
    if (d) dirs.add(d.replace(/\/.*$/, ""))
  }
  for (const c of body.matchAll(/(?:new\s+(\w+)\s*\(|return\s+(get\w+Driver)\s*\()/g)) {
    const name = c[1] || c[2]
    if (classDir[name]) dirs.add(classDir[name])
  }
  let test = null
  try {
    const fn = new Function("n", `return (${cond.replace(/normDriver/g, "n")})`)
    fn("__probe__") // 引用了其它变量（如 !storageConfig）就放弃这个分支
    test = fn
  } catch {
    test = null
  }
  branches.push({ dirs: [...dirs], dir: [...dirs][0], test, line: lineOf(bounds[i]) })
}

function route(key) {
  const n = norm(key)
  for (const b of branches) {
    if (!b.dirs.length || !b.test) continue
    try {
      if (b.test(n)) return b.dir
    } catch {}
  }
  return null
}

// ---------- 驱动真正读取的字段 ----------
function tsAdditions(dir) {
  const p = path.join(ROOT, "src/backend/drivers", dir, "types.ts")
  if (!fs.existsSync(p)) return {}
  const src = fs.readFileSync(p, "utf8")
  const out = {}
  for (const m of src.matchAll(/(?:export )?interface (\w*Addition\w*)\s*\{([\s\S]*?)\n\}/g)) {
    const names = []
    let buf = null
    for (const rawLine of m[2].split("\n")) {
      const line = rawLine.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/, "").trim()
      if (!line) continue
      if (buf !== null) {
        buf += " " + line
        if (!line.endsWith("|")) {
          names.push(buf.match(/^(\w+)/)[1])
          buf = null
        }
        continue
      }
      if (!/^\w+\??\s*:/.test(line)) continue
      if (line.endsWith("|")) {
        buf = line
        continue
      }
      names.push(line.match(/^(\w+)/)[1])
    }
    out[m[1]] = names
  }
  return out
}

const problems = { route: [], dead: [], missing: [] }
for (const [key, cfg] of Object.entries(all)) {
  const dir = route(key)
  if (!dir) {
    problems.route.push(`${key}：createDriver 里没有任何分支认这个名字`)
    continue
  }
  const adds = tsAdditions(dir)
  const entries = Object.entries(adds)
  if (!entries.length) continue
  const cfgFields = (cfg.additional || []).map((f) => f.name)
  const best = entries
    .map(([name, fields]) => [
      name,
      fields,
      fields.filter((f) => cfgFields.includes(f)).length,
    ])
    .sort((a, b) => b[2] - a[2])[0]
  const dead = cfgFields.filter((f) => !best[1].includes(f))
  const missing = best[1].filter((f) => !cfgFields.includes(f))
  if (dead.length) problems.dead.push(`${key} (${dir}/${best[0]}) 界面上有、驱动不读: ${dead.join(", ")}`)
  if (missing.length)
    problems.missing.push(`${key} (${dir}/${best[0]}) 驱动要读、界面上没有: ${missing.join(", ")}`)
}

// ---------- 界面标签 ----------
const frontendArg = process.argv.find((a) => a.startsWith("--frontend="))
let labelReport = null
if (frontendArg) {
  const langDir = path.join(frontendArg.split("=")[1], "src/lang")
  if (!fs.existsSync(langDir)) {
    console.log(`跳过标签检查：${langDir} 不存在`)
  } else {
    const load = (rel) => JSON.parse(fs.readFileSync(path.join(langDir, rel), "utf8"))
    const en = load("en/drivers.json")
    const enStorages = load("en/storages.json")
    const missingLabels = []
    for (const [key, cfg] of Object.entries(all)) {
      const ns = en[key]
      if (!ns) {
        missingLabels.push(`${key}：语言包里没有这个驱动命名空间，整页字段会回落英文`)
        continue
      }
      for (const f of cfg.additional || []) {
        if (!ns[f.name]) missingLabels.push(`${key}.${f.name}`)
        if (f.help && !ns[`${f.name}-tips`]) missingLabels.push(`${key}.${f.name}-tips`)
        if (f.type === "select") {
          const group = ns[`${f.name}s`] || {}
          for (const o of String(f.options).split(","))
            if (!group[o]) missingLabels.push(`${key}.${f.name}s.${o}`)
        }
      }
    }
    labelReport = missingLabels
  }
}

// ---------- 报告 ----------
const total = problems.route.length + problems.dead.length + problems.missing.length
console.log(`驱动配置 ${Object.keys(all).length} 个（内联 ${Object.keys(inlineCfg).length} + 补充 ${Object.keys(extraCfg).length}）\n`)
console.log(`A. 路由不通: ${problems.route.length}`)
for (const p of problems.route) console.log("   ✗ " + p)
console.log(`B. 配置里有、驱动不读的字段: ${problems.dead.length}`)
for (const p of problems.dead) console.log("   ✗ " + p)
console.log(`C. 驱动要读、配置里没有的字段: ${problems.missing.length}`)
for (const p of problems.missing) console.log("   ✗ " + p)
if (labelReport) {
  console.log(`D. 缺界面标签: ${labelReport.length}`)
  for (const p of labelReport.slice(0, 50)) console.log("   ✗ " + p)
  if (labelReport.length > 50) console.log(`   …另有 ${labelReport.length - 50} 条`)
} else {
  console.log("D. 缺界面标签: 未检查（加 --frontend=<前端仓库目录> 可检查）")
}

if (total) {
  console.log(`\n有 ${total} 处问题：A 类会让驱动「选了跑不起来」，B/C 类会让驱动「配不起来」。`)
  process.exit(1)
}
console.log("\nA / B / C 三类全部通过。")
