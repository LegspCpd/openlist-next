/**
 * XML generation utilities for OpenList protocols (WebDAV, S3).
 */

/** 转义 XML 文本节点/属性值中的特殊字符 */
export function escapeXml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export interface WebDavXmlItem {
  name: string
  size: number
  isFolder: boolean
  modified: string
  /** 由 etagForFileItem 派生；传给客户端后可用于 If-Match / If-None-Match */
  etag?: string
  /** 文件的 MIME 类型；缺省按 application/octet-stream 输出 */
  contentType?: string
}

/**
 * 生成 PROPFIND 的 multistatus 响应。
 *
 * @param path  请求路径（href 前缀），集合自身也会出现在结果里
 * @param items 集合的子项；Depth: 0 时传空数组
 * @param self  集合自身的元数据——旧实现这里直接输出 `new Date()`，
 *              导致目录的 getlastmodified 每次请求都在变（上游 issue #3065 同类问题）
 */
export function generateWebDavXml(
  path: string,
  items: WebDavXmlItem[],
  self?: { modified?: string; etag?: string },
): string {
  const asHttpDate = (v?: string): string => {
    if (!v) return new Date(0).toUTCString()
    const t = new Date(v)
    return Number.isFinite(t.getTime()) ? t.toUTCString() : new Date(0).toUTCString()
  }

  let xml = `<?xml version="1.0" encoding="utf-8" ?>\n`
  xml += `<d:multistatus xmlns:d="DAV:">\n`

  // Current folder description
  xml += `  <d:response>\n`
  xml += `    <d:href>${escapeXml(path)}</d:href>\n`
  xml += `    <d:propstat>\n`
  xml += `      <d:prop>\n`
  xml += `        <d:resourcetype><d:collection/></d:resourcetype>\n`
  xml += `        <d:getlastmodified>${asHttpDate(self?.modified)}</d:getlastmodified>\n`
  if (self?.etag) {
    xml += `        <d:getetag>${escapeXml(self.etag)}</d:getetag>\n`
  }
  xml += `      </d:prop>\n`
  xml += `      <d:status>HTTP/1.1 200 OK</d:status>\n`
  xml += `    </d:propstat>\n`
  xml += `  </d:response>\n`

  // Children
  for (const item of items) {
    const itemHref = `${path}${path.endsWith("/") ? "" : "/"}${encodeURIComponent(item.name)}`
    xml += `  <d:response>\n`
    xml += `    <d:href>${escapeXml(itemHref)}</d:href>\n`
    xml += `    <d:propstat>\n`
    xml += `      <d:prop>\n`
    if (item.isFolder) {
      xml += `        <d:resourcetype><d:collection/></d:resourcetype>\n`
    } else {
      xml += `        <d:resourcetype/>\n`
      xml += `        <d:getcontentlength>${Number(item.size || 0)}</d:getcontentlength>\n`
      xml += `        <d:getcontenttype>${escapeXml(item.contentType || "application/octet-stream")}</d:getcontenttype>\n`
    }
    xml += `        <d:getlastmodified>${asHttpDate(item.modified)}</d:getlastmodified>\n`
    if (item.etag) {
      xml += `        <d:getetag>${escapeXml(item.etag)}</d:getetag>\n`
    }
    xml += `      </d:prop>\n`
    xml += `      <d:status>HTTP/1.1 200 OK</d:status>\n`
    xml += `    </d:propstat>\n`
    xml += `  </d:response>\n`
  }

  xml += `</d:multistatus>`
  return xml
}
