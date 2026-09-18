// 189PC encryption utilities
//
// 边缘安全说明：原实现直接 `import { createCipheriv, randomBytes, publicEncrypt }`
// 来自 Node 内置 `crypto`，在 Cloudflare Workers / EdgeOne / ESA / Netlify 等无 Node
// 兼容模块的边缘运行时无法加载该模块，导致驱动整体不可用。
//
// 这里把「哈希 / HMAC / AES / 随机数」全部改用纯 JS 的 crypto-js（已是项目依赖，
// 可在任意边缘运行时打包运行）；仅 RSA 密码加密依赖 PKCS#1 v1.5，而 Web Crypto
// 不支持 PKCS1 v1.5 加密，故保留 Node 运行时专属的 `node:crypto`，并在边缘环境
// 给出清晰报错（登录步骤需要 Node，浏览/签名等其余功能已可在边缘运行）。
import CryptoJS from "crypto-js"

export async function encryptPassword(
  password: string,
  publicKey: string,
): Promise<string> {
  // RSA PKCS#1 v1.5 —— 仅 Node 运行时可用（Web Crypto 不支持 PKCS1 v1.5 加密）。
  const pemKey = `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`
  try {
    const SPEC: string = "node:crypto"
    const cryptoMod: any = await import(SPEC)
    const encrypted = cryptoMod.publicEncrypt(
      { key: pemKey, padding: 1 }, // padding: 1 = RSA_PKCS1_PADDING
      Buffer.from(password),
    )
    return encrypted.toString("hex")
  } catch {
    throw new Error(
      "[189pc] RSA password encryption requires Node.js runtime " +
        "(PKCS#1 v1.5 is not available in edge/serverless runtimes)",
    )
  }
}

export function generateDeviceId(): string {
  return CryptoJS.lib.WordArray.random(16).toString().toUpperCase()
}

export function encryptAES(data: string, key: string): string {
  const iv = CryptoJS.lib.WordArray.random(16)
  // 与 Node 端 `Buffer.from(key, "utf8").slice(0, 16)` 对齐：取 UTF-8 编码后的前 16 字节。
  // 注意 crypto-js 的 WordArray 没有 `slice`（对 WordArray 调用会抛 TypeError），
  // 截断只能落到它的 `words` 数组上 —— 每个 word 是 4 字节，取前 4 个即 16 字节。
  const parsedKey = CryptoJS.enc.Utf8.parse(key)
  if (parsedKey.sigBytes < 16) {
    // 与重构前 node:crypto 的 createCipheriv 一致：密钥短于 16 字节直接失败，不要静默降级。
    throw new Error(
      `[189pc] AES-128-CBC requires a 16-byte key, got ${parsedKey.sigBytes}`,
    )
  }
  const keyWA = CryptoJS.lib.WordArray.create(parsedKey.words.slice(0, 4))
  const cipher = CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(data), keyWA, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  })
  // 输出格式保持与 Node 一致：iv(hex) + ciphertext(hex)。
  return (
    iv.toString(CryptoJS.enc.Hex) +
    cipher.ciphertext.toString(CryptoJS.enc.Hex)
  )
}
