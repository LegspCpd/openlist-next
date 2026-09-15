/**
 * 通用 MySQL / MariaDB HTTP 网关驱动。
 *
 * 用于在边缘运行时（Cloudflare Workers / EdgeOne / ESA）访问**外部
 * MySQL / MariaDB**：自建 MySQL、阿里云 RDS、腾讯云 TencentDB、MariaDB、
 * TiDB、PolarDB 等。
 *
 * 边缘环境无法直连 3306（无裸 TCP），`mysql2` 也用不了，因此需要一个转发
 * 网关把 SQL 变成 HTTP。网关只需实现「收 JSON、执行、回 JSON」，参考实现
 * 见 `docs/gateway.md`（约 40 行 Node 代码，可部署到任意能连库的地方）。
 *
 * 环境变量：
 *   - MYSQL_HTTP_URL / MYSQL_GATEWAY_URL / MARIADB_HTTP_URL   网关地址
 *   - MYSQL_HTTP_TOKEN / MYSQL_GATEWAY_TOKEN                  网关鉴权（可选）
 *   - DATABASE_URL=mysql://…                                  配合网关转发
 *
 * 注：若运行在 Node 容器（Vercel Functions、自托管）里，可直接用官方的
 * `mysql` 驱动走 TCP，无需网关。
 */
import type { Driver } from "../types"
import { createGatewayDriver } from "./http-gateway"

export const mysqlhttpDriver: Driver = createGatewayDriver({
  name: "mysqlhttp",
  dialect: "mysql",
  platform: "MySQL / MariaDB over HTTP gateway",
  urlKeys: ["MYSQL_HTTP_URL", "MYSQL_GATEWAY_URL", "MARIADB_HTTP_URL", "MYSQL_URL_HTTP"],
  tokenKeys: ["MYSQL_HTTP_TOKEN", "MYSQL_GATEWAY_TOKEN", "MARIADB_HTTP_TOKEN"],
  accept: ["mysql", "https", "http"],
})
