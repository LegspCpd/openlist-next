/**
 * 通用 PostgreSQL HTTP 网关驱动。
 *
 * 适用于「外部 Postgres 系数据库 + 边缘运行时」的组合：自建 Postgres、
 * 腾讯云 TDSQL-C、阿里云 RDS PG、PolarDB-PG、Supabase 自建网关等。
 *
 * 由于 Workers 无裸 TCP，`postgres://` 直连串必须配合网关使用；
 * 若配置的是 `https://` 网关地址，则直接用。
 *
 * 环境变量：
 *   - PG_HTTP_URL / POSTGRES_HTTP_URL / PSQL_HTTP_URL  网关地址
 *   - PG_HTTP_TOKEN / POSTGRES_HTTP_TOKEN              网关鉴权（可选）
 *   - DATABASE_URL=postgres://…                        配合网关转发
 */
import type { Driver } from "../types"
import { createGatewayDriver } from "./http-gateway"

export const pghttpDriver: Driver = createGatewayDriver({
  name: "pghttp",
  dialect: "postgres",
  platform: "PostgreSQL over HTTP gateway",
  urlKeys: ["PG_HTTP_URL", "POSTGRES_HTTP_URL", "PSQL_HTTP_URL", "POSTGRESQL_HTTP_URL"],
  tokenKeys: ["PG_HTTP_TOKEN", "POSTGRES_HTTP_TOKEN", "PSQL_HTTP_TOKEN"],
  accept: ["postgres", "https", "http"],
  // Neon / Supabase 有专用驱动
  excludeHost: /neon\.tech$|supabase\.(co|in|net)$/i,
})
