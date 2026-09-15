# OpenList Next — 归属与许可声明

## 项目性质

**OpenList Next 是社区驱动的衍生版本（fork），不是 OpenList 官方发布物。**

- 本项目开发者/维护者：**LegspCpd**
- 项目主页：<https://github.com/LegspCpd/openlist-next>
- 与 OpenListTeam 官方项目**无任何隶属、授权或背书关系**
- OpenList 官方仓库：<https://github.com/OpenListTeam/OpenList>
- OpenList 官方文档：<https://doc.oplist.org>

请使用本项目的人注意：本仓库的问题请在本仓库提 Issue，**不要去打扰上游官方仓库**。

## 代码来源

本仓库在 `OpenListTeam/OpenList-Worker`（官方 TypeScript / Cloudflare Workers 移植版）
的基础上修改演化而来，该代码库本身派生自 Go 版 `OpenListTeam/OpenList`。

| 组成部分 | 来源 | 说明 |
| --- | --- | --- |
| `src/backend/**` | OpenListTeam/OpenList-Worker | 后端主体，包含大量改动与新增 |
| `src/backend/drivers/**`（多数） | 上游 OpenList-Worker | 由 Go 版 `OpenList/drivers` 移植 |
| `src/backend/drivers/{123_link,ilanzou,halalcloud}/` | 本项目新增 | 从 Go 版 OpenList 翻译补齐 |
| `src/backend/internal/model/store/driver/{neon,turso,pgrest,pghttp,mysqlhttp,upstash,r2,s3}.ts` | 本项目新增 | 外部存储驱动 |
| `src/backend/internal/model/store/{dialect,dsn}.ts` | 本项目新增 | SQL 方言层与连接串解析 |
| `dist/`（构建产物，不入库） | OpenListTeam/OpenList-Frontend | 前端在构建时拉取，**本仓库不含前端源码** |

前端保持上游原样，未做修改，版权归上游贡献者所有。

## 许可证

本仓库整体继承上游许可证：**GNU AGPL-3.0**，完整条款见 [`LICENSE`](./LICENSE)。

依据 AGPL-3.0 第 5 条，修改处已在相关源文件的注释中标注；
本项目对上游的修改以 Git 提交历史完整保留。

## 商标与品牌

- “OpenList” 名称与项目 Logo 归 OpenList 项目所有。
- 本项目沿用该名称仅为表明派生关系，**不主张任何商标权利**。

## 免责声明

本项目处于**早期实验阶段**，多个外部存储驱动尚未在真实生产环境与边缘运行时上完成验证。
使用者须自行承担数据丢失、服务中断与安全风险，**请勿将重要数据仅存放于此版本**。
