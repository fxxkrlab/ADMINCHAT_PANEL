# ADMINCHAT Panel - 系统架构文档

## 技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| 后端框架 | Python + FastAPI | Python 3.12, FastAPI 0.110+ |
| Bot 框架 | aiogram 3 | 3.x |
| 前端框架 | React + TypeScript | React 18, TS 5.x |
| 构建工具 | Vite | 5.x |
| UI 组件库 | shadcn/ui + Tailwind CSS | Tailwind 4.x |
| 数据库 | PostgreSQL | 16 |
| ORM | SQLAlchemy 2.0 (async) | 2.0+ |
| 数据库迁移 | Alembic | 1.13+ |
| 缓存/消息 | Redis | 7.x |
| 实时通信 | WebSocket (FastAPI native) | - |
| 定时任务 | APScheduler | 3.x |
| 容器化 | Docker + Docker Compose | - |
| 镜像仓库 | GHCR (GitHub Container Registry) | - |
| 反向代理 | Caddy / Nginx (用户自选) | - |

## 系统架构图

```
                    ┌──────────────────────┐
                    │   Cloudflare (CDN)   │
                    │   + Turnstile 验证    │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   Nginx / Caddy      │
                    │   (反向代理+TLS)      │
                    └───┬──────────────┬───┘
                        │              │
              ┌─────────▼──┐    ┌──────▼──────────┐
              │ React SPA  │    │  FastAPI Backend │
              │ (静态资源)  │    │                  │
              └────────────┘    │  ┌────────────┐  │
                                │  │ REST API   │  │
                                │  │ /api/v1/*  │  │
                                │  ├────────────┤  │
                                │  │ WebSocket  │  │
                                │  │ /ws/chat   │  │
                                │  ├────────────┤  │
                                │  │Bot Manager │  │
                                │  │(多aiogram) │  │
                                │  ├────────────┤  │
                                │  │FAQ Engine  │  │
                                │  ├────────────┤  │
                                │  │RAG Module  │  │
                                │  ├────────────┤  │
                                │  │Scheduler   │  │
                                │  └────────────┘  │
                                └───┬──────────┬───┘
                                    │          │
                          ┌─────────▼──┐ ┌─────▼─────┐
                          │ PostgreSQL │ │   Redis   │
                          │            │ │           │
                          │- 用户数据   │ │- Bot限流  │
                          │- 消息记录   │ │- WS pub/sub│
                          │- FAQ规则   │ │- 媒体缓存  │
                          │- 权限/角色  │ │- 会话状态  │
                          │- 30 tables │ │           │
                          └────────────┘ └───────────┘
```

## 后端模块划分

```
backend/
├── app/
│   ├── main.py                 # FastAPI 入口, 生命周期管理
│   ├── config.py               # 配置管理 (env vars)
│   ├── database.py             # 数据库连接, session
│   │
│   ├── models/                 # SQLAlchemy ORM 模型
│   │   ├── user.py             # TG 用户
│   │   ├── admin.py            # 面板管理员/客服
│   │   ├── message.py          # 消息记录
│   │   ├── bot.py              # Bot 池
│   │   ├── group.py            # TG 群组
│   │   ├── faq.py              # FAQ 问题/答案/规则
│   │   ├── tag.py              # 用户标签
│   │   └── conversation.py     # 会话 (已处理/未处理)
│   │
│   ├── schemas/                # Pydantic 请求/响应模型
│   │
│   ├── api/                    # REST API 路由
│   │   ├── v1/
│   │   │   ├── auth.py         # 登录/JWT
│   │   │   ├── users.py        # TG 用户管理
│   │   │   ├── conversations.py# 会话管理
│   │   │   ├── messages.py     # 消息收发
│   │   │   ├── bots.py         # Bot 池管理
│   │   │   ├── faq.py          # FAQ CRUD
│   │   │   ├── stats.py        # 统计数据
│   │   │   ├── admin.py        # 管理员管理
│   │   │   └── settings.py     # 系统设置
│   │   └── deps.py             # 依赖注入 (权限检查等)
│   │
│   ├── ws/                     # WebSocket
│   │   └── chat.py             # 聊天实时通信
│   │
│   ├── bot/                    # Telegram Bot 核心
│   │   ├── manager.py          # 多 Bot 生命周期管理
│   │   ├── handlers/           # 消息处理器
│   │   │   ├── private.py      # 私聊处理
│   │   │   ├── group.py        # 群组 @ 处理
│   │   │   └── commands.py     # 指令处理 (/FAQRanking等)
│   │   ├── dispatcher.py       # 消息分发 (选择哪个bot回复)
│   │   └── rate_limiter.py     # 限流检测与 bot 轮转
│   │
│   ├── faq/                    # FAQ 引擎
│   │   ├── engine.py           # 匹配引擎主逻辑
│   │   ├── matcher.py          # 正则/关键字匹配器 (5 modes: exact/prefix/contains/regex/catch_all)
│   │   ├── ai_handler.py       # AI 回复/润色
│   │   ├── keyword_filter.py   # 遗漏关键词过滤器 (keyword_matches_filter)
│   │   ├── rag_handler.py      # RAG 兼容 wrapper
│   │   └── rag/                # 模块化 RAG 系统
│   │       ├── __init__.py     # 工厂函数 get_rag_provider()
│   │       ├── base.py         # RAGProvider 抽象基类
│   │       └── dify_provider.py # Dify Knowledge API 实现
│   │
│   ├── services/               # 业务逻辑层
│   │   ├── media.py            # 媒体文件缓存管理
│   │   ├── turnstile.py        # CF Turnstile 验证
│   │   ├── stats.py            # 统计计算
│   │   └── knowledge_gap.py    # 遗漏知识点分析
│   │
│   ├── tasks/                  # 定时任务
│   │   └── scheduler.py        # APScheduler 配置
│   │
│   └── utils/                  # 工具函数
│       ├── markdown.py         # TG Markdown 格式处理
│       └── security.py         # JWT, 密码哈希等
│
├── alembic/                    # 数据库迁移
├── tests/                      # 测试
├── requirements.txt
└── Dockerfile
```

