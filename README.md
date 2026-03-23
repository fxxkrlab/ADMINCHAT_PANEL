[English](./README_EN.md) | 中文

---

<!-- Community & Status -->
![GitHub Release](https://img.shields.io/github/v/release/fxxkrlab/ADMINCHAT_PANEL?style=flat-square&color=00D9FF&label=Release)
![GitHub Stars](https://img.shields.io/github/stars/fxxkrlab/ADMINCHAT_PANEL?style=flat-square&color=FFD700&logo=github)
![GitHub Forks](https://img.shields.io/github/forks/fxxkrlab/ADMINCHAT_PANEL?style=flat-square&color=8B5CF6&logo=github)
![GitHub Issues](https://img.shields.io/github/issues/fxxkrlab/ADMINCHAT_PANEL?style=flat-square&color=FF8800&logo=github)
![GitHub Last Commit](https://img.shields.io/github/last-commit/fxxkrlab/ADMINCHAT_PANEL?style=flat-square&color=059669&logo=github)
![Build Status](https://img.shields.io/github/actions/workflow/status/fxxkrlab/ADMINCHAT_PANEL/build-and-push.yml?style=flat-square&label=Build&logo=githubactions&logoColor=white)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-059669?style=flat-square&logo=git&logoColor=white)

<!-- Tech Stack -->
![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)
![Telegram](https://img.shields.io/badge/Telegram-Bot_API-26A5E4?style=flat-square&logo=telegram&logoColor=white)
![aiogram](https://img.shields.io/badge/aiogram-3.x-2CA5E0?style=flat-square&logo=telegram&logoColor=white)
![License](https://img.shields.io/badge/License-GPL_3.0-blue?style=flat-square)

<!-- Fun / Vibe -->
![Vibe Coded](https://img.shields.io/badge/Vibe-Coded_%F0%9F%8E%B6-FF69B4?style=flat-square)
![Built with AI](https://img.shields.io/badge/Built_with-Claude_AI_%F0%9F%A4%96-8B5CF6?style=flat-square)
![Made with Love](https://img.shields.io/badge/Made_with-%E2%9D%A4%EF%B8%8F-FF4444?style=flat-square)
![Powered by Coffee](https://img.shields.io/badge/Powered_by-%E2%98%95_Coffee-6F4E37?style=flat-square)

# ADMINCHAT Panel

> &reg; 2026 NovaHelix & SAKAKIBARA. All rights reserved.

**Telegram 双向消息转发 Bot + Web 客服管理面板** &mdash; 一站式 Telegram 客户服务解决方案，支持多 Bot 池管理、FAQ 自动回复引擎（5 种匹配模式 + 8 种回复模式）、RAG 知识库检索、AI Provider OAuth 多认证、遗漏关键词过滤器和实时 Web 聊天。

---

## 项目简介

ADMINCHAT Panel 是一个功能完备的 Telegram 客服管理系统。它将 Telegram Bot 收到的私聊消息和群组 @提及 消息统一转发到 Web 管理面板，让管理员/客服人员可以在浏览器中实时查看并回复用户消息，同时支持 FAQ 自动回复、AI 智能应答、RAG 知识库检索、用户管理等丰富功能。

### v0.8.0 新特性

- **遗漏关键词过滤器** &mdash; 全新的可配置过滤系统，支持 4 种匹配模式（精确/前缀/包含/正则），可自动跳过不相关的 Bot 命令和无效关键词（如 `/start`、`/help` 等），避免这些命令污染遗漏知识点统计。管理界面位于遗漏知识点页面 `/faq/missed`
- **Catch All 兜底匹配模式** &mdash; FAQ 问题新增 `catch_all` 匹配模式，匹配任何用户消息。设计为低优先级兜底规则，适用于 RAG 知识库回复场景 &mdash; 当所有精确/前缀/包含/正则规则均未命中时，自动触发兜底 RAG 检索
- **代码质量全面提升** &mdash; 修复会话列表、用户列表、FAQ 列表中的 N+1 查询问题；修复 Pydantic Schema 中的可变默认值；补齐缺失的外键约束和数据库索引；前端新增全局 Error Boundary 组件，捕获并优雅处理运行时错误；修复空 catch 块等代码异味
- **新增数据库表** &mdash; 新增 `missed_keyword_filters` 表，数据库共 30 张表

## 核心功能

### 消息转发与通信
- **多 Bot 池管理** &mdash; 支持无限添加 Bot，自动限流检测（Redis 令牌桶算法）与故障转移
- **双向消息转发** &mdash; 私聊 + 群组 @Bot，文本/图片/视频/文件/Markdown 格式完整保留
- **Web 实时聊天** &mdash; 基于 WebSocket 的实时消息推送，类似客服系统的聊天界面
- **Bot 分组 + FAQ 分组路由** &mdash; Bot 按组管理，FAQ 规则按 组-分类 两级归类，匹配后自动选择对应组的 Bot 回复

### FAQ 自动回复引擎
- **5 种匹配模式** &mdash; 精确匹配 / 前缀匹配 / 包含匹配 / 正则匹配 / Catch All 兜底匹配
- **8 种回复模式** &mdash; 直接回复 / 纯 AI / AI 润色 / AI 兜底 / AI 意图识别 / 模板填充 / RAG 知识库 / AI 综合回答
- **遗漏关键词过滤器** &mdash; 可配置过滤规则（4 种匹配模式），自动跳过 Bot 命令等无效关键词，保持遗漏知识点统计的准确性
- **遗漏知识点分析** &mdash; 自动统计未匹配问题，每日凌晨 3 点更新排行榜

### AI 与知识库
- **RAG 知识库检索** &mdash; 模块化 RAG 架构，已对接 Dify Knowledge API（支持 GTE-multilingual + pgvector），模块化 `rag_configs` 配置，可扩展其他 RAG 平台
- **AI Provider OAuth 多认证** &mdash; 支持 API Key / OpenAI OAuth / Claude OAuth / Claude Session Token / Gemini OAuth 五种认证方式，自动 Token 刷新
- **AI 集成** &mdash; 兼容 OpenAI API 格式，支持多 AI 服务商配置

### 用户与安全
- **用户管理** &mdash; 标签/分组/拉黑/搜索，完整的 TG 用户信息展示
- **Cloudflare Turnstile** &mdash; 私聊用户人机验证，防止滥用
- **角色权限系统** &mdash; Super Admin / Admin / Agent 三级权限，细粒度权限控制
- **操作审计日志** &mdash; 关键操作自动记录，可追溯

### 部署与运维
- **Docker 一键部署** &mdash; `docker compose up` 即可运行，支持 GHCR 镜像发布
- **全局 Error Boundary** &mdash; 前端运行时错误优雅降级，不影响整体系统可用性

## 界面预览

<p align="center">
  <img src="docs/designs/3.jpg" width="45%" alt="Dashboard" />
  <img src="docs/designs/2.jpg" width="45%" alt="Chat" />
</p>
<p align="center">
  <img src="docs/designs/4.jpg" width="45%" alt="Bot Pool" />
  <img src="docs/designs/7.jpg" width="45%" alt="FAQ Editor" />
</p>
<p align="center">
  <img src="docs/designs/6.jpg" width="45%" alt="Users" />
  <img src="docs/designs/5.jpg" width="45%" alt="Settings" />
</p>
<p align="center">
  <img src="docs/designs/1.jpg" width="45%" alt="Login" />
</p>

## 技术架构

```mermaid
graph TB
    subgraph 前端 Frontend
        React["React 18 + TypeScript"]
        Tailwind["Tailwind CSS + shadcn/ui"]
        Vite["Vite 构建"]
    end

    subgraph 后端 Backend
        FastAPI["FastAPI (async)"]
        aiogram["aiogram 3 (多Bot)"]
        SQLAlchemy["SQLAlchemy 2.0"]
        APScheduler["APScheduler 定时任务"]
        OAuthModule["OAuth 2.0 + PKCE"]
    end

    subgraph 存储 Storage
        PostgreSQL[("PostgreSQL 16")]
        Redis[("Redis 7")]
    end

    subgraph 外部服务 External
        TelegramAPI["Telegram Bot API"]
        CloudflareAPI["Cloudflare Turnstile"]
        AIAPI["AI API (OpenAI 兼容)"]
        DifyAPI["Dify Knowledge API"]
        OAuthProviders["OAuth Providers\n(OpenAI/Claude/Gemini)"]
    end

    React -->|"REST API + WebSocket"| FastAPI
    FastAPI --> aiogram
    FastAPI --> SQLAlchemy
    FastAPI --> OAuthModule
    SQLAlchemy --> PostgreSQL
    FastAPI --> Redis
    aiogram -->|"Bot API"| TelegramAPI
    FastAPI -->|"人机验证"| CloudflareAPI
    FastAPI -->|"AI 回复"| AIAPI
    FastAPI -->|"RAG 检索"| DifyAPI
    OAuthModule -->|"OAuth 2.0 + PKCE"| OAuthProviders
```

## 消息路由流程

```mermaid
flowchart LR
    A["TG 用户"] -->|"私聊 / 群@ Bot"| B["Bot 池"]
    B -->|"存储 + Redis 发布"| C["PostgreSQL + Redis"]
    C -->|"WebSocket 推送"| D["Web 管理面板"]
    D -->|"管理员回复"| E{"Bot 调度器"}
    E -->|"优先原路 Bot"| F["Bot1"]
    E -->|"限流时故障转移"| G["Bot2 / Bot3"]
    F & G -->|"reply 用户消息"| A
```

## FAQ 匹配与回复流程

```mermaid
flowchart TB
    MSG["用户消息"] --> FILTER{"遗漏关键词过滤器"}
    FILTER -->|"命中过滤规则"| SKIP["跳过 (不记录遗漏)"]
    FILTER -->|"未命中过滤"| MATCH{"FAQ 匹配引擎"}
    MATCH -->|"exact 精确匹配"| HIT["命中规则"]
    MATCH -->|"prefix 前缀匹配"| HIT
    MATCH -->|"contains 包含匹配"| HIT
    MATCH -->|"regex 正则匹配"| HIT
    MATCH -->|"catch_all 兜底匹配"| HIT
    MATCH -->|"全部未命中"| MISSED["记入遗漏知识点"]
    HIT --> REPLY{"回复模式"}
    REPLY --> DIRECT["direct 直接回复"]
    REPLY --> AI["ai_only / ai_polish / ai_fallback"]
    REPLY --> INTENT["ai_intent 意图识别"]
    REPLY --> RAG["rag 知识库检索"]
    REPLY --> CLASSIFY["ai_classify_and_answer 综合回答"]
```

## AI Provider OAuth 认证流程

```mermaid
flowchart TB
    U["管理员"] -->|"选择认证方式"| S{"认证方式选择"}
    S -->|"API Key"| K["手动填写 Key"]
    S -->|"OpenAI/Gemini OAuth"| P["弹窗登录 → 自动回调"]
    S -->|"Claude OAuth"| C["打开链接 → 粘贴 Code"]
    S -->|"Claude Session Token"| T["粘贴 Cookie"]
    K & P & C & T -->|"access_token 存入 api_key 字段"| DB["AiConfig 记录"]
    DB -->|"每 5 分钟检查过期"| R["自动刷新 Token"]
    R -->|"更新 api_key"| DB
```

## 数据库结构

| 表名 | 说明 | 核心字段 |
|------|------|---------|
| `admins` | 管理员/客服 | username, role, permissions (JSONB) |
| `tg_users` | Telegram 用户 | tg_uid, is_blocked, turnstile_verified_at |
| `bots` | Bot 池 | token, priority, is_rate_limited |
| `conversations` | 会话 | status, source_type, assigned_to |
| `messages` | 消息记录 | direction, content_type, faq_matched |
| `tg_groups` | Telegram 群组 | tg_chat_id, title |
| `tags` / `user_tags` | 用户标签 | name, color (多对多) |
| `user_groups` | 用户分组 | name, description |
| `faq_questions` | FAQ 问题/关键词 | keyword, match_mode |
| `faq_answers` | FAQ 答案 | content, content_type |
| `faq_rules` | FAQ 规则 | response_mode, reply_mode, category_id |
| `faq_groups` | FAQ 分组 (一级) | name, bot_group_id |
| `faq_categories` | FAQ 分类 (二级) | name, faq_group_id, bot_group_id |
| `faq_hit_stats` | FAQ 命中统计 | hit_count, date |
| `missed_keywords` | 遗漏知识点 | keyword, occurrence_count |
| `missed_keyword_filters` | 遗漏关键词过滤器 | pattern, match_mode (exact/prefix/contains/regex) |
| `bot_groups` | Bot 分组 | name, description |
| `bot_group_members` | Bot 分组成员 | bot_group_id, bot_id (唯一) |
| `ai_configs` | AI 配置 | base_url, api_key, model, auth_method, oauth_data |
| `ai_usage_logs` | AI 用量日志 | tokens_used, cost_estimate |
| `rag_configs` | RAG 知识库配置 | provider, base_url, api_key, dataset_id, top_k, is_active |
| `system_settings` | 系统设置 | key-value (JSONB) |
| `audit_logs` | 审计日志 | action, target_type, details |

> 共 30 张表，完整设计参见 [docs/DATABASE_DESIGN.md](docs/DATABASE_DESIGN.md)

## FAQ 匹配模式

| 匹配模式 | 代码标识 | 说明 |
|---------|---------|------|
| 精确匹配 | `exact` | 用户消息与关键词完全一致时命中 |
| 前缀匹配 | `prefix` | 用户消息以关键词开头时命中 |
| 包含匹配 | `contains` | 用户消息包含关键词时命中 |
| 正则匹配 | `regex` | 用户消息满足正则表达式时命中 |
| 兜底匹配 | `catch_all` | 匹配任何消息，用于 RAG 知识库兜底规则（最低优先级） |

## FAQ 回复模式

| 模式 | 代码标识 | 说明 |
|------|---------|------|
| 纯正则匹配 | `direct` | 关键词匹配后直接返回预设答案 |
| 纯 AI 回复 | `ai_only` | 用户问题直接交给 AI（有次数限制） |
| AI 润色 | `ai_polish` | 匹配预设答案后让 AI 改写更自然 |
| AI 兜底 | `ai_fallback` | 先走 FAQ，未命中再交 AI |
| AI 意图识别 | `ai_intent` | AI 分析意图后路由到对应 FAQ 分类 |
| 模板填充 | `ai_template` | 预设模板 + AI 动态填充变量 |
| RAG 知识库 | `rag` | 向量检索 (Dify/pgvector) + AI 综合回答 |
| AI 综合回答 | `ai_classify_and_answer` | AI 参考 FAQ 知识库综合生成回答 |

## 遗漏关键词过滤器

遗漏关键词过滤器位于「遗漏知识点」页面（`/faq/missed`），用于过滤不需要记录为遗漏知识点的消息（如 Bot 命令 `/start`、`/help` 等）。

| 过滤模式 | 说明 | 示例 |
|---------|------|------|
| `exact` | 精确匹配 | 过滤 `/start` 仅匹配完全等于 `/start` 的消息 |
| `prefix` | 前缀匹配 | 过滤 `/` 匹配所有以 `/` 开头的 Bot 命令 |
| `contains` | 包含匹配 | 过滤 `bot` 匹配所有包含 `bot` 的消息 |
| `regex` | 正则匹配 | 过滤 `^/\w+` 匹配所有斜杠命令格式的消息 |

## AI Provider 认证方式

| 方式 | 流程 | 说明 |
|------|------|------|
| API Key | 手动填写 | 传统方式，直接输入 Base URL + API Key |
| OpenAI OAuth | 弹窗登录 | OAuth 2.0 + PKCE，浏览器弹窗认证后自动回调 |
| Claude OAuth | 粘贴 Code | OAuth 2.0 + PKCE，Claude 固定回调页面显示 code，手动粘贴 |
| Claude Session Token | 粘贴 Cookie | 从 claude.ai 复制 sessionKey cookie，后端自动换取 token |
| Gemini OAuth | 弹窗登录 | Google OAuth 2.0 + PKCE，浏览器弹窗认证后自动回调 |

> Token 自动刷新：后台每 5 分钟检查即将过期的 OAuth token 并自动续期，服务启动时也会补偿刷新。

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/fxxkrlab/ADMINCHAT_PANEL.git
cd ADMINCHAT_PANEL/deploy

# 配置环境变量
cp .env.example .env
nano .env  # 修改密码、Bot Token、域名等

# 一键启动 (包含 PostgreSQL + Redis + Nginx)
docker compose -f docker-compose.full.yml up -d

# 访问 http://服务器IP
# 默认账号: admin / 密码见 .env 中的 INIT_ADMIN_PASSWORD
```

## 安装方式

详细部署文档见 [`deploy/README.md`](deploy/README.md)

| 方式 | 文件 | 适用场景 |
|------|------|---------|
| Docker Run | [`deploy/docker-run.sh`](deploy/docker-run.sh) | 已有 PG+Redis，只部署应用 |
| Compose 独立版 | [`deploy/docker-compose.standalone.yml`](deploy/docker-compose.standalone.yml) | 已有 PG+Redis，Compose 管理 |
| Compose 一键版 | [`deploy/docker-compose.full.yml`](deploy/docker-compose.full.yml) | 全新服务器，一键全部 |

每种方式都支持 **Named Volume**（Docker 管理）和 **Bind Mount**（映射宿主机目录），在 yml 文件注释中切换。

## 项目结构

```
ADMINCHAT_PANEL/
├── backend/                    # Python 后端
│   ├── app/
│   │   ├── api/v1/            # REST API 路由 (18 个模块)
│   │   ├── bot/               # Telegram Bot 核心
│   │   │   ├── manager.py     # 多 Bot 生命周期管理
│   │   │   ├── handlers/      # 消息处理器 (私聊/群组/指令)
│   │   │   ├── dispatcher.py  # 消息发送 + 故障转移
│   │   │   └── rate_limiter.py# 限流检测 (Redis 令牌桶)
│   │   ├── faq/               # FAQ 引擎
│   │   │   ├── engine.py      # 匹配引擎 (5 种匹配模式)
│   │   │   ├── ai_handler.py  # AI 回复处理 (8 种回复模式)
│   │   │   ├── rag_handler.py # RAG 兼容 wrapper
│   │   │   └── rag/           # 模块化 RAG 系统
│   │   │       ├── base.py    # RAGProvider 抽象基类
│   │   │       └── dify_provider.py  # Dify Knowledge API
│   │   ├── oauth/             # OAuth 2.0 多认证
│   │   │   ├── base.py        # OAuthProvider 抽象基类
│   │   │   ├── encryption.py  # Fernet Token 加密
│   │   │   ├── openai.py      # OpenAI OAuth + PKCE
│   │   │   ├── claude.py      # Claude OAuth + Session Token
│   │   │   ├── gemini.py      # Gemini/Google OAuth + PKCE
│   │   │   └── token_refresh.py # 自动 Token 刷新任务
│   │   ├── models/            # SQLAlchemy ORM (30 张表)
│   │   ├── schemas/           # Pydantic 请求/响应模型
│   │   ├── services/          # 业务服务 (Redis/审计/媒体/Turnstile)
│   │   ├── ws/                # WebSocket 实时通信
│   │   └── tasks/             # 定时任务 (APScheduler)
│   ├── alembic/               # 数据库迁移
│   └── Dockerfile
├── frontend/                   # React 前端
│   ├── src/
│   │   ├── pages/             # 16 个页面
│   │   ├── components/        # 可复用组件 (chat/layout/ui/ai)
│   │   │   ├── ai/           # OAuth 认证组件
│   │   │   │   ├── AuthMethodSelector.tsx  # 认证方式选择器
│   │   │   │   └── OAuthFlowModal.tsx      # OAuth 流程弹窗
│   │   │   └── ErrorBoundary.tsx  # 全局错误边界
│   │   ├── stores/            # Zustand 状态管理
│   │   ├── services/          # API 调用层 (11 个模块)
│   │   ├── hooks/             # 自定义 hooks (WebSocket/debounce)
│   │   └── types/             # TypeScript 类型定义
│   └── Dockerfile
├── deploy/                     # 部署配置
├── docs/                       # 设计文档
├── docker-compose.yml          # 本地开发 (仅 PG+Redis)
├── .env.example
└── LICENSE                     # GPL-3.0
```

## 开发指南

### 后端开发

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 需要 PostgreSQL 和 Redis 运行中
# 可以用 docker compose up postgres redis -d 启动

# 运行数据库迁移
alembic upgrade head

# 启动开发服务器
uvicorn app.main:app --reload --port 8000
```

### 前端开发

```bash
cd frontend
npm install
npm run dev
# 访问 http://localhost:5173
```

### 代码规范

- 后端全部使用异步（`async def` / `await`），SQLAlchemy 2.0 风格 + async session
- 前端使用函数式组件 + Hooks，Zustand 管理全局状态，TanStack Query 管理服务端状态
- 数据库查询注意使用 `joinedload` / `selectinload` 避免 N+1 问题
- Pydantic Schema 使用 `default_factory` 处理可变默认值（如 `list`、`dict`）

## 版本说明

- **公开版本**: `VERSION` 文件 (semver 格式，当前 v0.8.0)
- **内部版本**: `BUILD_VERSION` 文件 (格式 YYYYMMDD.NNNN)
- 页脚显示: `Powered By ADMINCHAT PANEL v{VERSION} ({BUILD_VERSION})`

## 许可证

本项目采用 [GNU General Public License v3.0](LICENSE) 开源。

**版权所有 &copy; 2026 NovaHelix & SAKAKIBARA**

你可以自由使用、修改和分发本软件，但必须：
- 保持开源（不可闭源商用，版权所有者除外）
- 保留原始版权声明
- 使用相同的 GPL-3.0 许可证

---

<p align="center">
  <small>&reg; 2026 NovaHelix & SAKAKIBARA</small>
</p>
