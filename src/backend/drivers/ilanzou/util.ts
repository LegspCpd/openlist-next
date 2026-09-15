// ilanzou 驱动的工具层：AES-ECB 签名、HTTP 请求封装、登录，以及列表/直链/写操作/上传等 API。
// 所有网络调用基于 fetch（Web 标准），不依赖 Node 内置模块，可在 Cloudflare Workers 运行。
import { md5 } from "../../pkg/crypto"
import {
  AccountMapResp,
  Conf,
  ILanZouAddition,
  ListItem,
  ListResp,
  LoginResp,
  UploadResultResp,
  UploadTokenRapidResp,
} from "./types"

const DEFAULT_CONF: Conf = {
  base: "https://apis.ilanzou.com",
  secret: "lanZouY-disk-app",
  bucket: "wpanstore-lanzou",
  unproved: "unproved",
  proved: "proved",
  devVersion: "125",
  site: "https://www.ilanzou.com",
}

const DEFAULT_PART_SIZE = 8 * 1024 * 1024
const MAX_UPLOAD_COMMIT_RETRIES = 10
const UPLOAD_COMMIT_RETRY_DELAY = 1000

// ─── AES-ECB（PKCS7）签名，等价于 mopan-sdk-go 的 AesEncrypt ──────────────────

function pkcs7Pad(data: Uint8Array, block = 16): Uint8Array<ArrayBuffer> {
  const padLen = block - (data.length % block)
  const out = new Uint8Array(data.length + padLen)
  out.set(data)
  out.fill(padLen, data.length)
  return out
}

export async function aesEcbEncrypt(
  plaintext: string,
  key: string,
): Promise<Uint8Array> {
  const keyBytes = new TextEncoder().encode(key)
  const keyMat = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-ECB" },
    false,
    ["encrypt"],
  )
  const pt = pkcs7Pad(new TextEncoder().encode(plaintext))
  const buf = await crypto.subtle.encrypt({ name: "AES-ECB" }, keyMat, pt)
  return new Uint8Array(buf)
}

function toHex(bytes: Uint8Array): string {
  let s = ""
  for (const b of bytes) s += b.toString(16).padStart(2, "0")
  return s
}

/** iLanzou 要求字面量冒号，其余保留字符需 query-escape */
function appTokenQueryValue(token: string): string {
  return encodeURIComponent(token).replace(/%3A/g, ":")
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function base64UrlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/** 生成与 Go 版 time.Now().Format("Mon Jan 02 2006 15:04:05 GMT-0700 (MST)") 一致的字符串 */
function formatTokenTime(d: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ]
  const pad = (n: number) => String(n).padStart(2, "0")
  const offsetMin = -d.getTimezoneOffset()
  const sign = offsetMin >= 0 ? "+" : "-"
  const tzH = Math.floor(Math.abs(offsetMin) / 60)
  const tzM = Math.abs(offsetMin) % 60
  return (
    `${days[d.getDay()]} ${months[d.getMonth()]} ${pad(d.getDate())} ` +
    `${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ` +
    `GMT${sign}${pad(tzH)}${pad(tzM)} (MST)`
  )
}

export class ILanZouClient {
  conf: Conf = DEFAULT_CONF
  token = ""
  uuid = ""
  userID = ""
  account = ""
  username: string
  password: string
  ip: string

