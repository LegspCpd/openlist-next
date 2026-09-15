/**
 * S3 兼容对象存储驱动（KV 语义）。
 *
 * 用标准的 AWS Signature V4 手工签名，因此**不依赖任何 SDK**，可以直接跑在
 * Cloudflare Workers 上。适用对象：
 *   - AWS S3
 *   - Cloudflare R2（走 S3 API，便于跨账号/跨实例）
 *   - MinIO / Ceph
 *   - Backblaze B2（S3 兼容端点）
 *   - 其他 S3 兼容存储
 *
 * 环境变量：
 *   - S3_BUCKET（必需）
 *   - S3_ACCESS_KEY_ID / AWS_ACCESS_KEY_ID（必需）
 *   - S3_SECRET_ACCESS_KEY / AWS_SECRET_ACCESS_KEY（必需）
 *   - S3_REGION（默认 us-east-1）
 *   - S3_ENDPOINT（自建/第三方端点；不填则按 AWS 官方域名拼接）
 *   - S3_PREFIX（可选，键前缀）
 *   - S3_PATH_STYLE（默认 true：{endpoint}/{bucket}/{key}；设 false 用虚拟主机风格）
 *
 * 仅支持 map / key 格式。
 */
import type { Driver } from "../types"
import { envValue } from "../dsn"

interface S3Config {
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  endpoint: string | null
  prefix: string
  pathStyle: boolean
}

const UNSIGNED_PAYLOAD_SHA =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" // sha256("")

function resolve(env?: any): S3Config | null {
  const bucket = envValue(env, "S3_BUCKET", "AWS_S3_BUCKET", "BUCKET_NAME")
  if (!bucket) return null

  const accessKeyId = envValue(env, "S3_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID")
  const secretAccessKey = envValue(
    env,
    "S3_SECRET_ACCESS_KEY",
    "AWS_SECRET_ACCESS_KEY",
  )
  if (!accessKeyId || !secretAccessKey) return null

  const endpoint = envValue(env, "S3_ENDPOINT", "AWS_S3_ENDPOINT") || null

  return {
    bucket,
    region: envValue(env, "S3_REGION", "AWS_REGION", "AWS_DEFAULT_REGION") || "us-east-1",
    accessKeyId,
    secretAccessKey,
    endpoint,
    prefix: envValue(env, "S3_PREFIX") || "",
    // 自建/第三方端点默认用 path style（R2、MinIO 都是这种）
    pathStyle: envValue(env, "S3_PATH_STYLE").toLowerCase() !== "false",
  }
}

// ── 加密原语（Web Crypto，Workers 原生支持） ──────────────────────────────

const encoder = new TextEncoder()

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let out = ""
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0")
  }
  return out
}

async function sha256Hex(data: string | ArrayBuffer): Promise<string> {
  const buf =
    typeof data === "string" ? (encoder.encode(data) as unknown as ArrayBuffer) : data
  return toHex(await crypto.subtle.digest("SHA-256", buf))
}

async function hmac(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  return await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data))
}

async function hmacHex(key: ArrayBuffer, data: string): Promise<string> {
  return toHex(await hmac(key, data))
}

// ── SigV4 ────────────────────────────────────────────────────────────────

/** URI 编码，但保留 `/`（S3 canonical URI 要求）。 */
function encodePath(path: string): string {
  return path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/")
}

function encodeRfc3986(s: string): string {
  return encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  )
}

function amzDate(d: Date): { date: string; datetime: string } {
  const iso = d.toISOString().replace(/[:-]|\.\d{3}/g, "")
  return { date: iso.slice(0, 8), datetime: iso }
}

async function buildUrl(cfg: S3Config, key: string): Promise<{ url: string; host: string; path: string }> {
  const objectPath = `/${cfg.bucket}/${encodePath(cfg.prefix + key).replace(/^\//, "")}`

  if (cfg.endpoint) {
    const base = cfg.endpoint.replace(/\/+$/, "")
    if (cfg.pathStyle) {
      const u = new URL(base)
      return {
        url: `${base}${objectPath}`,
        host: u.host,
        path: objectPath,
      }
    }
    const u = new URL(base)
    const host = `${cfg.bucket}.${u.host}`
    const path = `/${encodePath(cfg.prefix + key).replace(/^\//, "")}`
    return { url: `${u.protocol}//${host}${path}`, host, path }
  }

  const host = `${cfg.bucket}.s3.${cfg.region}.amazonaws.com`
  const path = `/${encodePath(cfg.prefix + key).replace(/^\//, "")}`
  return { url: `https://${host}${path}`, host, path }
}

/**
 * 签名并发送 S3 请求。
 */
