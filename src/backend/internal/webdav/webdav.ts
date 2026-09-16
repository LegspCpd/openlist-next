import { generateWebDavXml } from "../../pkg/utils"

export interface WebDavItem {
  name: string
  size: number
  isFolder: boolean
  modified: string
  /** 由 etagForFileItem 派生（RFC 9110 §8.8.3） */
  etag?: string
  contentType?: string
}

export function buildWebDavPropfindResponse(
  reqPath: string,
  items: WebDavItem[],
  self?: { modified?: string; etag?: string },
): string {
  return generateWebDavXml(reqPath, items, self)
}
