// 基于上游 Go 版 drivers/halalcloud 翻译。
// 注意：上游 halalcloud 驱动完全基于 gRPC（city404/v6-public-rpc-proto）+ AWS S3 SDK 与清真云通信，
// 而 Cloudflare Workers 边缘运行时不支持持久 TCP / gRPC，也没有 aws-sdk-go，因此本驱动
// 无法真正联网工作。这里实现驱动骨架与配置结构，所有实际操作在调用时抛出清晰错误并在注释中说明降级原因。
//
// 关键配置项：
//   - refresh_token: 登录令牌（必填）
//   - upload_thread: 上传并发数（1~32，默认 3）
//   - app_id / app_version / app_secret: 自填 App 三件套（默认使用内置开放值）

export interface HalalCloudAddition {
  root_folder_path: string
  refresh_token: string
  upload_thread: string
  app_id: string
  app_version: string
  app_secret: string
}
