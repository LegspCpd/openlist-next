// 基于上游 Go 版 drivers/ilanzou 翻译：蓝奏云 i 版（apis.ilanzou.com）。
// 这是一个基于 HTTP REST 的网盘驱动。关键能力：
//   - 登录（用户名/密码）拿到 appToken
//   - 列表、直链（带 AES-ECB 签名 + 跟随重定向到 CDN）
//   - 新建目录 / 移动 / 重命名 / 删除
//   - 上传走七牛（Qiniu）对象存储
// 关键配置项：username、password（必填）、ip（可选，用于 X-Forwarded-For）、root_id（默认 "0"）。
// 签名所用的共享密钥由驱动内置（与上游一致），无需用户填写。

export interface ILanZouAddition {
  root_id: string
  username: string
  password: string
  ip: string
  /** 登录后由驱动自动持久化，无需用户填写 */
  token: string
  /** 设备 UUID，首次初始化自动获取并持久化 */
  uuid: string
}

/** 内置的站点 / 签名配置（与 Go 版 Conf 对应，i 版固定值） */
export interface Conf {
  base: string
  secret: string
  bucket: string
  unproved: string
  proved: string
  devVersion: string
  site: string
}

export interface ListResp {
  msg: string
  total: number
  code: number
  offset: number
  totalPage: number
  limit: number
  list: ListItem[]
}

export interface ListItem {
  folderId?: number
  folderName?: string
  fileId?: number
  fileName?: string
  fileType?: number // 2 = 目录
  fileSize?: number // KiB
  updTime?: string // "2006-01-02 15:04:05"
  iconId?: number
  isAmt?: number
  parentId?: number
  parentName?: string
  status?: number
  isShare?: number
  isFileShare?: number
  fileStars?: number
  isFileDownload?: number
  fileDownloads?: number
  fileLikes?: number
  fileUrl?: any
  fileIcon?: string
  folderIcon?: string
  folderDesc?: string
  noteType?: number
  addTime?: string
}

export interface LoginResp {
  code: number
  msg: string
  data?: { appToken?: string }
}

export interface AccountMapResp {
  code: number
  msg: string
  map?: {
    userId?: string
    account?: string
    vipSize?: number
    totalSize?: number
    rewardSize?: number
    usedSize?: number
  }
}

export interface UploadTokenRapidResp {
  code: number
  msg: string
  upToken: string
  map?: {
    fileIconId?: number
    fileName?: string
    fileIcon?: string
    fileId?: number
  }
}

export interface UploadResultItem {
  fileIconId?: number
  fileName?: string
  fileIcon?: string
  fileId?: number
  status?: number
  token?: string
}

export interface UploadResultResp {
  code: number
  msg: string
  list?: UploadResultItem[]
}
