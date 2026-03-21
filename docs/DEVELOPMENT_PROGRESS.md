# ADMINCHAT Panel - 开发进度跟踪

> 用于 vibe coding 时监控任务进度与管理状态。
> 标记规则: ⬜ 未开始 | 🔧 进行中 | ✅ 完成 | ❌ 阻塞

## Phase 1: 项目初始化与基础架构

- ✅ 1.1 初始化后端项目结构 (FastAPI + pip)
- ✅ 1.2 初始化前端项目结构 (Vite + React + TS)
- ✅ 1.3 配置 Docker Compose (PG + Redis + 后端 + 前端)
- ✅ 1.4 配置 Alembic 数据库迁移
- ✅ 1.5 创建所有数据库表 (23 tables)
- ✅ 1.6 配置 GitHub Actions CI/CD
- ✅ 1.7 配置 Tailwind + 设计系统颜色
- ✅ 1.8 前端路由骨架 + 布局框架 (侧边导航 + 顶栏)

## Phase 2: 认证与权限

- ✅ 2.1 后端 JWT 认证 (login/refresh/logout)
- ✅ 2.2 权限中间件 (role-based + permission-based)
- ✅ 2.3 初始管理员自动创建 (首次启动)
- ✅ 2.4 前端登录页 (品牌展示 + 登录表单)
- ✅ 2.5 前端认证状态管理 (Zustand store + persist)
- ✅ 2.6 前端路由守卫 (权限检查 + token 刷新)

## Phase 3: Bot 核心功能

- ✅ 3.1 BotManager: 多 bot 生命周期管理
- ✅ 3.2 aiogram handlers: 私聊消息接收
- ✅ 3.3 aiogram handlers: 群组 @bot 消息接收
- ✅ 3.4 消息存储到 DB + Redis PUBLISH
- ✅ 3.5 Bot 限流检测 (Redis token bucket)
- ✅ 3.6 消息发送 + bot failover 逻辑
- ✅ 3.7 分布式锁防重复发送
- ✅ 3.8 Webhook / Polling 双模式支持
- ✅ 3.9 /FAQRanking 群内指令

## Phase 4: 实时通信 (WebSocket)

- ✅ 4.1 WebSocket 端点 (/ws/chat)
- ✅ 4.2 Redis pub/sub → WebSocket 消息分发
- ✅ 4.3 前端 WebSocket hook (连接/重连/心跳)
- ✅ 4.4 消息实时推送到聊天窗口
- ✅ 4.5 会话状态实时同步
- ✅ 4.6 Bot 状态实时推送

## Phase 5: 聊天主页 (Chat)

- ✅ 5.1 后端: 会话列表 API (排序/筛选/分页)
- ✅ 5.2 后端: 消息历史 API
- ✅ 5.3 后端: 发送消息 API (文本 + Markdown)
- ✅ 5.4 后端: 发送图片/媒体 API
- ✅ 5.5 前端: 会话侧边栏列表
- ✅ 5.6 前端: 聊天窗口 (消息气泡 + Markdown 渲染)
- ✅ 5.7 前端: 消息输入框 (Markdown 编辑 + 图片上传)
- ✅ 5.8 前端: 群消息/私聊消息显示区分
- ✅ 5.9 前端: 标记已处理/未处理
- ✅ 5.10 前端: 会话分配功能

## Phase 6: 用户管理

- ✅ 6.1 后端: 用户 CRUD + 搜索 API
- ✅ 6.2 后端: 标签系统 API
- ✅ 6.3 后端: 分组系统 API
- ✅ 6.4 后端: 拉黑/取消拉黑 API
- ✅ 6.5 后端: 用户头像获取
- ✅ 6.6 前端: UsersGrid 用户网格页
- ✅ 6.7 前端: UserDetail 用户详情页
- ✅ 6.8 前端: Blacklist 黑名单页

## Phase 7: Bot 池管理

