import { md5 } from "../../pkg/crypto"
import { LinkNode } from "./types"

/**
 * 由缩进文本构建目录树。文本结构定义（与 Go 版 BuildTree 一致）：
 *   FolderName:
 *     [FileSize:][Modified:]Url
 * 每行 2 个空格为一级缩进；目录行以 ":" 结尾，文件行必须包含 http(s):// 且
 * 文件名默认取 URL 最后一段（与上游行为一致：info 段只提供 size/modified）。
 */
export function buildTree(text: string): LinkNode {
  const lines = text.split("\n")
  const root: LinkNode = {
    url: "",
    name: "root",
    level: -1,
    modified: 0,
    size: 0,
    children: [],
  }
  const stack: LinkNode[] = [root]

  for (const rawLine of lines) {
    // 计算前导空格缩进
    let indent = 0
    while (indent < rawLine.length && rawLine[indent] === " ") indent++
    if (indent % 2 !== 0) {
      throw new Error(`[123Link] 缩进不是 2 的倍数: '${rawLine}'`)
    }
    const level = indent / 2
    const line = rawLine.slice(indent).trim()
    if (line === "") continue

    // 弹出栈顶，直到栈顶层级 < 当前层级
    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop()
    }

    if (isFolder(line)) {
      const node: LinkNode = {
        url: "",
        name: line.slice(0, -1),
        level,
        modified: 0,
        size: 0,
        children: [],
      }
      stack[stack.length - 1].children.push(node)
      stack.push(node)
    } else {
      const node = parseFileLine(line)
      node.level = level
      stack[stack.length - 1].children.push(node)
    }
  }

  return root
}

function isFolder(line: string): boolean {
  return line.endsWith(":")
}

/** 解析文件行：[FileSize:][Modified:]Url */
function parseFileLine(line: string): LinkNode {
  const hasHttp =
    line.includes("http://") || line.includes("https://")
  if (!hasHttp) {
    throw new Error(`[123Link] 无效行: '${line}'，文件行必须包含 http(s):// URL`)
  }
  let idx = line.indexOf("http://")
  if (idx === -1) idx = line.indexOf("https://")
  const url = line.slice(idx)
  const info = line.slice(0, idx)

  const node: LinkNode = {
    url,
    name: "",
    level: 0,
    modified: 0,
    size: 0,
    children: [],
  }

  // 文件名默认取 URL 最后路径段（与 Go 的 stdpath.Base 一致）
  let name = url.split("?")[0].split("#")[0]
  name = name.split("/").filter(Boolean).pop() || "file"
  try {
    name = decodeURIComponent(name)
  } catch {
    // 保留原始 name
  }
  node.name = name

  if (idx > 0) {
    if (!info.endsWith(":")) {
      throw new Error(`[123Link] 无效行: '${line}'，文件信息必须以 ':' 结尾`)
    }
    const infoBody = info.slice(0, -1)
    if (infoBody === "") {
      throw new Error(`[123Link] 无效行: '${line}'，文件名不能为空`)
    }
    const parts = infoBody.split(":")
    const size = Number(parts[0])
    if (!Number.isFinite(size) || Number.isNaN(size)) {
      throw new Error(`[123Link] 无效行: '${line}'，文件大小必须是整数`)
    }
    node.size = size
    if (parts.length > 1) {
      const modified = Number(parts[1])
      node.modified = Number.isFinite(modified) ? modified : Math.floor(Date.now() / 1000)
    } else {
      node.modified = Math.floor(Date.now() / 1000)
    }
  }

  return node
}

/** 把 "/a/b/c" 拆成 ["root","a","b","c"]，与 Go 的 splitPath 一致 */
export function splitPath(path: string): string[] {
  if (path === "/" || path === "") return ["root"]
  const parts = path.split("/")
  parts[0] = "root"
  return parts
}

/** 按路径在树中查找节点 */
export function nodeByPath(root: LinkNode, path: string): LinkNode | null {
  const parts = splitPath(path)
  return getByPath(root, parts)
}

function getByPath(node: LinkNode, paths: string[]): LinkNode | null {
  if (paths.length === 0 || !node) return null
  if (node.name !== paths[0]) return null
  if (paths.length === 1) return node
  for (const child of node.children) {
    const found = getByPath(child, paths.slice(1))
    if (found) return found
  }
  return null
}

/**
 * 对原始直链做 auth_key 签名（与 Go 的 SignURL 一致）。
 * 公式: auth_key = "{ts}-{rInt}-{uid}-{md5(path-ts-rInt-uid-privateKey)}"
 * 其中 ts = now + validDuration。privateKey 为空时直接透传原 URL。
 */
export function signUrl(
  originUrl: string,
  privateKey: string,
  uid: number,
  validDurationMin: number,
): string {
  if (!privateKey) return originUrl

  const ts = Math.floor(Date.now() / 1000) + Math.floor(validDurationMin * 60)
  // Go 的 rand.Int() 是非负整数；这里取 31 位正整数即可
  const rInt = Math.floor(Math.random() * 0x7fffffff)

  let path: string
  try {
    const u = new URL(originUrl)
    path = decodeURIComponent(u.pathname)
  } catch {
    path = originUrl
  }

  const md5sum = md5(`${path}-${ts}-${rInt}-${uid}-${privateKey}`)
  const authKey = `${ts}-${rInt}-${uid}-${md5sum}`

  const u = new URL(originUrl)
  u.searchParams.set("auth_key", authKey)
  return u.toString()
}
