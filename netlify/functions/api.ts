/**
 * Netlify Function 入口（Functions v2，Web 标准 Request/Response）。
 *
 * 为什么用 config.path 而不是 netlify.toml 的 redirect：
 *   redirect 会把 req.url 重写成 /.netlify/functions/api/...，后端路由
 *   （/api/fs/list、/dav/...）就拿不到原始路径了。用 config.path 挂载，
 *   Function 收到的 URL 与浏览器请求一致。
 *
 * 运行环境：AWS Lambda（Node.js），无持久化磁盘，必须配置外部存储：
 *   DATABASE_URL / SUPABASE_URL / UPSTASH_REDIS_REST_URL 等。
 */
import backendApp from "../../src/backend/index"

export default async (req: Request, context: any) => {
  // Netlify 把环境变量注入 process.env；第三个参数是平台上下文（waitUntil 等）
  return backendApp.fetch(req, process.env as any, context)
}

/** 挂载路径：API 与 WebDAV 都交给本 Function。 */
export const config = {
  path: ["/api/*", "/dav/*", "/p/*"],
}
