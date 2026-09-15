/**
 * GET /kv-list?prefix=xxx
 *
 * 列出 KV 键。需通过鉴权（内部调用标识 或 管理员 JWT）。
 *
 * EdgeOne KV list() 语义（兼容两种官方文档说法）：
 *   形态 A：page.keys -> [{ key, ttl, meta }]，下一页 cursor 需手动取本页最后一个 key
 *   形态 B：page.keys -> [{ name }]，page.cursor 为下一页游标
 * 二者只差字段名，这里统一归一化：元素名取 `key ?? name`，
 * 下一页游标优先用 `page.cursor`，缺失时回退为末个元素名。
 *
 * 分页加固：
 *   - 重复页检测：若本页首个名字与上一页相同，说明 cursor 未生效
 *     （或平台语义变化），立即终止，避免返回大量重复项；
 *   - 结果去重，保证上游看到的键集合唯一。
 */
import { authorize, deny, json, kvMissing, resolveKv } from "../_kv-proxy.js"

/** 归一化单个 key 条目：兼容 { key } / { name } / 裸字符串 */
function keyNameOf(item) {
  if (typeof item === "string") return item
  if (!item || typeof item !== "object") return null
  const name = item.key ?? item.name
  return typeof name === "string" && name ? name : null
}

export async function onRequest({ request, env }) {
  const auth = await authorize(request, env)
  if (!auth.ok) return deny(auth)

  const kv = resolveKv(env)
  if (!kv) return kvMissing()

  const { searchParams } = new URL(request.url)
  const prefix = searchParams.get("prefix") || ""

  try {
    const seen = new Set()
    let cursor = ""
    let complete = false
    let guard = 0
    let prevFirstKey = null

    // 安全阀：防止异常情况下无限循环
    while (!complete && guard < 1000) {
      guard += 1

      const page = await kv.list({ prefix, cursor, limit: 256 })
      const pageKeys = Array.isArray(page?.keys) ? page.keys : []

      if (pageKeys.length === 0) {
        complete = true
        break
      }

      const firstKey = keyNameOf(pageKeys[0])
      // 重复页检测：cursor 未推进（或平台语义变化）时立即终止
      if (firstKey !== null && firstKey === prevFirstKey) {
        console.warn(
          "[kv-list] repeated page detected; stopping pagination " +
            "to avoid returning duplicates",
        )
        break
      }
      prevFirstKey = firstKey

      for (const item of pageKeys) {
        const name = keyNameOf(item)
        if (name) seen.add(name)
      }

      // 优先使用平台返回的 cursor；老语义下回退为末个 key 名
      const nextCursor = page?.cursor
      cursor =
        typeof nextCursor === "string" && nextCursor
          ? nextCursor
          : keyNameOf(pageKeys[pageKeys.length - 1]) || ""
      complete = Boolean(page?.complete)
    }

    return json({ keys: [...seen] })
  } catch (err) {
    return json({ error: err?.message || String(err) }, 500)
  }
}
