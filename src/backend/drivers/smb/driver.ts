import {
  calcFileType,
  FileItem,
  StorageDriver,
} from "../../internal/driver/base"
import { sortFileItems } from "../../internal/driver/sort"
import { SMBAddition } from "./types"

/**
 * SMB 驱动（仅 Node.js 容器模式）。
 *
 * SMB 协议依赖裸 TCP，无法在 Cloudflare Workers / 各边缘运行时运行，因此本驱动
 * 仅在 Node 运行时（Docker / `pnpm start`）加载。边缘运行时调用会明确抛错，
 * 而不是像旧实现那样**静默返回空结果**。
 *
 * 实现依赖 `smb2` 包（通过动态 import，仅在真正使用时加载）：
 *   - 已安装：正常工作（list / get / put / mkdir / remove / rename / move / copy）
 *   - 未安装：明确提示 `npm/pnpm add smb2`
 *
 * 注意：smb2 不提供 stat，本驱动通过「试探 readdir 是否成功」判定目录，
 * 大目录下略有额外往返；文件大小通过读取内容字节数得到。
 */
export class SMBDriver implements StorageDriver {
  private addition: SMBAddition
  private client: any = null
  private clientPromise: Promise<any> | null = null

  constructor(addition: SMBAddition) {
    this.addition = addition
  }

  private isNode(): boolean {
    return typeof process !== "undefined" && process.release?.name === "node"
  }

  private resolveShare(): string {
    const addr = (this.addition.address || "").replace(/^smb:\/\//i, "").replace(/\/+$/, "")
    const share = this.addition.share_name || ""
    return `\\\\${addr}\\${share}`
  }

  private async getClient(): Promise<any> {
    if (!this.isNode()) {
      throw new Error(
        "SMB storage driver requires Node.js runtime (raw TCP sockets not available in edge runtimes)",
      )
    }
    if (this.client) return this.client
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        let SMB2: any
        try {
          // smb2 是可选依赖，仅在 Node 运行时真正加载；用 string 类型变量作为导入
          // 说明符，让类型检查器在包缺失时不强制解析模块；构建侧已将其标记为 external。
          const SMB2_SPECIFIER: string = "smb2"
          const mod: any = await import(SMB2_SPECIFIER)
          SMB2 = mod.default || mod
        } catch {
          throw new Error(
            "SMB driver requires the 'smb2' package. Install it with: npm i smb2 (or pnpm add smb2)",
          )
        }
        const client = new SMB2({
          share: this.resolveShare(),
          domain: this.addition.domain || "",
          username: this.addition.username || "",
          password: this.addition.password || "",
          port: this.addition.port || 445,
          debug: false,
        })
        return client
      })()
    }
    this.client = await this.clientPromise
    return this.client
  }

  async init(): Promise<void> {
    if (!this.addition.address || !this.addition.share_name) {
      throw new Error("SMB: address and share_name are required")
    }
  }

  private cleanPath(p: string): string {
    const s = (p || "").split("/").filter(Boolean).join("/")
    const root = (this.addition.root_folder_path || "")
      .split("/")
      .filter(Boolean)
      .join("/")
    return root ? `${root}/${s}`.replace(/\/+/g, "/") : s
  }

  private async isDir(client: any, path: string): Promise<boolean> {
    try {
      await client.readdir(path || ".")
      return true
    } catch {
      return false
    }
  }

  async list(virtualPath: string, physicalPath: string): Promise<FileItem[]> {
    const client = await this.getClient()
    const dir = this.cleanPath(physicalPath) || "."
    let names: string[] = []
    try {
      names = await client.readdir(dir === "" ? "." : dir)
    } catch (err: any) {
      if (/ENOENT|no such file/i.test(String(err?.message || err))) return []
      throw err
    }

    const items: FileItem[] = []
    for (const name of names) {
      if (name === "." || name === "..") continue
      const childPath = dir === "." ? name : `${dir}/${name}`
      const isDir = await this.isDir(client, childPath)
      items.push({
        name,
        size: 0,
        is_dir: isDir,
        modified: new Date().toISOString(),
        sign: childPath || "/",
        type: calcFileType(name, isDir),
        raw_url: "",
      })
    }
    return sortFileItems(items, this.addition.order_by, this.addition.order_direction)
  }

  async get(virtualPath: string, physicalPath: string): Promise<FileItem> {
    const client = await this.getClient()
    const clean = this.cleanPath(physicalPath)
    if (clean === "") {
      return {
        name: "root",
        size: 0,
        is_dir: true,
        modified: new Date().toISOString(),
        sign: "/",
        type: 1,
        raw_url: "",
      }
    }
    const isDir = await this.isDir(client, clean)
    let size = 0
    let modified = new Date().toISOString()
    if (!isDir) {
      try {
        const buf: Buffer = await client.readFile(clean)
        size = buf.length
      } catch {
        // best-effort：读取失败不影响元数据返回
      }
    }
    const name = clean.split("/").filter(Boolean).pop() || "root"
    return {
      name,
      size,
      is_dir: isDir,
      modified,
      sign: clean,
      type: calcFileType(name, isDir),
      raw_url: "",
    }
  }

  async mkdir(virtualPath: string, physicalPath: string): Promise<void> {
    const client = await this.getClient()
    const dir = this.cleanPath(physicalPath)
    await client.mkdir(dir)
  }

  async rename(
    virtualPath: string,
    physicalPath: string,
    newName: string,
  ): Promise<void> {
    const client = await this.getClient()
    const dir = this.cleanPath(physicalPath)
    const parent = dir.includes("/") ? dir.slice(0, dir.lastIndexOf("/")) : ""
    const oldPath = dir
    const newPath = parent ? `${parent}/${newName}` : newName
    await client.rename(oldPath, newPath)
  }

  async remove(
    virtualPath: string,
    physicalPath: string,
    names: string[],
  ): Promise<void> {
    const client = await this.getClient()
    const dir = this.cleanPath(physicalPath)
    for (const name of names) {
      const target = dir ? `${dir}/${name}` : name
      const isDir = await this.isDir(client, target)
      if (isDir) await client.rmdir(target)
      else await client.unlink(target)
    }
  }

  async move(
    srcDir: string,
    dstDir: string,
    names: string[],
    srcPhys: string,
    dstPhys: string,
  ): Promise<void> {
    const client = await this.getClient()
    const fromBase = this.cleanPath(srcPhys)
    const toBase = this.cleanPath(dstPhys)
    for (const name of names) {
      const src = fromBase ? `${fromBase}/${name}` : name
      const dst = toBase ? `${toBase}/${name}` : name
      await client.rename(src, dst)
    }
  }

  async copy(
    srcDir: string,
    dstDir: string,
    names: string[],
    srcPhys: string,
    dstPhys: string,
  ): Promise<void> {
    const client = await this.getClient()
    const fromBase = this.cleanPath(srcPhys)
    const toBase = this.cleanPath(dstPhys)
    for (const name of names) {
      const src = fromBase ? `${fromBase}/${name}` : name
      const dst = toBase ? `${toBase}/${name}` : name
      // smb2 无原生 copy，读后写实现
      const data: Buffer = await client.readFile(src)
      await client.writeFile(dst, data)
    }
  }

  async put(
    virtualPath: string,
    physicalPath: string,
    content: Buffer | Uint8Array,
  ): Promise<void> {
    const client = await this.getClient()
    const clean = this.cleanPath(physicalPath)
    await client.writeFile(clean, Buffer.from(content))
  }
}
