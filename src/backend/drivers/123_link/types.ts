// 基于上游 Go 版 drivers/123_link 翻译。
// 123 云盘「直链 / 秒传链接」解析驱动：用户把一组 URL 按缩进文本结构粘进来，
// 驱动在内存里建成目录树，列表 / 获取时再把每条直链用 auth_key 签名后作为 raw_url 返回。
// 关键配置项：
//   - origin_urls:     缩进文本树（目录行以 ":" 结尾，文件行 "[FileSize:][Modified:]Url"）
//   - private_key:     123 网盘直链签名私钥（留空则不做签名，直接透传原始 URL）
//   - uid:             123 网盘用户 ID（参与签名）
//   - valid_duration:  签名有效时长（分钟，默认 30）

export interface Link123Addition {
  origin_urls: string
  private_key: string
  uid: number
  valid_duration: number
}

/** URL 树节点（与 Go 的 Node 对应） */
export interface LinkNode {
  url: string
  name: string
  level: number
  /** unix 秒 */
  modified: number
  size: number
  children: LinkNode[]
}
