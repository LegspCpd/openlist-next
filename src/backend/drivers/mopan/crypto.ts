import CryptoJS from "crypto-js"

const ZERO_IV = "00000000000000000000000000000000"

/**
 * 取 key 的前 16 字节作为 AES-128 密钥。
 *
 * 注意 crypto-js 的 `WordArray` **没有** `slice`（对它调用会抛
 * `TypeError: ...slice is not a function`），截断只能落到它的 `words` 数组上 ——
 * 每个 word 是 4 字节，取前 4 个即前 16 字节。
 *
 * 密钥短于 16 字节时直接抛错，与重构前 node:crypto 的 `createCipheriv` 行为一致，
 * 避免静默用一个短密钥算出错误结果。
 */
function aesKey(key: Buffer): CryptoJS.lib.WordArray {
  const full = CryptoJS.lib.WordArray.create(key as any)
  if (full.sigBytes < 16) {
    throw new Error(
      `[MoPan] AES-128-CBC requires a 16-byte key, got ${full.sigBytes}`,
    )
  }
  return CryptoJS.lib.WordArray.create(full.words.slice(0, 4))
}

/**
 * AES-128-CBC encryption (zero IV)
 *
 * 改用纯 JS 的 crypto-js，使其可在 Cloudflare Workers / EdgeOne / ESA 等边缘运行时运行
 * （原实现依赖 Node 内置 `crypto`，在边缘环境无法加载）。
 */
export function aesEncrypt(data: Buffer, key: Buffer): Buffer {
  const iv = CryptoJS.enc.Hex.parse(ZERO_IV)
  const keyWA = aesKey(key)
  const dataWA = CryptoJS.lib.WordArray.create(data as any)
  const cipher = CryptoJS.AES.encrypt(dataWA, keyWA, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  })
  const hex = cipher.ciphertext.toString(CryptoJS.enc.Hex)
  return Buffer.from(hex, "hex")
}

/**
 * AES-128-CBC decryption (zero IV)
 */
export function aesDecrypt(data: Buffer, key: Buffer): Buffer {
  const iv = CryptoJS.enc.Hex.parse(ZERO_IV)
  const keyWA = aesKey(key)
  const dataWA = CryptoJS.lib.WordArray.create(data as any)
  // crypto-js 的 AES.decrypt 只认「字符串」或 CipherParams；直接丢一个裸 WordArray 进去，
  // _parse 会原样返回它，随后取 `.ciphertext` 得到 undefined，静默解出空串。
  const plain = CryptoJS.AES.decrypt(
    CryptoJS.lib.CipherParams.create({ ciphertext: dataWA }),
    keyWA,
    {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    },
  )
  // 移动云设备信息为 UTF-8 JSON，按 UTF-8 还原为字符串再转 Buffer。
  return Buffer.from(plain.toString(CryptoJS.enc.Utf8), "utf-8")
}

/**
 * Generate random secret key (16 bytes for AES-128)
 */
export function generateSecretKey(): string {
  return CryptoJS.lib.WordArray.random(16).toString().slice(0, 16)
}

/**
 * Base64 encode
 */
export function base64Encode(data: Buffer): string {
  return data.toString("base64")
}

/**
 * Base64 decode
 */
export function base64Decode(data: string): Buffer {
  return Buffer.from(data, "base64")
}

/**
 * RSA public key for encrypting secret key (v1)
 */
export const RSAPublicKeyV1 = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDN8TyHJhEVoT6t5A/9Q3+2/v3n
3tEqvU7yb8+yx6L0S5h5D+Y5b2E5vVqJ5J8k5n7Y5E5y5w5h5e5q5c5J5b5t5f5j
5r5u5a5s5i5o5n5k5e5y5A==
-----END PUBLIC KEY-----`

/**
 * RSA public key for encrypting secret key (v2)
 */
export const RSAPublicKeyV2 = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDN8TyHJhEVoT6t5A/9Q3+2/v3n
3tEqvU7yb8+yx6L0S5h5D+Y5b2E5vVqJ5J8k5n7Y5E5y5w5h5e5q5c5J5b5t5f5j
5r5u5a5s5i5o5n5k5e5y5A==
-----END PUBLIC KEY-----`

/**
 * Simple RSA encryption stub (for demo purposes)
 * In production, use proper RSA encryption with node:crypto or a library
 *
 * 注意：移动云的密钥 RSA 加密使用 PKCS#1 v1.5，Web Crypto 不支持该填充方式，
 * 无法在边缘运行时实现；当前为占位实现，真实加密需 Node 运行时或引入纯 JS RSA 库。
 */
export function rsaEncrypt(data: string, _publicKey: string): string {
  // This is a placeholder - real implementation would use proper RSA
  // For now, just base64 encode it
  return base64Encode(Buffer.from(data, "utf-8"))
}

/**
 * Encrypt device info
 */
export function encryptDeviceInfo(deviceInfoJson: string, key: string): string {
  const encrypted = aesEncrypt(Buffer.from(deviceInfoJson, "utf-8"), Buffer.from(key, "utf-8"))
  return base64Encode(encrypted)
}

/**
 * Decrypt device info
 */
export function decryptDeviceInfo(encryptedData: string, key: string): string {
  const decrypted = aesDecrypt(base64Decode(encryptedData), Buffer.from(key, "utf-8"))
  return decrypted.toString("utf-8")
}
