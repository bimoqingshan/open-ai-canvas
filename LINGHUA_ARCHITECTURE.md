# Linghua 二开架构约定

本文定义 linghua-tv 在 open-ai-canvas 上的本地扩展边界。目标是让上游目录尽量保持原样，本地功能集中维护；上游升级时可以先合并上游，再逐个检查少数接入点。

## 现状与原则

- 当前 checkout 的 `origin` 是 `https://github.com/bimoqingshan/open-ai-canvas.git`，HEAD 跟踪 `origin/main`；本地工作区当前没有未提交改动。上游仓库地址应作为单独 remote 配置，不要把 fork remote 与上游 remote 混为一谈。
- 后端已经有独立的 `yingce_schema_migrations` 扩展迁移台账，但当前本地扩展模型仍与上游模型共用 `backend/internal/model`、`database.Models()` 和启动迁移流程。这是可参考的迁移先例，不等于新增 linghua 功能已经获得隔离。
- SQLite 与 PostgreSQL 需要共用可移植的命名规则，因此 linghua 新表统一使用 `linghua_` 前缀；迁移版本、名称和校验和记录到独立的 `linghua_schema_migrations`。
- `schema_migrations` 与 `yingce_schema_migrations` 均属于现有链路。新增 linghua 功能不得占用它们的版本号，也不得修改已有迁移、校验和或上游表结构。
- 二开代码遵循上游的 Go、React、API、错误处理、鉴权、测试和设计系统规范；隔离目录不是绕过项目规范的理由。

## 代码边界

每个新功能按职责放入 linghua 命名空间，避免散落到上游业务目录：

```text
backend/internal/linghua/<feature>/       # 功能编排与业务规则
backend/internal/linghua/<feature>/model  # 仅该功能的数据模型
backend/internal/linghua/<feature>/repository
backend/internal/linghua/<feature>/handler
backend/internal/database/linghua_*      # 独立迁移和迁移测试
web/src/linghua/<feature>/                # 页面、组件、状态和功能 API
web/src/linghua/navigation.ts             # 本地菜单定义
web/src/linghua/routes.tsx                # 本地路由定义
```

目录可按实际复杂度精简，不为简单功能机械创建空层。依赖方向沿用上游：HTTP handler 解析请求并调用业务；业务负责资源归属、权限和状态校验；repository 负责持久化。前端 API 使用 `web/src/services/api/request.ts` 导出的 `http`，不得在本地功能中另建 Axios client。

新增功能尽量只在上游组合入口接线：后端在服务器路由注册和数据库迁移组合处调用 linghua 注册函数；前端在 `web/src/router.tsx` 和 `web/src/components/layout/workspace-sidebar-nav.tsx` 合并本地 routes/nav。具体改动前先重读这些入口，保持接线代码短，不把功能实现写进接线文件。若上游提供等价注册扩展点，优先使用扩展点。

## 数据库隔离

1. 新功能的每张表必须新建，表名使用 `linghua_<feature>_<entity>`。新功能不得向上游表增加列、索引、约束或触发器，不得重命名、删除或回填上游表。
2. 每个功能新增表自己的模型和迁移。迁移只允许创建/演化 `linghua_` 前缀表；禁止对 `users`、`tasks`、`resources` 等上游表调用 `AutoMigrate`、`AddColumn`、`DropColumn` 或直接 DDL。
3. 用户、资源、项目等上游实体只保存其稳定 ID 到 linghua 表。读取或写入关联资源时，调用上游服务并校验当前用户、资源归属和业务状态；不复制上游数据，也不以外键级联删除上游记录。
4. 新迁移使用单独的 `linghua_schema_migrations` 台账和独立递增版本。迁移必须事务化、幂等，并覆盖 SQLite 与 PostgreSQL；已发布迁移的名称和校验和不可改写。
5. `database.MigrateSchema`、Schema 状态检查和 `migrate-schema verify` 是上游现有统一入口。接入 linghua 链时必须保留上游迁移执行顺序与错误语义，并让启动状态同时校验上游、现有 yingce 和 linghua 三条账本。不能只在开发环境手工运行 linghua 迁移。
6. 数据库文档需列出 linghua 新表、所有者、关联 ID、保留策略和迁移版本；SQLite → PostgreSQL 复制清单也必须包含新增表。

