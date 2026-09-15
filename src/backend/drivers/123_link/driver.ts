// 123 云盘直链 / 秒传链接解析驱动。
// 用途：把一组 123 网盘直链按缩进文本粘进来，驱动在内存建成目录树，列表/获取时
// 把每条直链用 auth_key 签名后填进 FileItem.raw_url（带 private_key 时签名，否则透传）。
// 关键配置项：origin_urls（URL 树文本）、private_key、uid、valid_duration（分钟）。
// 该驱动只读，不支持上传/删除等写操作（与上游 Go 版一致）。
import {
  StorageDriver,
  FileItem,
  calcFileType,
} from "../../internal/driver/base"
import { Link123Addition, LinkNode } from "./types"
import { buildTree, nodeByPath, signUrl } from "./util"

export function normalizeLink123Addition(a: any): Link123Addition {
  const norm = { ...(a || {}) } as any
  norm.origin_urls = (norm.origin_urls || "").trim()
  norm.private_key = (norm.private_key || "").trim()
  norm.uid = Number(norm.uid) || 0
  norm.valid_duration = Number(norm.valid_duration) || 30
  return norm as Link123Addition
}

export class Link123Driver implements StorageDriver {
  private addition: Link123Addition
  private root!: LinkNode

  constructor(addition: Link123Addition) {
    this.addition = normalizeLink123Addition(addition)
  }

  async init(): Promise<void> {
    if (!this.addition.origin_urls) {
      throw new Error("[123Link] origin_urls 不能为空")
    }
    this.root = buildTree(this.addition.origin_urls)
    // 递归汇总目录大小（与 Go 的 Node.calSize 一致）
    this.root.size = calSize(this.root)
  }

  async list(_virtualPath: string, physicalPath: string): Promise<FileItem[]> {
    const node = nodeByPath(this.root, physicalPath)
    if (!node) throw new Error(`[123Link] 路径不存在: ${physicalPath}`)
    if (node.url) throw new Error(`[123Link] '${physicalPath}' 不是目录`)

    const items: FileItem[] = node.children.map((child) =>
      nodeToFileItem(child, this.addition),
    )
    // 文件夹优先 + 按名称排序（AList 约定）
    items.sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1
      return String(a.name).localeCompare(String(b.name))
    })
    return items
  }

  async get(_virtualPath: string, physicalPath: string): Promise<FileItem> {
    const node = nodeByPath(this.root, physicalPath)
    if (!node) throw new Error(`[123Link] 路径不存在: ${physicalPath}`)
    return nodeToFileItem(node, this.addition)
  }

  async mkdir(): Promise<void> {
    throw new Error("[123Link] 只读驱动，不支持新建目录")
  }
  async rename(): Promise<void> {
    throw new Error("[123Link] 只读驱动，不支持重命名")
  }
  async remove(): Promise<void> {
    throw new Error("[123Link] 只读驱动，不支持删除")
  }
  async move(): Promise<void> {
    throw new Error("[123Link] 只读驱动，不支持移动")
  }
  async copy(): Promise<void> {
    throw new Error("[123Link] 只读驱动，不支持复制")
  }
  async put(): Promise<void> {
    throw new Error("[123Link] 只读驱动，不支持上传")
  }
}

function calSize(node: LinkNode): number {
  if (node.url) return node.size
  let size = 0
  for (const child of node.children) size += calSize(child)
  node.size = size
  return size
}

function nodeToFileItem(node: LinkNode, addition: Link123Addition): FileItem {
  const isDir = !node.url
  return {
    name: node.name,
    size: node.size,
    is_dir: isDir,
    modified: new Date((node.modified || 0) * 1000).toISOString(),
    sign: "",
    type: calcFileType(node.name, isDir),
    thumb: "",
    raw_url: isDir
      ? ""
      : signUrl(
          node.url,
          addition.private_key,
          addition.uid,
          addition.valid_duration,
        ),
  }
}
