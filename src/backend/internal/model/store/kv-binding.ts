/**
 * KV binding 形态判定（全项目唯一实现）。
 *
 * 为什么单独成模块：同一判定有两处消费方 ——
 *   - store/json.ts      —— 密钥 / 注销名单 / 审计日志等既有 binding 调用方
 *   - store/driver/kv.ts —— Driver 接口（业务配置读写）
 * 两边各写一份曾导致口径漂移（一处把 RESP 客户端当 KV，另一处不当），
 * 而 json.ts ↔ driver/kv.ts 不能静态互相导入（会形成循环依赖），
 * 因此把判定下沉到这里。
 *
 * 背景（EdgeOne 的坑）：
 *   EdgeOne 的 KV **只对边缘函数（Edge Functions）提供 KV Web API**
 *   （get / put / delete / list）。Node 云函数（SCF）同样会看到一个名为
 *   `KV` 的对象，但那不是 KV Web API，而是 Redis/RESP 协议的客户端：
 *     - 连接未建立时抛 `Not connected`
 *     - 连上后按键访问也会抛 `cannot find the collection by name`
 *   它恰好也暴露 `get` / `set`，只按「有没有 get/set」判断会把它当成
 *   合法 KV binding —— 后果是驱动解析成功（日志显示 driver=kv、无报错），
 *   但每次读写都失败：`/api/public/*` 被存储拦截成 503，
 *   初始化还会因为退回内存态而在重试时误报 «system has already been
 *   initialized»。因此形态校验必须同时排除 RESP 客户端。
 */

/**
 * 是否具备 Redis / RESP 客户端的特征。
 *
 * 命中任一即判定「不是 KV Web API」。宁可漏判（退回 Blob 仍然可用），
 * 也不能误判成 binding（会让整站读写全部失败）。
 */
export function isRespClientLike(b: any): boolean {
  if (!b || typeof b !== "object") return false
  try {
    // node-redis v4 / ioredis 的核心方法；线上错误堆栈中出现的正是 sendCommand
    if (typeof b.sendCommand === "function") return true
    // 少数 shim 形态：{ status: "ready", send(cmd) {...} }
    if (typeof b.send === "function" && typeof b.status === "string") return true
    // ioredis 实例特征
    if (typeof b.duplicate === "function" && typeof b.disconnect === "function") {
      return true
    }
  } catch {
    // 属性访问本身抛异常（异常 getter / Proxy）→ 保守视为不可用
    return true
  }
  return false
}

/**
 * 判断对象是否是「可用的 KV Web binding」。
 *
 * 判定顺序有意为之：先排除 RESP 客户端，再看写接口。
 * 因为 RESP 客户端有 `set` 而没有 `put` —— 若先看形状、且把 `set` 也算数，
 * 它就会被放行（这正是历史 bug）。
 *
 * @returns true 表示可以按 KV Web API 使用（get + put/delete/list）
 */
export function isWebKvBinding(b: any): boolean {
  if (!b || typeof b !== "object") return false
  try {
    if (typeof b.get !== "function") return false
    if (isRespClientLike(b)) return false
    // KV Web API 的写接口：EdgeOne KV 与 Cloudflare KV 都是 `put`。
    // 保留 `set` 作为兼容形态（部分适配器只提供 set），
    // 但它排在 RESP 判定之后，所以 Redis 客户端不会被误放行。
    return typeof b.put === "function" || typeof b.set === "function"
  } catch {
    return false
  }
}

/** 只提示一次，避免每个请求都刷同一行日志 */
let _respWarningEmitted = false

/**
 * 按顺序探测候选绑定（通常为 `[env.KV, globalThis.KV]`），返回首个合法
 * KV Web binding；都不合法时返回 null。
 *
 * 额外职责：当候选里存在 RESP 客户端时打印一次可操作的告警 ——
 * 否则用户只能看到功能静默退化（或一堆 `Not connected`），
 * 完全不知道是自己把 KV 绑错了位置。
 */
export function probeWebKvBinding(candidates: any[]): any | null {
  for (const c of candidates) {
    if (isWebKvBinding(c)) return c
  }

  if (!_respWarningEmitted) {
    for (const c of candidates) {
      if (c && typeof c === "object" && isRespClientLike(c)) {
        _respWarningEmitted = true
        console.warn(
          "[KV] Ignoring the `KV` binding: it exposes a Redis/RESP client " +
            "(sendCommand), not the KV Web API (get/put/delete/list). " +
            "On EdgeOne, KV is only available to *Edge Functions*; a Node " +
            "cloud function must go through the /kv-* proxy (set DB_DRIVER=kv " +
            "+ JWT_SECRET) or fall back to Blob. " +
            "Falling back to the next available backend.",
        )
        break
      }
    }
  }

  return null
}
