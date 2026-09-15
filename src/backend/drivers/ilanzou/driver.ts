// 蓝奏云 i 版（apis.ilanzou.com）驱动。
// 用途：登录后浏览/下载/管理 i 版网盘，直链在 get 时通过 AES 签名 + 跟随重定向解析并填进 raw_url。
// 关键配置项：username、password（必填），ip（可选，用于 X-Forwarded-For），root_id（默认 "0"）。
// 注意：直链解析需要一次网络请求（跟随 CDN 重定向），因此仅在 get 单个文件时解析 raw_url，
// 列表阶段不逐条解析（避免对目录内每个文件发起请求），下载时由 /api/p 调用 get 解析。
import {
  StorageDriver,
  FileItem,
  calcFileType,
} from "../../internal/driver/base"
import { sortFileItems } from "../../internal/driver/sort"
import { ILanZouAddition, ListItem } from "./types"
import { ILanZouClient } from "./util"

export function normalizeILanZouAddition(a: any): ILanZouAddition {
  const norm = { ...(a || {}) } as any
  norm.root_id = (norm.root_id || "0").toString().trim() || "0"
  norm.username = (norm.username || "").trim()
  norm.password = (norm.password || "").trim()
  norm.ip = (norm.ip || "").trim()
  norm.token = norm.token || ""
  norm.uuid = norm.uuid || ""
  return norm as ILanZouAddition
}

type PersistCallback = (addition: ILanZouAddition) => void | Promise<void>

export class ILanZouDriver implements StorageDriver {
  private addition: ILanZouAddition
  private client: ILanZouClient
  private onPersist?: PersistCallback

  constructor(addition: ILanZouAddition, onPersist?: PersistCallback) {
    this.addition = normalizeILanZouAddition(addition)
    this.client = new ILanZouClient(this.addition)
    this.onPersist = onPersist
  }

  async init(): Promise<void> {
    await this.client.init()
    // 把自动获取的 uuid / token 同步回 addition，便于上层持久化
    this.addition.uuid = this.client.uuid
    this.addition.token = this.client.token
    if (this.onPersist) {
      try {
        await this.onPersist(this.getPersistAddition())
      } catch (e) {
        console.warn("[ILanZou] persist callback failed:", e)
      }
    }
  }

  /** 暴露 uuid/token 供上层持久化（与 115/baidu 等驱动的回调模式一致） */
  getPersistAddition(): ILanZouAddition {
    return {
      ...this.addition,
      uuid: this.client.uuid,
      token: this.client.token,
    }
  }

  async list(_virtualPath: string, physicalPath: string): Promise<FileItem[]> {
    const folderId = await this.client.resolveFolderId(
      physicalPath,
      this.addition.root_id,
    )
    const items = await this.client.listDir(folderId)
    const fileItems = items.map((it) => itemToFileItem(it))
    return sortFileItems(fileItems, "name", "asc")
  }

  async get(_virtualPath: string, physicalPath: string): Promise<FileItem> {
    const node = await this.client.getNode(physicalPath, this.addition.root_id)
    const item = itemToFileItem(node)
    if (!item.is_dir) {
      try {
        const link = await this.client.getLink(String(node.fileId))
        item.raw_url = link.url
        // 部分 CDN 需要 Referer 才能下载，随直链带上
        item.raw_url_headers = {
          Referer: this.client.conf.site + "/",
          Origin: this.client.conf.site,
        }
      } catch (e) {
        item.raw_url_error = (e as Error).message
      }
    }
    return item
  }

  async mkdir(
    _virtualPath: string,
    physicalPath: string,
  ): Promise<void> {
    const { parentPath, name } = splitPath(physicalPath)
    const parentId = await this.client.resolveFolderId(
      parentPath,
      this.addition.root_id,
    )
    await this.client.mkdir(parentId, name)
  }

  async rename(
    _virtualPath: string,
    physicalPath: string,
    newName: string,
  ): Promise<void> {
    const node = await this.client.getNode(physicalPath, this.addition.root_id)
    if (node.fileType === 2) {
      await this.client.renameFolder(String(node.folderId), newName)
    } else {
      await this.client.renameFile(String(node.fileId), newName)
    }
  }

  async remove(
    _virtualPath: string,
    physicalPath: string,
    _names: string[],
  ): Promise<void> {
    const node = await this.client.getNode(physicalPath, this.addition.root_id)
    if (node.fileType === 2) {
      await this.client.remove(null, String(node.folderId))
    } else {
      await this.client.remove(String(node.fileId), null)
    }
  }

  async move(
    _srcDir: string,
    _dstDir: string,
    _names: string[],
    srcPhys: string,
    dstPhys: string,
  ): Promise<void> {
    const node = await this.client.getNode(srcPhys, this.addition.root_id)
    const targetId = await this.client.resolveFolderId(
      dstPhys,
      this.addition.root_id,
    )
    if (node.fileType === 2) {
      await this.client.move(null, String(node.folderId), targetId)
    } else {
      await this.client.move(String(node.fileId), null, targetId)
    }
  }

  async copy(): Promise<void> {
    // iLanzou 没有服务端复制原语，与上游 Go 版一致返回未实现（由上层 CopyTaskManager 兜底）
    throw new Error("[ilanzou] 不支持服务端复制")
  }

  async put(
    _virtualPath: string,
    physicalPath: string,
    content: Buffer | Uint8Array,
  ): Promise<void> {
    const { parentPath, name } = splitPath(physicalPath)
    const parentId = await this.client.resolveFolderId(
      parentPath,
      this.addition.root_id,
    )
    const bytes =
      content instanceof Uint8Array ? content : new Uint8Array(content)
    await this.client.put(parentId, name, bytes)
  }
}

function splitPath(physicalPath: string): { parentPath: string; name: string } {
  const parts = physicalPath.split("/").filter(Boolean)
  const name = parts.pop() || "upload"
  return { parentPath: "/" + parts.join("/"), name }
}

function itemToFileItem(it: ListItem): FileItem {
  const isDir = it.fileType === 2
  const modified = parseTime(it.updTime)
  return {
    name: isDir ? it.folderName || "folder" : it.fileName || "file",
    size: isDir ? 0 : (it.fileSize || 0) * 1024,
    is_dir: isDir,
    modified,
    sign: String(isDir ? it.folderId : it.fileId),
    type: calcFileType(isDir ? it.folderName || "" : it.fileName || "", isDir),
    thumb: it.fileIcon || "",
  }
}

function parseTime(s?: string): string {
  if (!s) return new Date().toISOString()
  const d = new Date(s.replace(" ", "T"))
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}