- ✅ 7.1 后端: Bot CRUD API
- ✅ 7.2 后端: Bot 实时状态 API
- ✅ 7.3 后端: Bot 热加载 (新增/删除不重启服务)
- ✅ 7.4 前端: BotPool 管理页

## Phase 8: FAQ 系统

- ✅ 8.1 后端: FAQ 问题/答案/规则 CRUD API
- ✅ 8.2 后端: FAQ 匹配引擎 (4 种 match_mode)
- ✅ 8.3 后端: FAQ 命中统计
- ✅ 8.4 前端: FAQList 列表页
- ✅ 8.5 前端: FAQEditor 左右分屏编辑器
- ✅ 8.6 前端: FAQRanking 排行榜页

## Phase 9: 遗漏知识点

- ✅ 9.1 后端: 未匹配消息记录
- ✅ 9.2 后端: 关键词提取定时任务 (凌晨3点)
- ✅ 9.3 后端: 遗漏知识点 API
- ✅ 9.4 前端: MissedKnowledge 页面

## Phase 10: AI 集成

- ✅ 10.1 后端: AI 配置 CRUD API
- ✅ 10.2 后端: AI 回复处理器 (ai_only)
- ✅ 10.3 后端: AI 润色处理器 (ai_polish)
- ✅ 10.4 后端: AI 兜底处理器 (ai_fallback)
- ✅ 10.5 后端: AI 意图识别处理器 (ai_intent)
- ✅ 10.6 后端: AI 模板填充处理器 (ai_template)
- ✅ 10.7 后端: AI 综合回答处理器 (ai_classify_and_answer)
- ✅ 10.8 后端: AI 用量限制 + 统计
- ✅ 10.9 后端: RAG 接口预留
- ✅ 10.10 前端: AISettings 配置页

## Phase 11: 统计面板

- ✅ 11.1 后端: Dashboard 统计 API (真实DB查询)
- ✅ 11.2 前端: Dashboard 页面 (统计卡片 + 图表 + 自动刷新)

## Phase 12: 管理员与系统设置

- ✅ 12.1 后端: 管理员 CRUD API
- ✅ 12.2 后端: 权限管理 API
- ✅ 12.3 后端: 系统设置 API
- ✅ 12.4 前端: AdminManage 页面
- ✅ 12.5 前端: Settings 页面

## Phase 13: Cloudflare Turnstile

- ✅ 13.1 后端: Turnstile 验证 API
- ✅ 13.2 后端: Bot 私聊验证检查中间件
- ⬜ 13.3 前端: Turnstile 验证页面

## Phase 14: 媒体缓存

- ✅ 14.1 后端: 媒体下载 + 缓存逻辑
- ✅ 14.2 后端: 缓存过期清理定时任务
- ✅ 14.3 后端: 过期媒体重新拉取

## Phase 15: 审计与日志

- ✅ 15.1 后端: 操作审计日志服务
- ⬜ 15.2 前端: 审计日志查看页面 (可选)

## Phase 16: 测试与优化

- ⬜ 16.1 后端单元测试 (核心逻辑)
- ⬜ 16.2 API 集成测试
- ⬜ 16.3 前端组件测试
- ⬜ 16.4 性能优化 (N+1 查询, 缓存策略)
- ⬜ 16.5 安全审计 (XSS, CSRF, SQL注入)

## Phase 17: Docker 与发布

- ✅ 17.1 后端 Dockerfile
- ✅ 17.2 前端 Dockerfile (多阶段构建)
- ✅ 17.3 docker-compose.yml 完善
- ✅ 17.4 GitHub Actions 自动构建 + 推送 GHCR
- ✅ 17.5 .env.example + 部署文档

---

## 变更记录

| 日期 | 变更内容 |
|------|---------|
| 2026-03-21 | 初始创建开发计划 |
| 2026-03-21 | Phase 1-12, 13(部分), 14, 15(部分), 17 全部完成 |
