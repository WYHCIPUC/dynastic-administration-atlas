# 中国历代行政体系百科 · 现代职位 ↔ 历史角色类比

一个可核验的中国历代行政制度研究项目：以 11 个时期的制度矩阵为底稿，提供"现代职位 → 历史角色 → 穿越生活百科"的规则化类比，每条结论都挂接来源 ID 与证据等级，匹配是职能类比而非职级换算。

## 两层产物

- **根目录静态站**（零依赖）：`index.html` / `styles.css` / `app.js` 直接读取本目录的 CSV/JSON，无需构建、无需数据库。适合快速浏览、教学演示和离线查阅的读者。
- **`web/` 全栈站**（Next.js 15 + TypeScript + Prisma/PostgreSQL）：公开页面、规则匹配 API，以及带登录、内容状态机、审计与回滚的管理后台。适合需要内容审校流程和长期维护的部署方。架构细节见 `web/DEVELOPMENT.md`。

## 数据规模与证据等级

- 11 个时期 × 8 个维度 = **88 条制度矩阵**（`dynasty_systems.csv`），区分法定结构、实际运行、改革与风险。
- **151 组职位映射案例**、453 条候选（每组 1 个主候选 + 2 个次候选），其中 143 组带别名（`office_mapping_examples.json`）。
- **46 条来源登记**（`source_registry.csv`），覆盖原典、正史政书、档案简牍、学术研究与机构资料。
- `validate_package.py` 一键校验 Schema、来源闭合与矩阵覆盖，并运行 **12 组示例查询**。

证据等级分为 A–E 五级（语义见 `role_mapping_schema.json` 与 `sample_mapping_output.json` 的图例）：

- **A**：当朝法令、会典、实录、诏令、官府档案或出土简牍。
- **B**：正史、政书、会要等传统官方编纂材料。
- **C**：考古实物、图像和物质文化证据。
- **D**：现代同行评审研究、国家社科基金成果和权威专著。
- **E**：普及材料，仅作线索。

当前 151 组案例实际使用 A/B/C 三级，D/E 级为后续扩展预留。精确税率、兵额、收入占比和日程必须注明年代、统计口径和争议；没有直接证据的生活细节一律标为"情景重建"。

## 快速开始

### A. 静态站（无需任何服务）

直接双击打开 `index.html`；若浏览器限制 `file://` 下的本地文件读取，在本目录启动任意静态文件服务器即可：

```bash
python -m http.server 8080   # 然后访问 http://localhost:8080/
```

### B. 全栈站（Docker Compose）

前置：已安装 Docker；`web/` 依赖已安装（`cd web && npm install`，用于生成密码哈希）。

1. 在仓库根目录复制环境变量模板：`cp .env.example .env`，填写以下**必需项**（缺失时 compose 会拒绝启动）：
   - `POSTGRES_PASSWORD`：数据库密码（禁止弱口令）。
   - `ADMIN_EMAIL`：管理员登录邮箱。
   - `ADMIN_PASSWORD_HASH`：管理员密码的 argon2id 哈希，生成方式：
     ```bash
     cd web && node -e "require('argon2').hash('你的密码').then(h=>console.log(h))"
     ```
   - `ADMIN_SESSION_SECRET`：随机长会话密钥，生成方式：`openssl rand -base64 48`。
2. 启动：`docker compose up --build`。编排会等待 PostgreSQL 健康检查，依次执行数据库迁移与内容导入（`npm run content:import`），再启动网站。
3. 访问 `http://localhost:3000`（公开站）与 `http://localhost:3000/admin`（管理后台）。

生产环境中 `ADMIN_SESSION_SECRET` / `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` 为强制配置：应用启动时（`src/instrumentation.ts`）校验，缺失或仍为已知开发默认值即拒绝启动。

### 命令行检索原型

```bash
python role_matcher.py "某省财政厅厅长"
```

原型只用 Python 标准库，从自由文本抽取层级与职能关键词，返回最接近的候选及证据标签，用于检索和审校，不替代历史研究判断。

## 安全设计要点

管理登录使用 argon2id 密码哈希校验；会话为 HMAC 签名的 8 小时 httpOnly Cookie（生产环境加 Secure），`verifySession` 会比对 `ADMIN_EMAIL`；CSRF 采用"随机值.HMAC 签名"令牌 + 双提交校验，写操作强制、GET/HEAD 只读请求豁免；登录接口按 IP 限流 10 次/分钟；所有管理写操作写入审计日志。

## 内容发布工作流

管理端内容严格按 `DRAFT → REVIEW → PUBLISHED → ARCHIVED` 状态机流转，非法流转返回 409；状态变更在事务中完成并留存审计快照，`rollback` 可按完整快照回滚。公开 API 与页面只读取 `status = PUBLISHED` 的内容；`npm run content:import` 将 `web/public/data/` 的三个数据文件导入数据库并置为 PUBLISHED。

## 开发与验证命令

```bash
# 研究底稿自校验（根目录）
python -B validate_package.py

# 全栈站（web/ 目录）
npm run lint        # ESLint
npm run typecheck   # TypeScript 类型检查
npm test            # 单元测试（24 例）
npm run build       # 生产构建
node scripts/e2e-smoke.mjs   # 端到端冒烟（19 项断言，需运行中的服务）
```

CI 分三个 job：`web`（lint + typecheck + test + build）、`python`（validate_package.py）、`e2e`（端到端冒烟）。

## 目录结构

```
├── index.html / styles.css / app.js   # 零依赖静态公共站
├── research_report.md                 # 按时期整理的研究底稿
├── dynasty_systems.csv                # 88 条制度矩阵（11 时期 × 8 维度）
├── source_registry.csv                # 46 条来源登记
├── role_mapping_schema.json           # 映射数据字典（含证据等级图例）
├── sample_mapping_output.json         # 符合 Schema 的完整输出样例
├── office_mapping_examples.json       # 151 组职位映射案例
├── role_matcher.py                    # 标准库规则化检索原型
├── validate_package.py                # 底稿一键自校验
├── validation_checklist.md            # 验收清单
├── docker-compose.yml                 # PostgreSQL + 迁移/导入 + 网站编排
├── 高端视觉设计方案.md                 # 现行"制度档案馆"视觉基线
├── docs/design-archive/               # 被淘汰的十套视觉候选（存档）
└── web/                               # Next.js 全栈站（详见 web/DEVELOPMENT.md）
```

## License

- 代码（`app.js`、`role_matcher.py`、`validate_package.py`、`web/` 等）采用 [MIT 许可证](LICENSE)。
- 研究性内容与数据文件（`research_report.md`、`dynasty_systems.csv`、`source_registry.csv`、`office_mapping_examples.json`、`role_mapping_schema.json`、`sample_mapping_output.json` 等）采用 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。

## 免责声明

本项目为研究性内容。现代职位与历史角色之间的匹配是启发式职能类比，相似度与置信度为研究辅助判断，不构成学术定论，更不用于人事、法律或任何正式用途。数据存在不确定性，生活细节按"直接史料 / 学术解释 / 情景重建 / 存在争议"分类标注；欢迎以来源对勘的方式提出修正。