  constructor(addition: ILanZouAddition) {
    this.username = addition.username
    this.password = addition.password
    this.ip = addition.ip
    this.token = addition.token
    this.uuid = addition.uuid
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      Origin: this.conf.site,
      Referer: this.conf.site + "/",
      "Accept-Encoding": "gzip",
      "Accept-Language": "zh-CN,zh;q=0.9,en-US;en;q=0.8",
    }
    if (this.ip) h["X-Forwarded-For"] = this.ip
    return h
  }

  private async getTimestamp(): Promise<[number, string]> {
    const ts = Date.now()
    const enc = await aesEcbEncrypt(String(ts), this.conf.secret)
    return [ts, toHex(enc)]
  }

  private async request(
    path: string,
    method: string,
    proved: boolean,
    opts?: { body?: any; query?: string; retried?: boolean },
  ): Promise<any> {
    if (this.uuid === "") throw new Error("[ilanzou] 驱动未初始化（缺少 uuid）")
    const [, tsStr] = await this.getTimestamp()
    const params: string[] = [
      "uuid=" + encodeURIComponent(this.uuid),
      "devType=6",
      "devCode=" + encodeURIComponent(this.uuid),
      "devModel=chrome",
      "devVersion=" + encodeURIComponent(this.conf.devVersion),
      "appVersion=",
      "timestamp=" + tsStr,
    ]
    if (proved) params.push("appToken=" + appTokenQueryValue(this.token))
    params.push("extra=2")

    let url = this.conf.base + path + "?" + params.join("&")
    if (opts?.query) url += "&" + opts.query

    const init: RequestInit = { method, headers: this.headers() }
    if (opts?.body !== undefined) {
      init.body = JSON.stringify(opts.body)
      ;(init.headers as Record<string, string>)["Content-Type"] =
        "application/json"
    }

    const res = await fetch(url, init)
    const text = await res.text()
    let body: any = {}
    try {
      body = JSON.parse(text)
    } catch {
      body = {}
    }
    const code = Number(body?.code)
    if (code !== 200) {
      if (
        proved &&
        !opts?.retried &&
        (code === -1 || code === -2 || this.token === "")
      ) {
        await this.login()
        return this.request(path, method, proved, { ...opts, retried: true })
      }
      throw new Error(`[ilanzou] ${code}: ${body?.msg ?? "unknown error"}`)
    }
    return body
  }

  private unproved(path: string, method: string, opts?: any) {
    return this.request("/" + this.conf.unproved + path, method, false, opts)
  }
  private proved(path: string, method: string, opts?: any) {
    return this.request("/" + this.conf.proved + path, method, true, opts)
  }

  async init(): Promise<void> {
    if (this.uuid === "") {
      const res = await this.unproved("/getUuid", "GET")
      this.uuid = String(res?.uuid ?? "")
      if (!this.uuid) throw new Error("[ilanzou] 获取 uuid 失败")
    }
    await this.login()
    const res: AccountMapResp = await this.proved("/user/account/map", "GET")
    this.userID = String(res?.map?.userId ?? "")
    this.account = String(res?.map?.account ?? "")
  }

  async login(): Promise<void> {
    const res: LoginResp = await this.unproved("/login", "POST", {
      body: { loginName: this.username, loginPwd: this.password },
    })
    this.token = String(res?.data?.appToken ?? "")
    if (!this.token) throw new Error("[ilanzou] 登录失败：appToken 为空")
  }

  async listDir(folderId: string): Promise<ListItem[]> {
    const out: ListItem[] = []
    let offset = 1
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const resp: ListResp = await this.proved("/record/file/list", "GET", {
        query: `offset=${offset}&limit=60&folderId=${folderId}&type=0`,
      })
      out.push(...(resp.list ?? []))
      if (resp.offset < resp.totalPage) offset++
      else break
    }
    return out
  }

  /** 把 OpenList 物理路径解析为 ilanzou 的 folderId（逐层列目录） */
  async resolveFolderId(physicalPath: string, rootId: string): Promise<string> {
    if (!physicalPath || physicalPath === "/") return rootId
    const segments = physicalPath.split("/").filter(Boolean)
    let current = rootId
    for (const seg of segments) {
      const decoded = decodeURIComponentSafe(seg)
      const children = await this.listDir(current)
      const child = children.find(
        (c) =>
          c.fileType === 2 &&
          (c.folderName === seg || c.folderName === decoded),
      )
      if (!child || child.folderId === undefined) {
        throw new Error(`[ilanzou] 目录不存在: ${physicalPath}`)
      }
      current = String(child.folderId)
    }
    return current
  }

  /** 按物理路径找到对应文件/目录节点 */
  async getNode(
    physicalPath: string,
    rootId: string,
  ): Promise<ListItem> {
    if (!physicalPath || physicalPath === "/") {
      return { folderId: Number(rootId), folderName: "root", fileType: 2 }
    }
    const parts = physicalPath.split("/").filter(Boolean)
    const name = parts[parts.length - 1]
    const parentPath = "/" + parts.slice(0, -1).join("/")
    const parentId = await this.resolveFolderId(parentPath, rootId)
    const children = await this.listDir(parentId)
    const decoded = decodeURIComponentSafe(name)
    const item = children.find(
      (c) =>
        c.folderName === name ||
        c.folderName === decoded ||
        c.fileName === name ||
        c.fileName === decoded,
    )
    if (!item) throw new Error(`[ilanzou] 文件不存在: ${physicalPath}`)
    return item
  }

  /** 直链：构造带 AES 签名的 redirect 请求并跟随到 CDN 真实地址 */
  async getLink(fileId: string): Promise<{ url: string }> {
    const [ts, tsStr] = await this.getTimestamp()
    const downloadIdBuf = await aesEcbEncrypt(
      `${fileId}|${this.userID}`,
      this.conf.secret,
    )
    const authBuf = await aesEcbEncrypt(`${fileId}|${ts}`, this.conf.secret)
    const params = [
      "uuid=" + encodeURIComponent(this.uuid),
      "devType=6",
      "devCode=" + encodeURIComponent(this.uuid),
      "devModel=chrome",
      "devVersion=" + encodeURIComponent(this.conf.devVersion),
      "appVersion=",
      "timestamp=" + tsStr,
      "appToken=" + appTokenQueryValue(this.token),
      "enable=1",
      "downloadId=" + encodeURIComponent(toHex(downloadIdBuf)),
      "auth=" + encodeURIComponent(toHex(authBuf)),
    ]
    const url =
      this.conf.base + "/" + this.conf.unproved + "/file/redirect?" +
      params.join("&")
    const res = await fetch(url, {
      method: "GET",
      headers: this.headers(),
      redirect: "manual",
    })
    const status = res.status
    const location = res.headers.get("location") || ""
    let realURL = ""
    if (location && [301, 302, 303, 307, 308].includes(status)) {
      realURL = location
    } else if (status === 200 && location) {
      realURL = location
    } else if (status === 200) {
      const text = await res.text()
      let body: any = {}
      try {
        body = JSON.parse(text)
      } catch {
        body = {}
      }
      realURL = body?.url || body?.data?.url || ""
      if (!realURL) {
        throw new Error(`[ilanzou] 下载解析未返回 URL: ${body?.msg ?? ""}`)
      }
    } else {
      throw new Error(
        `[ilanzou] 重定向失败 status=${status} location=${location}`,
      )
    }
    return { url: realURL }
  }

  async mkdir(parentId: string, dirName: string): Promise<void> {
    await this.proved("/file/folder/save", "POST", {
      body: { folderDesc: "", folderId: Number(parentId), folderName: dirName },
    })
  }

  async move(
    fileId: string | null,
    folderId: string | null,
    targetId: string,
  ): Promise<void> {
    await this.proved("/file/folder/move", "POST", {
      body: {
        folderIds: folderId != null ? String(folderId) : "",
        fileIds: fileId != null ? String(fileId) : "",
        targetId,
      },
    })
  }

  async renameFolder(folderId: string | number, newName: string): Promise<void> {
    await this.proved("/file/folder/edit", "POST", {
      body: { folderDesc: "", folderId: Number(folderId), folderName: newName },
    })
  }

  async renameFile(fileId: string | number, newName: string): Promise<void> {
    await this.proved("/file/edit", "POST", {
      body: { fileDesc: "", fileId: Number(fileId), fileName: newName },
    })
  }

  async remove(
    fileId: string | null,
    folderId: string | null,
  ): Promise<void> {
    await this.proved("/file/delete", "POST", {
      body: {
        folderIds: folderId != null ? String(folderId) : "",
        fileIds: fileId != null ? String(fileId) : "",
        status: 0,
      },
    })
  }

  async put(
    folderId: string,
    fileName: string,
    content: Uint8Array,
  ): Promise<{ fileId: number; name: string; size: number }> {
    // 复制为 ArrayBuffer 支撑的视图，满足 BufferSource / BlobPart 类型约束
    const data = new Uint8Array(content)
    const md5hex = md5(data)
    const sizeKiB = Math.max(1, Math.ceil(data.length / 1024))
    const tokenResp: UploadTokenRapidResp = await this.proved(
      "/7n/getUpToken",
      "POST",
      {
        body: {
          fileId: "",
          fileName,
          fileSize: sizeKiB,
          folderId: Number(folderId),
          md5: md5hex,
          type: 1,
        },
      },
    )
    if (tokenResp.upToken === "-1") {
      return {
        fileId: Number(tokenResp.map?.fileId ?? 0),
        name: tokenResp.map?.fileName ?? fileName,
        size: data.length,
      }
    }
    const upToken = tokenResp.upToken
    const now = new Date()
    const y = now.getUTCFullYear()
    const m = String(now.getUTCMonth() + 1).padStart(2, "0")
    const d = String(now.getUTCDate()).padStart(2, "0")
    const key = `disk/${y}/${m}/${d}/${this.account}/${now.getTime()}.rar`

    let commitToken = ""
    if (data.length <= DEFAULT_PART_SIZE) {
      const form = new FormData()
      form.append("token", upToken)
      form.append("key", key)
      form.append("fname", fileName)
      form.append("file", new Blob([data]), fileName)
      const res = await fetch("https://upload.qiniup.com/", {
        method: "POST",
        body: form,
      })
      const body = await res.json().catch(() => ({}))
      commitToken = String(body?.token ?? "")
    } else {
      const keyBase64 = base64UrlEncode(key)
      const initRes = await fetch(
        `https://upload.qiniup.com/buckets/${this.conf.bucket}/objects/${keyBase64}/uploads`,
        { method: "POST", headers: { Authorization: "UpToken " + upToken } },
      )
      const initBody = await initRes.json().catch(() => ({}))
      const uploadId = String(initBody?.uploadId ?? "")
      const partNum = Math.ceil(data.length / DEFAULT_PART_SIZE)
      const parts: { partNumber: number; etag: string }[] = []
      for (let i = 1; i <= partNum; i++) {
        const start = (i - 1) * DEFAULT_PART_SIZE
        const end = Math.min(start + DEFAULT_PART_SIZE, data.length)
        const chunk = data.slice(start, end)
        const putRes = await fetch(
          `https://upload.qiniup.com/buckets/${this.conf.bucket}/objects/${keyBase64}/uploads/${uploadId}/${i}`,
          {
            method: "PUT",
            headers: { Authorization: "UpToken " + upToken },
            body: chunk,
          },
        )
        const putBody = await putRes.json().catch(() => ({}))
        parts.push({ partNumber: i, etag: String(putBody?.etag ?? "") })
      }
      const commitRes = await fetch(
        `https://upload.qiniup.com/buckets/${this.conf.bucket}/objects/${keyBase64}/uploads/${uploadId}`,
        {
          method: "POST",
          headers: {
            Authorization: "UpToken " + upToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ fnmae: fileName, parts }),
        },
      )
      const commitBody = await commitRes.json().catch(() => ({}))
      commitToken = String(commitBody?.token ?? "")
    }

    let fileId = 0
    for (let i = 0; i < MAX_UPLOAD_COMMIT_RETRIES; i++) {
      const resp: UploadResultResp = await this.unproved("/7n/results", "POST", {
        query: `tokenList=${encodeURIComponent(commitToken)}&tokenTime=${encodeURIComponent(formatTokenTime(new Date()))}`,
      })
      if (resp.list && resp.list.length > 0) {
        if (resp.list[0].status === 1) {
          fileId = Number(resp.list[0].fileId ?? 0)
          break
        }
      }
      if (i < MAX_UPLOAD_COMMIT_RETRIES - 1) await sleep(UPLOAD_COMMIT_RETRY_DELAY)
    }
    if (!fileId) throw new Error("[ilanzou] 上传失败：提交后未拿到 fileId")
    return { fileId, name: fileName, size: data.length }
  }
}
