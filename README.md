# 高定木作公开商务线索采集系统 MVP

## 1. 项目定位

这是一个只围绕“高定木作公开商务线索”开发的 Web 后台系统。

系统只采集公开网页可直接访问的商务信息，用于形成候选线索并进入人工审核池，不做隐私抓取、不做登录绕过、不扩展成泛行业线索系统。

当前 MVP 已经打通：

- 任务创建
- 公开网页候选页发现
- 页面抽取
- 规则评分
- 基础去重
- 审核后台
- PostgreSQL 持久化
- CSV 导出

## 2. 当前能力范围

### 任务能力

- 支持以“省”或“市”作为任务范围
- 省份和城市至少填写一项
- 任务计划抓取数量上限已放开到 `5000`
- 支持来源范围选择：搜索结果、官网、地图、公众号、抖音、小红书、行业平台

### 线索字段

MVP 业务核心字段保持为 10 个：

- 名称
- 品牌
- 城市
- 联系方式
- 地址
- 线索类型
- 来源平台
- 来源链接
- 匹配分
- 审核状态

为支撑任务运行与审核体验，数据库中额外保留少量运行字段，例如：

- `province`
- `raw_title`
- `raw_summary`
- `score_reasons`
- `duplicate_state`
- `latest_progress`
- `failure_samples`
- `retry_records`

### 页面能力

- `/tasks`
  任务页，支持创建任务、查看运行状态、最近抓取进度、失败链接样本和重试记录
- `/tasks/:id`
  任务详情页，展开当前候选页状态、失败样本明细、重试记录明细、最近失败趋势、最近失败原因分类、最近成功入池趋势和该任务最近线索
- `/results`
  结果页，支持按省、市、品牌、线索类型、来源平台、最低分筛选，并支持直接搜索
- `/review/:id`
  审核页，支持保留、丢弃和少量字段修正
- `/library`
  线索库页，仅展示已保留线索，支持筛选和导出 CSV

## 3. 技术方案

- 运行时：Node.js 20
- 服务端：原生 `http` 服务 + 服务端渲染 HTML
- 数据库：PostgreSQL
- 任务执行：进程内异步任务队列
- 抓取方式：只抓取公开 HTML 页面，有限速、超时和失败重试
- 规则系统：关键词、来源平台识别、评分规则均集中配置

项目强调最小可运行版本，不引入重型框架，优先保证可读性、可扩展性和后续可接手性。

## 4. 项目结构

```text
.
├─ AGENTS.md
├─ README.md
├─ .env.example
├─ package.json
├─ public/
│  └─ styles.css
├─ src/
│  ├─ server.js
│  ├─ config/
│  │  ├─ keywords.js
│  │  ├─ platforms.js
│  │  └─ scoring.js
│  ├─ lib/
│  │  ├─ csv.js
│  │  ├─ dedupe.js
│  │  ├─ extractor.js
│  │  ├─ html.js
│  │  ├─ http.js
│  │  ├─ render.js
│  │  ├─ rules.js
│  │  ├─ scoring.js
│  │  ├─ storage.js
│  │  ├─ taskRunner.js
│  │  └─ providers/
│  │     ├─ pageAdapters.js
│  │     └─ searchProvider.js
│  └─ scripts/
│     ├─ initDb.js
│     └─ seedDemo.js
├─ database/
│  ├─ postgres.sql
│  └─ migrations/
│     ├─ 001_initial.sql
│     └─ 002_region_and_task_diagnostics.sql
└─ custom/
   └─ notes/
```

## 5. 环境变量说明

项目当前只依赖少量环境变量，样例见 [.env.example](/D:/ceshi/xiansuo/.env.example)。

- `PORT`
  Web 服务端口，默认 `3000`
- `DATABASE_URL`
  PostgreSQL 连接串，默认 `postgresql://postgres:postgres@localhost:5432/xiansuo_leads`

示例：

```powershell
$env:PORT='3197'
$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/xiansuo_leads'
npm run dev
```

## 6. 数据库与迁移

### 初始化数据库

```powershell
npm run db:init
```

该命令会完成两件事：

- 若目标数据库不存在，则自动创建
- 自动执行 `database/migrations/` 下尚未应用的 SQL 迁移

### 迁移脚本

当前迁移文件：

- [001_initial.sql](/D:/ceshi/xiansuo/database/migrations/001_initial.sql)
  创建基础 `tasks`、`leads`、`schema_migrations` 表
- [002_region_and_task_diagnostics.sql](/D:/ceshi/xiansuo/database/migrations/002_region_and_task_diagnostics.sql)
  增加 `province`、`latest_progress`、`failure_samples`、`retry_records`
