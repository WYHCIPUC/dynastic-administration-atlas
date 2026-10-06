# 中国历代行政体系与现代职位穿越百科

本目录包含一套可核验的中国历代制度研究底稿，以及“现代职位 → 历史角色 → 穿越生活百科”的规则化示例。

## 文件

- `research_report.md`：按时期整理政治、行政、财政、军事、法律监察、选官教育、礼制宗教与社会生活。
- `dynasty_systems.csv`：可筛选的制度矩阵，区分法定结构、实际运行、改革与风险。
- `source_registry.csv`：原典、出土文书、档案、学术研究和博物馆资料的来源登记表。
- `role_mapping_schema.json`：现代职位输入、历史候选、生活百科和证据等级的数据字典。
- `sample_mapping_output.json`：符合数据字典的财政厅厅长完整输出样例。
- `office_mapping_examples.json`：典型现代职位的映射示例。
- `validation_checklist.md`：覆盖率、证据、匹配和不确定性验收清单。
- `role_matcher.py`：只使用 Python 标准库的规则化检索原型。
- `validate_package.py`：一键验证 Schema、案例、来源闭合、矩阵覆盖和八类示例查询。
- `index.html` / `styles.css` / `app.js`：无需构建工具即可打开的静态公共站，支持职位匹配、制度矩阵和来源检索。
- `web/`：Next.js + TypeScript + Prisma 全栈网站，包含公开页面、匹配 API、来源/制度 API、管理员会话和内容状态接口；`src/app/globals.css` 与 `src/components/PublicShell.tsx` 落地"制度档案馆"纸/墨/朱/金视觉基线。
- `web/DEVELOPMENT.md`：网站架构、数据流、接口、内容发布和验证命令。
- `docker-compose.yml`：PostgreSQL、迁移/导入任务和 Next.js 服务的本地编排。

## 证据规则

`A` 表示当朝法令、会典、实录、诏令、官府档案或出土简牍；`B` 表示考古、墓志、敦煌/吐鲁番/黑水城文书；`C` 表示同行评审论文、国家社科基金项目和大学出版社专著；`D` 表示故宫、国家博物馆、国家图书馆等机构的整理性研究；`E` 只作线索。

精确税率、兵额、收入占比和日程必须注明年代、统计口径和争议。现代职级不直接换算古代品秩；所有匹配均是职能类比，并显示相似处、差异和置信度。没有直接证据的生活细节必须标为“情景重建”。

## 使用原型

```powershell
python .\role_matcher.py "某省财政厅厅长"
python .\role_matcher.py "边疆驻防军分区主官"
```

原型从自由文本中抽取层级和职能关键词，读取 `office_mapping_examples.json`，返回最接近的候选及其证据标签。它用于检索和审校，不替代历史研究判断。

## 启动网站

直接预览静态站：在本目录启动任意静态文件服务器，例如 `python -m http.server 8080`，然后打开 `http://localhost:8080/`。静态站会读取根目录的 CSV/JSON 资料文件。

运行全栈站：

```powershell
cd .\web
Copy-Item .env.example .env.local
npm install
npm run db:generate
npm run dev
```

需要数据库时，先在根目录执行 `docker compose up --build`。编排会等待 PostgreSQL 健康检查，再执行迁移和内容导入。Docker 环境中的管理员密码必须以 Argon2id 哈希放入 `ADMIN_PASSWORD_HASH`，并设置随机的 `ADMIN_SESSION_SECRET`。

常用检查：

```powershell
cd .\web
npm run lint
npm test
npm run build
```

公开接口包括 `POST /api/matching/preview`、`GET /api/periods`、`GET /api/periods/:slug`、`GET /api/offices/:slug`、`GET /api/sources` 和 `GET /api/health`。管理状态接口统一使用 `POST /api/admin/content/:id/{submit-review|publish|archive|rollback}`，要求管理员会话和 `x-csrf-token`。

```powershell
python -B .\validate_package.py
```