“新增表”是兼容上游升级的硬边界，不代表可以绕开业务归属、权限和事务检查。若需求确实依赖修改上游表，应先调整功能数据设计，继续用扩展表关联；不得把修改上游结构当作默认方案。

## 菜单、路由与 UI

- 路径统一使用 `/linghua/<feature>`；管理员入口使用 `/admin/linghua/<feature>`，避免占用上游路径。
- 菜单项由 `web/src/linghua/navigation.ts` 维护，再由 sidebar 入口合并；路由由 `web/src/linghua/routes.tsx` 维护，再由 Router 入口挂载。鉴权和功能可用性需要同时在页面路由与后端 API 校验，隐藏菜单不构成权限控制。
- 本地页面、API、状态、样式和翻译放在 `web/src/linghua/<feature>/`。共用现有主题 token、组件和请求封装，不复制上游组件形成长期分叉。
- 本地 UI 改造优先通过自有组件、功能级 class 和局部样式覆盖实现。需要调整通用侧栏/顶栏时，把改动限制在必要的接入点，并避免无关重排和格式化；不通过全局选择器大范围覆盖上游组件。
- 不把可变产品数据写进菜单代码；菜单项只放固定路由与显示元信息，动态权限由现有用户能力/feature 状态提供。

## 上游同步方式

建立 `upstream` remote 指向 `ddcat-ai/open-ai-canvas`，`origin` 保持指向实际 fork；本地功能放在 `codex/linghua-*` 或 `linghua/*` 分支，不在上游 `main` 上直接开发。同步时按此顺序：

1. 更新 `upstream/main`，在本地集成分支合并或 rebase 上游提交。
2. 先解决上游变更，再重放 linghua 功能提交；扩展目录中的功能实现应尽量不与上游路径重叠。
3. 重点审查组合接入点：`backend/internal/database/migrations.go`、后端路由注册、`web/src/router.tsx`、`web/src/components/layout/workspace-sidebar-nav.tsx`，以及实际被本地 UI 覆盖的样式入口。
4. 检查上游 schema 版本、迁移检查、模型复制清单、路由/API 合同和 feature availability 是否变化；确认本地表仍只在 linghua 迁移中创建。
5. 对变更涉及的后端和前端执行项目规定的最小专项验证；发布前按仓库 `AGENTS.md` 执行推送前验证。

避免把大量本地 UI 重做和业务功能堆成单个提交。按“菜单接入”“独立业务模块”“界面局部改造”拆分提交，可让升级冲突落在较小的补丁上。

## 每个功能的验收清单

- 新增表均以 `linghua_` 开头，未改动上游表结构和历史迁移记录。
- 上游用户/资源/项目 ID 在业务边界验证归属；所有管理写操作在后端校验权限。
- linghua 迁移台账能独立升级、重复执行并验证；SQLite 和 PostgreSQL 的表结构一致。
- 页面路由和菜单均在 linghua 文件中定义，并只通过约定组合点接入。
- 页面状态、加载、空态、失败、窄屏和明暗主题符合上游约定；API 错误不会被默认值静默吞掉。
- 对应数据库专题、功能说明和迁移操作文档已更新。

## 当前落地状态

- Linghua 首页、社区、活动、学习广场和新增页面导航配置已落地；二开专用表使用 `linghua_` 前缀，迁移由 `linghua_schema_migrations` 独立记录。
- 管理端统一控制学习广场、社区作品、活动赛事三个新增页面的全站菜单显示；上游既有菜单不进入 Linghua 菜单设置。
- 管理端将社区作品审核、活动发布、首页轮播、学习广场课程编辑和个性化主菜单拆成独立入口；主菜单只允许指向 `/linghua/` 页面，所有显示状态由管理员统一控制。
- 学习广场沿用 Linghua 源工程的分类、课程卡片、Markdown 章节和练习跳转配置，不再以灵感来源开关替代课程管理；配置保存在 `linghua_academy_settings`。
- `MigrateSchema` 与 `migrate-schema verify` 同时校验上游、出彩和 Linghua 迁移链；SQLite → PostgreSQL 复制清单包含 Linghua 表。
