/**
 * 极简 MIME 推断。
 *
 * 用于 WebDAV / S3 网关返回 `getcontenttype` 与 `Content-Type`：
 * 这两个协议此前直接把 `FileItem.type` 塞进 Content-Type，而那是**数字枚举**
 * （1=FOLDER、2=VIDEO…），于是响应里出现 `Content-Type: 2` 这种非法值。
 */

const MIME_BY_EXT: Record<string, string> = {
  // 文本 / 文档
  txt: "text/plain; charset=utf-8",
  log: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  pdf: "application/pdf",
  // 图片
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  avif: "image/avif",
  heic: "image/heic",
  // 音视频
  mp3: "audio/mpeg",
  flac: "audio/flac",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  opus: "audio/opus",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mkv: "video/x-matroska",
  webm: "video/webm",
  avi: "video/x-msvideo",
  mov: "video/quicktime",
  wmv: "video/x-ms-wmv",
  flv: "video/x-flv",
  ts: "video/mp2t",
  // 压缩包
  zip: "application/zip",
  gz: "application/gzip",
  tar: "application/x-tar",
  "7z": "application/x-7z-compressed",
  rar: "application/vnd.rar",
}

/** 按文件名后缀推断 MIME；未知则返回 application/octet-stream */
export function mimeForName(name: string): string {
  const idx = String(name || "").lastIndexOf(".")
  if (idx < 0 || idx === String(name).length - 1) {
    return "application/octet-stream"
  }
  const ext = String(name).slice(idx + 1).toLowerCase()
  return MIME_BY_EXT[ext] || "application/octet-stream"
}
