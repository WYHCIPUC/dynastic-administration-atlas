# 历代行政网站开发说明

## 本地运行

```powershell
Copy-Item .env.example .env.local
npm install
npm run db:generate
npm run dev
```

生产构建使用 `npm run build`，构建后 `npm start` 启动 `.next/standalone/server.js`。`postbuild` 会执行 `scripts/copy-static.mjs`，把 `.next/static` 复制进 standalone 目录——缺少这一步时本地 `npm start` 会返回无样式、无交互的页面（Docker 镜像内由 Dockerfile 的 `COPY` 完成同样的事）。Windows 下重新构建前需要先停止正在运行的 standalone 服务器，否则文件锁会让构建挂起。根目录的 `docker-compose.yml` 启动 PostgreSQL、迁移/内容导入任务和网站服务；数据库迁移文件位于 `prisma/migrations/0001_init/migration.sql`。

## 视觉基线

`src/app/globals.css` 落地《高端视觉设计方案》的"制度档案馆"四层视觉：暖纸（#EAE5DB/#F8F4EB）承载大面积内容，漆黑/墨青（#09191D/#0E2E33）用于顶栏、首屏、制度矩阵展陈区和页脚，朱砂（#B44F42）只用于主按钮、焦点态和风险提示，鎏金（#CDA66A）标记印章、编号、统计数字与细线。所有公开页面通过 `src/components/PublicShell.tsx` 共享同一顶栏（方形双层边框印章 + 金/朱渐变线）和页脚；移动端顶栏导航横向滚动而不是隐藏。来源等级 A/B/C/D(/E) 使用 `level-*` 色签，`C/D` 复合等级为虚线边签。新模块应复用同一套 token 和壳层，不另起视觉语言。

## 数据流

`public/data/` 保存研究底稿的 CSV/JSON 副本。`src/lib/content.ts` 负责读取和解析，`src/lib/matcher.ts` 负责可审计的关键词、职能和层级匹配。生产匹配不依赖 AI；`AI_EXPLAINER_ENABLED` 和 `EMBEDDING_ENABLED` 默认关闭。

匹配分数保留在规则层，输出三个候选及相似度、置信度、差异、生活百科、证据等级和来源 ID。数据库可用时结果写入 `MatchQuery`，否则使用 24 小时内存回退，因此公开匹配在未连接数据库时仍可用。

## 页面与接口

- 公共页面：`/`、`/match`、`/match/:queryId`、`/periods`、`/periods/:periodSlug`、`/offices/:officeSlug`、`/sources`、`/about`。
- 管理页面：`/admin/login`、`/admin`，以及时期、官职、生活、来源、主张和版本资源页。
- 公开接口：`POST /api/matching/preview`、`GET /api/matching/:queryId`、`GET /api/periods`、`GET /api/periods/:slug`、`GET /api/offices/:slug`、`GET /api/sources`、`GET /api/health`。
- 管理接口：时期、官职、来源、主张的创建/编辑接口，以及统一的 `submit-review`、`publish`、`archive`、`rollback` 状态接口。只读查询接口：`GET /api/admin/{periods|offices|sources|claims|lifestyle}` 列表（`limit`/`offset` 分页并返回 `total`）、`GET /api/admin/audit` 审计日志（最新在前）、`GET /api/admin/overview` 各类内容状态分布计数。

管理登录使用 Argon2id 哈希；会话为 HttpOnly、Secure（生产环境）Cookie；写操作要求 CSRF Token（GET/HEAD 只读请求仅校验会话、豁免 CSRF），并写入 `AdminAuditLog`。内容状态严格使用 `DRAFT → REVIEW → PUBLISHED → ARCHIVED`，公开研究端只读取已发布数据。

## 内容导入

```powershell
npm run db:migrate
npm run db:seed
npm run content:import
```

导入脚本保留来源 ID，并将无法匹配的制度/官职数据留在导入日志中。任何生活细节应在后台补充不确定性类型：直接史料、学术解释、情景重建或存在争议。

## 验证

```powershell
npm run lint
npm test
npm run build
$env:DATABASE_URL='postgresql://atlas:atlas@localhost:5432/atlas?schema=public'; npx prisma validate
```

根目录 `validate_package.py` 继续验证研究底稿的 Schema、来源闭合、11 个时期的 88 条矩阵记录和 8 组职位案例。