## 前端模块划分

```
frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes/                 # 页面路由
│   │
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx       # 统计面板
│   │   ├── Chat.tsx            # 聊天主页 (侧边栏+聊天框)
│   │   ├── UsersGrid.tsx       # 用户网格
│   │   ├── UserDetail.tsx      # 用户详情
│   │   ├── Blacklist.tsx       # 黑名单
│   │   ├── BotPool.tsx         # Bot 池管理
│   │   ├── FAQList.tsx         # FAQ 列表
│   │   ├── FAQEditor.tsx       # FAQ 左右分屏编辑
│   │   ├── FAQRanking.tsx      # 问题排行榜
│   │   ├── MissedKnowledge.tsx # 遗漏知识点
│   │   ├── AISettings.tsx      # AI 配置
│   │   ├── AdminManage.tsx     # 管理员管理
│   │   └── Settings.tsx        # 系统设置
│   │
│   ├── components/
│   │   ├── layout/             # 布局组件 (Sidebar, Header, etc.)
│   │   ├── chat/               # 聊天相关组件
│   │   │   ├── ConversationList.tsx   # 侧边栏会话列表
│   │   │   ├── ChatWindow.tsx         # 聊天窗口
│   │   │   ├── MessageBubble.tsx      # 消息气泡
│   │   │   ├── MessageInput.tsx       # 输入框 (Markdown+图片)
│   │   │   └── UserInfoCard.tsx       # 用户信息卡片
│   │   ├── faq/                # FAQ 编辑相关组件
│   │   └── ui/                 # shadcn/ui 组件
│   │
│   ├── hooks/                  # 自定义 hooks
│   │   ├── useWebSocket.ts     # WebSocket 连接管理
│   │   └── useAuth.ts          # 认证状态
│   │
│   ├── services/               # API 调用
│   │   └── api.ts
│   │
│   ├── stores/                 # 状态管理 (Zustand)
│   │
│   └── types/                  # TypeScript 类型定义
│
├── public/
├── index.html
├── tailwind.config.ts
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Docker 部署架构

```yaml
# docker-compose.yml 概览
services:
  backend:
    image: ghcr.io/<owner>/adminchat-backend:latest
    depends_on: [postgres, redis]
    env_file: .env

  frontend:
    image: ghcr.io/<owner>/adminchat-frontend:latest

  postgres:
    image: postgres:16-alpine
    volumes: [pgdata:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine

  caddy:  # 或 nginx
    ports: ["80:80", "443:443"]
```

## 通信流程

### 用户私聊 Bot → Web 面板

```
TG User → Bot(aiogram) → 存DB + Redis pub → WebSocket → Web 面板
```

### Web 面板回复 → TG 用户

```
Web 面板 → REST API → Bot Dispatcher(选bot) → aiogram send → TG User
```

### 群组 @Bot → Web → 回复

```
TG群@Bot → Bot Handler → 存DB + Redis pub → WebSocket → Web面板
Web回复 → Dispatcher → 优先原Bot → 429? → 换Bot池其他Bot → reply用户
```
