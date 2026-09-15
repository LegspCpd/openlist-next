// 清真云（HalalCloud）refresh_token + 自填 App 三件套版驱动。
//
// 重要：上游 Go 版 halalcloud 的每一个网络操作都依赖 gRPC（grpcuserapi.2dland.cn:443）与
// AWS S3 SDK，Cloudflare Workers 边缘运行时既不支持持久 TCP/gRPC，也没有 Node 的 aws-sdk-go，
// 因此本驱动无法真正与清真云通信。为遵守「零 Node 内置模块 / 仅用 Web 标准」的项目约束，
// 这里实现驱动接口骨架与配置归一化，并让所有实际操作在调用时抛出明确的降级错误，
// 而不是强行引入 aws-sdk-go / grpc 等无法在边缘运行的依赖。
//
// 若后续要在边缘运行，需要清真云提供 REST/HTTP 网关替代 gRPC；在此之前本驱动仅用于占位与配置。
import {
  StorageDriver,
  FileItem,
  calcFileType,
} from "../../internal/driver/base"
import { HalalCloudAddition } from "./types"

export function normalizeHalalCloudAddition(a: any): HalalCloudAddition {
  const norm = { ...(a || {}) } as any
  norm.root_folder_path =
    (norm.root_folder_path || "/").trim() || "/"
  norm.refresh_token = (norm.refresh_token || "").trim()
  norm.upload_thread = (norm.upload_thread || "3").toString().trim() || "3"
  norm.app_id = (norm.app_id || "alist/10001").trim() || "alist/10001"
  norm.app_version = (norm.app_version || "1.0.0").trim() || "1.0.0"
  norm.app_secret =
    (norm.app_secret || "bR4SJwOkvnG5WvVJ").trim() || "bR4SJwOkvnG5WvVJ"
  return norm as HalalCloudAddition
}

const GRPC_UNAVAILABLE =
  "[HalalCloud] 该驱动依赖 gRPC + AWS S3 SDK，无法在 Cloudflare Workers 边缘运行时运行。" +
  "清真云当前仅提供 gRPC 接口，缺少可用的 REST/HTTP 网关，故本驱动为优雅降级的占位实现，" +
  "所有读写操作暂不支持。请等待清真云开放 HTTP 接口，或改用 halalcloud_open（开放平台版）。"

export class HalalCloudDriver implements StorageDriver {
  private addition: HalalCloudAddition

  constructor(addition: HalalCloudAddition) {
    this.addition = normalizeHalalCloudAddition(addition)
  }

  async init(): Promise<void> {
    // 不抛错：允许驱动被创建/注册，但实际网络操作在调用时降级报错。
    if (!this.addition.refresh_token) {
      console.warn(
        "[HalalCloud] 未填写 refresh_token；由于 gRPC 在边缘运行时不可用，驱动仍为降级状态。",
      )
    }
  }

  // 只读降级：返回一个代表根目录的占位节点
  async list(_virtualPath: string, _physicalPath: string): Promise<FileItem[]> {
    throw new Error(GRPC_UNAVAILABLE)
  }

  async get(_virtualPath: string, _physicalPath: string): Promise<FileItem> {
    throw new Error(GRPC_UNAVAILABLE)
  }

  async mkdir(): Promise<void> {
    throw new Error(GRPC_UNAVAILABLE)
  }
  async rename(): Promise<void> {
    throw new Error(GRPC_UNAVAILABLE)
  }
  async remove(): Promise<void> {
    throw new Error(GRPC_UNAVAILABLE)
  }
  async move(): Promise<void> {
    throw new Error(GRPC_UNAVAILABLE)
  }
  async copy(): Promise<void> {
    throw new Error(GRPC_UNAVAILABLE)
  }
  async put(): Promise<void> {
    throw new Error(GRPC_UNAVAILABLE)
  }
}