async function s3Request(
  cfg: S3Config,
  method: "GET" | "PUT" | "DELETE",
  key: string,
  query: Record<string, string> = {},
  body?: string,
): Promise<Response> {
  const { url, host, path } = await buildUrl(cfg, key)
  const { date, datetime } = amzDate(new Date())

  const payloadHash = body ? await sha256Hex(body) : UNSIGNED_PAYLOAD_SHA

  // query 必须按 key 字典序排列
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${encodeRfc3986(k)}=${encodeRfc3986(query[k])}`)
    .join("&")

  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": datetime,
  }

  const contentType = body ? "application/octet-stream" : ""
  if (contentType) headers["content-type"] = contentType

  const signedHeaders = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort()
    .join(";")

  const canonicalHeaders = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort()
    .map((k) => `${k}:${String(headers[k]).trim()}\n`)
    .join("")

  const canonicalRequest = [
    method,
    path,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n")

  const scope = `${date}/${cfg.region}/s3/aws4_request`
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    datetime,
    scope,
    await sha256Hex(canonicalRequest),
  ].join("\n")

  // 签名密钥派生：kDate → kRegion → kService → kSigning
  const kDate = await hmac(encoder.encode(`AWS4${cfg.secretAccessKey}`) as unknown as ArrayBuffer, date)
  const kRegion = await hmac(kDate, cfg.region)
  const kService = await hmac(kRegion, "s3")
  const kSigning = await hmac(kService, "aws4_request")
  const signature = await hmacHex(kSigning, stringToSign)

  headers["authorization"] =
    `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`

  const finalUrl = canonicalQuery ? `${url}?${canonicalQuery}` : url

  return fetch(finalUrl, {
    method,
    headers,
    ...(body ? { body } : {}),
  })
}

/**
 * 从 ListObjectsV2 的 XML 里提取 key 与分页信息。
 *
 * Workers 没有 DOMParser，这里用正则提取足够用（S3 的 key 不会跨行嵌套）。
 */
function parseListXml(xml: string): { keys: string[]; truncated: boolean; token: string } {
  const keys: string[] = []
  const keyRe = /<Key>([\s\S]*?)<\/Key>/g
  let m: RegExpExecArray | null
  while ((m = keyRe.exec(xml)) !== null) {
    keys.push(decodeXml(m[1]))
  }

  const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml)
  const tokenMatch = /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)
  return { keys, truncated, token: tokenMatch ? decodeXml(tokenMatch[1]) : "" }
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

export const s3Driver: Driver = {
  name: "s3",

  async isAvailable(env?: any): Promise<boolean> {
    return resolve(env) != null
  },

  async init(): Promise<void> {},

  async get(key: string, env?: any): Promise<string | null> {
    const cfg = resolve(env)
    if (!cfg) throw new Error("s3 is not configured")

    const res = await s3Request(cfg, "GET", key)
    if (res.status === 404) return null
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(`S3 GET failed: HTTP ${res.status} - ${body.slice(0, 300)}`)
    }
    return await res.text()
  },

  async put(key: string, value: string, env?: any): Promise<void> {
    const cfg = resolve(env)
    if (!cfg) throw new Error("s3 is not configured")

    const res = await s3Request(cfg, "PUT", key, {}, value)
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(`S3 PUT failed: HTTP ${res.status} - ${body.slice(0, 300)}`)
    }
  },

  async delete(key: string, env?: any): Promise<void> {
    const cfg = resolve(env)
    if (!cfg) throw new Error("s3 is not configured")

    const res = await s3Request(cfg, "DELETE", key)
    // S3 删除不存在的对象也返回 204，这里都视为成功
    if (!res.ok && res.status !== 404) {
      const body = await res.text().catch(() => "")
      throw new Error(`S3 DELETE failed: HTTP ${res.status} - ${body.slice(0, 300)}`)
    }
  },

  async list(prefix: string, env?: any): Promise<string[]> {
    const cfg = resolve(env)
    if (!cfg) throw new Error("s3 is not configured")

    const out: string[] = []
    let token = ""

    // ListObjectsV2 每次最多 1000 个，按 continuation token 翻页
    for (let i = 0; i < 1000; i++) {
      const query: Record<string, string> = {
        "list-type": "2",
        prefix: cfg.prefix + prefix,
      }
      if (token) query["continuation-token"] = token

      const res = await s3Request(cfg, "GET", "", query)
      if (!res.ok) {
        const body = await res.text().catch(() => "")
        throw new Error(`S3 LIST failed: HTTP ${res.status} - ${body.slice(0, 300)}`)
      }

      const xml = await res.text()
      const parsed = parseListXml(xml)
      for (const k of parsed.keys) out.push(k)
      if (!parsed.truncated || !parsed.token) break
      token = parsed.token
    }

    return cfg.prefix
      ? out.map((k) => (k.startsWith(cfg.prefix) ? k.slice(cfg.prefix.length) : k))
      : out
  },

  async health(env?: any): Promise<any> {
    const cfg = resolve(env)
    if (!cfg) {
      return {
        configured: false,
        connected: false,
        platform: "S3-compatible object storage",
        mode: "s3",
        error:
          "S3_BUCKET, S3_ACCESS_KEY_ID (or AWS_ACCESS_KEY_ID) and S3_SECRET_ACCESS_KEY are required",
      }
    }

    try {
      const res = await s3Request(cfg, "GET", "", {
        "list-type": "2",
        "max-keys": "1",
      })
      if (!res.ok) {
        const body = await res.text().catch(() => "")
        return {
          configured: true,
          connected: false,
          platform: "S3-compatible object storage",
          mode: "s3",
          error: `HTTP ${res.status} - ${body.slice(0, 300)}`,
        }
      }
      return {
        configured: true,
        connected: true,
        platform: "S3-compatible object storage",
        mode: "s3",
        note: "Object storage: DB_FORMAT=sql is not supported; use map or key.",
      }
    } catch (err: any) {
      return {
        configured: true,
        connected: false,
        platform: "S3-compatible object storage",
        mode: "s3",
        error: err?.message || String(err),
      }
    }
  },
}
