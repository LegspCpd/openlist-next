/**
 * GET /storage-probe[?deep=1]
 *
 * EdgeOne 存储能力探测（边缘函数侧）。
 *
 * 背景：EdgeOne 上应用能用的持久化存储只有两种，且「是否可用」取决于
 * 控制台配置，代码无法提前知道：
 *   1. KV  —— 必须在控制台「KV 存储」创建命名空间并绑定到边缘函数，
 *              再在项目环境变量里配置（绑定名建议为 `KV`）。
 *              未绑定时 `resolveKv()` 返回 null。
 *   2. Blob —— `@edgeone/pages-blob` SDK，首次写入自动创建命名空间，
 *              零配置。归属当前 Pages 项目。
 *
 * 用户期望：**优先 KV，KV 不可用才落到 Blob**。本接口把这一判断暴露出来，
 * 供部署脚本（scripts/deploy-platform.mjs）与运维排查直接调用，
 * 不需要登录管理端。
 *
 * 安全：
 *   - 默认**只读**探测（对固定探针 key 做一次 get），不写入任何业务数据；
 *   - `?deep=1` 会额外做一次「写 → 读 → 删」往返（仍只用探针 key），
 *     该模式需要内部调用凭据（X-Internal-Call = JWT_SECRET），
 *     避免匿名请求刷写。
 *   - 不返回任何配置值或密钥，只返回布尔能力与变量名。
 */
import { authorize, json, resolveKvWithName } from "../_kv-proxy.js"

/** 固定探针 key：仅用于能力检测，不参与业务数据 */
const PROBE_KEY = "__openlist_storage_probe__"

/** Blob SDK 包名（EdgeOne Pages Blob，首次写入自动建库） */
const BLOB_SPEC = "@edgeone/pages-blob"

/**
 * KV 探测。
 *
 * @param env  边缘函数 env
 * @param deep 是否执行写/读/删往返
 * @param internalOk 调用方是否通过内部鉴权（deep 模式的门槛）
 */
async function probeKv(env, deep, internalOk) {
  const { kv, name } = resolveKvWithName(env)

  if (!kv) {
    return {
      available: false,
      binding: null,
      writable: null,
      error:
        "KV binding not found. Create a KV namespace in the EdgeOne console " +
        "and bind it to Edge Functions with the variable name `KV`.",
    }
  }

  // 读探测：不存在的 key 返回 null 即视为绑定可用
  let readable = false
  let readError = null
  try {
    await kv.get(PROBE_KEY, "text")
    readable = true
  } catch (e) {
    readError = e?.message || String(e)
  }

  const result = {
    available: readable,
    binding: name,
    writable: null,
    error: readable ? null : readError,
  }

  // 读不通就没有写可言
  if (!readable) return result

  // 只读模式到此为止（默认）
  if (!deep) return result

  // deep 模式必须持内部凭据 —— 写探针绝不能对匿名请求开放，
  // 否则任何人都能反复触发 KV 写入（消耗配额 / 产生计费）。
  if (!internalOk) {
    result.writable = null
    result.deepSkipped = "deep probe requires internal credentials"
    return result
  }

  // 写往返：put -> get -> delete，全部只用探针 key
  try {
    const value = `probe:${Date.now()}`
    await kv.put(PROBE_KEY, value)
    const back = await kv.get(PROBE_KEY, "text")
    await kv.delete(PROBE_KEY)
    result.writable = back === value
    if (!result.writable) {
      result.error = "KV write round-trip mismatch"
    }
  } catch (e) {
    result.writable = false
    result.error = e?.message || String(e)
  }

  return result
}

/**
 * Blob 探测（尽力而为）。
 *
 * 边缘函数侧能否直接解析 `@edgeone/pages-blob` 取决于平台打包器；
 * 解析失败时返回 available=null（未知）而不是 false —— 因为 Blob 的
 * 权威判定来自 Node 云函数（/api/public/env_check 的 storage.driver=blob）。
 */
async function probeBlob() {
  try {
    const mod = await import(/* @vite-ignore */ BLOB_SPEC)
    const getStore = mod?.getStore
    if (typeof getStore !== "function") {
      return {
        available: null,
        sdk: BLOB_SPEC,
        note: "SDK resolved but getStore() is unavailable in this runtime",
      }
    }
    try {
      const store = getStore("openlist")
      const ok = !!store && typeof store.get === "function"
      return {
        available: ok ? true : null,
        sdk: BLOB_SPEC,
        note: ok
          ? "zero-config; the store is created on first write"
          : "store object did not expose get()",
      }
    } catch (e) {
      return {
        available: null,
        sdk: BLOB_SPEC,
        note: "getStore() threw: " + (e?.message || String(e)),
      }
    }
  } catch (e) {
    return {
      available: null,
      sdk: BLOB_SPEC,
      note:
        "SDK not resolvable from an Edge Function (this is expected if it is " +
        "bundled only into the Node cloud function): " +
        (e?.message || String(e)),
    }
  }
}

export async function onRequest({ request, env }) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "Method not allowed, use GET" }, 405)
  }

  const { searchParams } = new URL(request.url)
  const deep = searchParams.get("deep") === "1"

  // deep 模式需要内部凭据；只读模式对匿名开放（不泄露任何配置值）
  let internalOk = false
  if (deep) {
    const auth = await authorize(request, env)
    internalOk = auth.ok && auth.mode === "internal"
  }

  const [kv, blob] = await Promise.all([
    probeKv(env, deep, internalOk),
    probeBlob(),
  ])

  // 优先级：KV 可用 → kv；否则 → blob。
  //
  // 为什么 KV 不可用时也直接推荐 blob 而不是 null：EdgeOne 上 Blob 是
  // `@edgeone/pages-blob` 的零配置能力，首次写入自动建库，不需要任何控制台
  // 操作 —— 它就是「KV 没用上时的答案」。用 confidence 区分「已验证」与
  // 「按平台约定推定」，而不是给出一个没用的 null。
  let recommended = null
  let confidence = null
  if (kv.available) {
    recommended = "kv"
    confidence = "confirmed"
  } else if (blob.available === true) {
    recommended = "blob"
    confidence = "confirmed"
  } else {
    recommended = "blob"
    confidence = "assumed"
  }

  const hints = []
  if (recommended === "kv") {
    hints.push(
      "KV is available and preferred. Keep DB_DRIVER=auto, or pin " +
        "DB_DRIVER=kv with DB_FORMAT=map (fewest KV sub-requests).",
    )
  } else {
    hints.push(
      "KV is not bound. Either (a) create a KV namespace in the EdgeOne " +
        "console and bind it to Edge Functions as `KV`, then redeploy; or " +
        "(b) do nothing — Blob is zero-config and will be used automatically " +
        "(`@edgeone/pages-blob` creates the store on first write).",
    )
  }
  if (blob.available === null) {
    hints.push(
      "Blob could not be probed from the edge layer; rely on " +
        "/api/public/env_check (Node function) for the authoritative test.",
    )
  }

  return json({
    platform: "edgeone-pages/functions",
    probeKey: PROBE_KEY,
    deep,
    kv,
    blob,
    recommended,
    /** confirmed = 已实测；assumed = 按 EdgeOne 零配置约定推定 */
    recommendedConfidence: confidence,
    dbDriverCandidates: [recommended, "auto"],
    hints,
  })
}
