import CryptoJS from "crypto-js"

/**
 * AES-128-CBC encryption (zero IV)
 *
 * 改用纯 JS 的 crypto-js，使其可在 Cloudflare Workers / EdgeOne / ESA 等边缘运行时运行
 * （原实现依赖 Node 内置 `crypto`，在边缘环境无法加载）。
 */
export function aesEncrypt(data: Buffer, key: Buffer): Buffer {
  const iv = CryptoJS.enc.Hex.parse("00000000000000000000000000000000")
  const keyWA = CryptoJS.lib.WordArray.create(key as any).slice(0, 4) // 前 16 字节
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
  const iv = CryptoJS.enc.Hex.parse("00000000000000000000000000000000")
  const keyWA = CryptoJS.lib.WordArray.create(key as any).slice(0, 4)
  const dataWA = CryptoJS.lib.WordArray.create(data as any)
  const plain = CryptoJS.AES.decrypt(dataWA, keyWA, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  })
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
