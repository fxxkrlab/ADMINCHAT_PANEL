English | [中文](./README.md)

---

![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?logo=tailwindcss&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![Telegram](https://img.shields.io/badge/Telegram-Bot_API-26A5E4?logo=telegram&logoColor=white)
![aiogram](https://img.shields.io/badge/aiogram-3.x-2CA5E0?logo=telegram&logoColor=white)
![License](https://img.shields.io/badge/License-GPL_3.0-blue)

# ADMINCHAT Panel

> &reg; 2026 NovaHelix & SAKAKIBARA. All rights reserved.

**Telegram Bidirectional Message Forwarding Bot + Web Customer Service Management Panel** &mdash; An all-in-one Telegram customer service solution with multi-bot pool management, FAQ auto-reply, AI integration, and real-time web chat.

---

## Overview

ADMINCHAT Panel is a full-featured Telegram customer service management system. It forwards private messages and group @mentions from Telegram bots to a web management panel, enabling admins and agents to view and reply to user messages in real-time through the browser. It also supports FAQ auto-reply, AI-powered responses, user management, and more.

## Key Features

- **Multi-Bot Pool** &mdash; Unlimited bot instances with automatic rate-limit detection and failover
- **Bidirectional Forwarding** &mdash; Private chat + Group @Bot, preserving text/images/videos/files/Markdown
- **Real-time Web Chat** &mdash; WebSocket-based live messaging, customer service style interface
- **FAQ Auto-Reply Engine** &mdash; 8 reply modes (regex match / AI direct / AI polish / AI fallback / intent recognition / template fill / RAG ready / comprehensive AI)
- **User Management** &mdash; Tags, groups, blocking, search, full Telegram user info display
- **AI Integration** &mdash; OpenAI-compatible API format, multi-provider support
- **Cloudflare Turnstile** &mdash; Human verification for private chat users
- **Role-Based Access** &mdash; Super Admin / Admin / Agent with granular permissions
- **Audit Logging** &mdash; Automatic tracking of critical operations
- **Knowledge Gap Analysis** &mdash; Auto-detect unmatched questions, daily ranking updates at 3 AM
- **Bot Groups + FAQ Group Routing** &mdash; Organize bots into groups, FAQ rules into Group→Category hierarchy, auto-route replies through the assigned bot group
- **Docker Deployment** &mdash; Single `docker compose up` to run, GHCR image publishing

## Screenshots

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

## Architecture

```mermaid
graph TB
    subgraph Frontend
        React["React 18 + TypeScript"]
        Tailwind["Tailwind CSS + shadcn/ui"]
        Vite["Vite Build"]
    end

    subgraph Backend
        FastAPI["FastAPI (async)"]
        aiogram["aiogram 3 (multi-bot)"]
        SQLAlchemy["SQLAlchemy 2.0"]
        APScheduler["APScheduler"]
    end

    subgraph Storage
        PostgreSQL[("PostgreSQL 16")]
        Redis[("Redis 7")]
    end

    subgraph External
        TelegramAPI["Telegram Bot API"]
        CloudflareAPI["Cloudflare Turnstile"]
        AIAPI["AI API (OpenAI compatible)"]
    end

    React -->|"REST API + WebSocket"| FastAPI
    FastAPI --> aiogram
    FastAPI --> SQLAlchemy
    SQLAlchemy --> PostgreSQL
    FastAPI --> Redis
    aiogram -->|"Bot API"| TelegramAPI
    FastAPI -->|"Verification"| CloudflareAPI
    FastAPI -->|"AI Reply"| AIAPI
```

## Message Routing Flow

```mermaid
flowchart LR
    A["TG User"] -->|"Private / Group @Bot"| B["Bot Pool"]
    B -->|"Store + Redis Publish"| C["PostgreSQL + Redis"]
    C -->|"WebSocket Push"| D["Web Panel"]
    D -->|"Admin Reply"| E{"Bot Dispatcher"}
    E -->|"Primary Bot First"| F["Bot1"]
    E -->|"Failover on Rate Limit"| G["Bot2 / Bot3"]
    F & G -->|"Reply to User"| A
```

## Database Schema

| Table | Description | Key Fields |
|-------|-------------|------------|
| `admins` | Panel admins/agents | username, role, permissions (JSONB) |
| `tg_users` | Telegram users | tg_uid, is_blocked, turnstile_verified_at |
| `bots` | Bot pool | token, priority, is_rate_limited |
| `conversations` | Chat sessions | status, source_type, assigned_to |
| `messages` | Message records | direction, content_type, faq_matched |
| `tg_groups` | Telegram groups | tg_chat_id, title |
| `tags` / `user_tags` | User tags | name, color (many-to-many) |
| `faq_rules` | FAQ rules | response_mode, reply_mode, category_id |
| `faq_groups` | FAQ groups (level 1) | name, bot_group_id |
| `faq_categories` | FAQ categories (level 2) | name, faq_group_id, bot_group_id |
| `faq_hit_stats` | FAQ hit stats | hit_count, date |
| `missed_keywords` | Knowledge gaps | keyword, occurrence_count |
| `bot_groups` | Bot groups | name, description |
| `bot_group_members` | Bot group members | bot_group_id, bot_id (unique) |
| `ai_configs` | AI provider configs | base_url, api_key, model |
| `audit_logs` | Audit trail | action, target_type, details |

> 27 tables total. See [docs/DATABASE_DESIGN.md](docs/DATABASE_DESIGN.md) for full schema.

## FAQ Reply Modes

| Mode | Code | Description |
|------|------|-------------|
| Direct Match | `direct` | Return preset answer on keyword match |
| AI Only | `ai_only` | Send question directly to AI (rate limited) |
| AI Polish | `ai_polish` | Match answer + AI rewrite for natural tone |
| AI Fallback | `ai_fallback` | Try FAQ first, AI if no match |
| AI Intent | `ai_intent` | AI classifies intent, routes to FAQ category |
| Template Fill | `ai_template` | Preset template + AI fills dynamic variables |
| RAG | `rag` | Reserved for vector retrieval + AI answer |
| AI Comprehensive | `ai_classify_and_answer` | AI generates answer using FAQ knowledge base |

## Quick Start

```bash
# Clone the repository
git clone https://github.com/fxxkrlab/ADMINCHAT_PANEL.git
cd ADMINCHAT_PANEL/deploy

# Configure environment
cp .env.example .env
nano .env  # Set passwords, bot tokens, domain, etc.

# One-click start (includes PostgreSQL + Redis + Nginx)
docker compose -f docker-compose.full.yml up -d

# Visit http://server-ip
# Default login: admin / (see INIT_ADMIN_PASSWORD in .env)
```

## Installation Methods

See full deployment docs at [`deploy/README.md`](deploy/README.md)

| Method | File | Use Case |
|--------|------|----------|
| Docker Run | [`deploy/docker-run.sh`](deploy/docker-run.sh) | Have PG+Redis, deploy app only |
| Compose Standalone | [`deploy/docker-compose.standalone.yml`](deploy/docker-compose.standalone.yml) | Have PG+Redis, Compose managed |
| Compose Full Stack | [`deploy/docker-compose.full.yml`](deploy/docker-compose.full.yml) | Fresh server, deploy everything |

Each method supports both **Named Volumes** (Docker-managed) and **Bind Mounts** (host directory mapping), switchable via comments in yml files.

## Project Structure

```
ADMINCHAT_PANEL/
├── backend/                    # Python backend (71 files)
│   ├── app/
│   │   ├── api/v1/            # REST API routes (15 modules)
│   │   ├── bot/               # Telegram Bot core
│   │   ├── faq/               # FAQ engine + AI handler
│   │   ├── models/            # SQLAlchemy ORM (23 tables)
│   │   ├── schemas/           # Pydantic models
│   │   ├── services/          # Business services
│   │   ├── ws/                # WebSocket real-time
│   │   └── tasks/             # Scheduled tasks
│   └── Dockerfile
├── frontend/                   # React frontend (35 files)
│   ├── src/
│   │   ├── pages/             # 14+ pages
│   │   ├── components/        # Reusable components
│   │   ├── stores/            # Zustand state management
│   │   ├── services/          # API service layer (9 modules)
│   │   └── hooks/             # Custom hooks
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── LICENSE                     # GPL-3.0
```

## Development

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Start PostgreSQL + Redis: docker compose up postgres redis -d
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Visit http://localhost:5173
```

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).

**Copyright &copy; 2026 NovaHelix & SAKAKIBARA**

You are free to use, modify, and distribute this software, provided you:
- Keep it open source (no closed-source commercial use, except by copyright holders)
- Retain the original copyright notice
- Use the same GPL-3.0 license

---

<p align="center">
  <small>&reg; 2026 NovaHelix & SAKAKIBARA</small>
</p>