- [003_lead_search_indexes.sql](/D:/ceshi/xiansuo/database/migrations/003_lead_search_indexes.sql)
  增加 `pg_trgm` 扩展与第一批搜索索引
- [004_lead_composite_indexes.sql](/D:/ceshi/xiansuo/database/migrations/004_lead_composite_indexes.sql)
  增加任务详情页、结果页和线索库页的组合索引

### 全量结构快照

数据库全量基线见：

- [postgres.sql](/D:/ceshi/xiansuo/database/postgres.sql)

## 7. 本地启动方式

### 先准备数据库

```powershell
npm run db:init
```

### 写入演示数据

```powershell
npm run demo:seed
```

### 启动服务

```powershell
npm run dev
```

如果 `3000` 端口不可用，可以改端口启动：

```powershell
$env:PORT='3197'
npm run dev
```

默认页面：

- [任务页](http://127.0.0.1:3000/tasks)
- [结果页](http://127.0.0.1:3000/results)
- [线索库](http://127.0.0.1:3000/library)

## 8. 抓取与抽取说明

### 候选页发现

- 基于任务中的省、市和关键词生成公开搜索查询
- 当前 MVP 主要通过公开搜索结果页发现候选链接
- 查询会按分页扩展，以支撑较大任务量

### 任务进度记录

任务页当前会展示三类诊断信息：

- 最近抓取进度
- 失败链接样本
- 重试记录

这三类信息都已持久化到 PostgreSQL，不再只是内存态。

任务详情页会进一步补充两类趋势信息：

- 最近失败趋势
- 最近失败原因分类
- 最近成功入池趋势

### 来源适配

当前已经单独细化三类来源适配：

- 地图页适配
  更关注商户名、地图电话、地图地址、位置类文本
- 官网适配
  更关注 `og:site_name`、品牌词、联系页与展厅地址
- 公众号适配
  更关注文章标题、账号名、文中联系方式和公开地址

另外已经补充 JSON-LD 提取，用来增强名称、品牌、地址和电话识别。

为了方便后续继续细化规则，平台规则命中样本库已单独沉淀在：
- [platform-hit-samples.md](/D:/ceshi/xiansuo/custom/rule-samples/platform-hit-samples.md)

## 9. 筛选与搜索说明

结果页和线索库页当前支持：

- 省份筛选
- 城市筛选
- 品牌筛选
- 线索类型筛选
- 来源平台筛选
- 匹配分下限筛选
- 直接搜索

直接搜索会同时匹配：

- 名称
- 品牌
- 省份
- 城市
- 联系方式
- 地址
- 原始标题
- 原始摘要
- 来源链接

当前版本中，结果页和线索库页的直接搜索已经下沉到 PostgreSQL `ILIKE` 查询，不再是服务端内存过滤。

当前数据库还补充了搜索优化索引，包括：

- `task_id + created_at` 详情页读取索引
- `task_id + match_score + created_at` 任务详情页排序索引
- `review_status + match_score + created_at` 结果与线索库通用排序索引
- `province + city + match_score + created_at` 区域筛选组合索引
- `source_platform + lead_type + match_score + created_at` 来源与类型组合索引
- `brand + match_score + created_at` 品牌筛选组合索引
- `source_platform`、`brand` 等筛选索引
- `name`、`brand`、`address`、`raw_title`、`raw_summary`、`source_url` 的 `pg_trgm` 索引

## 10. 常用 API

- `POST /api/tasks`
  创建任务
- `GET /api/tasks`
  查询任务列表
- `GET /api/tasks/:id`
  查询单个任务详情与最近线索
- `GET /api/results`
  查询结果列表
- `GET /api/results/:id`
  查询单条线索
- `POST /api/leads/:id/review`
  审核线索
- `GET /api/leads/export.csv`
  导出已保留线索
- `POST /api/demo/reset`
  重置演示数据

## 11. 当前限制

- 候选页发现仍以公开搜索结果页为主，稳定性仍是 MVP 水平
- 任务执行仍是单进程内队列，适合当前演示和轻量任务，不适合高并发生产场景
- 来源适配器已经拆分，但还不是完整的平台级解析器
- 字段识别目前仍以规则法为主，后续可以在不突破业务边界的前提下增加 AI 辅助判断

## 12. 业务边界提醒

系统只允许采集公开商务信息，例如：

- 门店名称
- 品牌名称
- 城市
- 公开电话
- 公开联系入口
- 公开地址
- 来源链接

系统明确不做：

- 私人微信号采集
- 非公开手机号采集
- 登录后信息抓取
- 验证码绕过
- 权限破解
- 评论区或私人主页扒取个人信息

这个边界是当前项目的核心约束，后续迭代也必须继续遵守。
