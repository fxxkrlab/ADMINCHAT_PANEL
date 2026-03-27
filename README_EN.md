English | [中文](./README.md)

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

**Telegram Bidirectional Message Forwarding Bot + Web Customer Service Panel** &mdash; A complete Telegram customer service solution featuring multi-bot pool management, FAQ auto-reply with 5 match modes and 8 reply modes, RAG knowledge base retrieval, AI provider OAuth multi-auth, and a real-time WebSocket chat interface.

---

## Overview

ADMINCHAT Panel is a production-ready Telegram customer service management system. It collects private messages and group @mentions received by your Telegram bots and forwards them into a unified web panel where admins and agents can view and respond in real time. Beyond live chat, the platform provides a sophisticated FAQ engine with regex matching, AI-powered responses, RAG knowledge base retrieval, missed keyword analysis, configurable keyword filters, and full user lifecycle management.

## Key Features

- **Multi-Bot Pool** &mdash; Add unlimited bots with automatic rate-limit detection and failover between pool members
- **Bidirectional Message Forwarding** &mdash; Private chat and group @mentions, preserving text, images, videos, files, and Markdown formatting
- **Real-time Web Chat** &mdash; WebSocket-powered live messaging with a customer-service-style interface
- **FAQ Auto-Reply Engine** &mdash; 5 match modes (exact, prefix, contains, regex, catch_all) combined with 8 reply modes for flexible response handling
- **RAG Knowledge Base** &mdash; Modular RAG architecture with Dify Knowledge API integration (GTE-multilingual + pgvector), extensible to other providers
- **AI Provider OAuth Multi-Auth** &mdash; 5 authentication methods: API Key / OpenAI OAuth / Claude OAuth / Claude Session Token / Gemini OAuth, with automatic token refresh
- **Missed Keyword Filters** &mdash; Configurable filter rules with 4 match modes (exact, prefix, contains, regex) to auto-bypass irrelevant keywords such as bot commands (`/start`, `/about`)

<details>
<summary><strong>FAQ Matching & Reply Modes Explained (click to expand)</strong></summary>

#### Overall Matching Flow

```mermaid
flowchart TD
    A["User sends message"] --> B["Load all active FAQ rules\nsorted by priority DESC"]
    B --> C{"Iterate each rule's questions\nmatch by match_mode"}
    C -->|"Hit"| D{"Check reply_mode"}
    C -->|"No match"| E["Record to unmatched_messages"]
    E --> F["Push to Web Panel\nfor manual reply"]
    D --> M1["direct"]
    D --> M2["ai_only"]
    D --> M3["ai_polish"]
    D --> M4["ai_fallback"]
    D --> M5["ai_classify_and_answer"]
    D --> M6["rag"]
    D --> M7["ai_intent"]
    D --> M8["ai_template"]
```

#### 5 Match Modes

| Mode | Keyword Example | Input: "Hello, how much does it cost?" | Use Case |
|------|----------------|---------------------------------------|----------|
| `exact` | `how much does it cost` | No match (must be identical) | Precise commands |
| `prefix` | `Hello` | Match (starts with) | Greetings, fixed prefixes |
| `contains` | `cost` | Match (contains substring) | Most common, keyword trigger |
| `regex` | `cost\|price\|fee` | Match (regex pattern) | Multi-keyword / complex patterns |
| `catch_all` | `*` (auto-filled) | Match (matches everything) | Fallback rules with RAG/AI |

> **Priority**: Higher `priority` value matches first. Set `catch_all` to lowest priority (e.g. 1).

#### 8 Reply Modes

**1. `direct` — Direct Reply**
```
User message → FAQ match → Return preset answer (no AI call)
```
Simplest mode. For fixed answers (business hours, contact info).

**2. `ai_only` — Pure AI Reply**
```
User message → FAQ match → Send question to AI → AI generates answer → Reply
```
FAQ rule is just a trigger; answer is fully AI-generated.

**3. `ai_polish` — AI Polish**
```
User message → FAQ match → Get preset answer → AI rewrites naturally → Reply
```
Preset answer + AI rewrite for more natural language. Preserves core info.

**4. `ai_fallback` — AI Fallback**
```
User message → FAQ match → Has preset answer?
                            ├── Yes → Return preset answer
                            └── No → AI generates answer
```
Prefers FAQ answer; only calls AI when none exists. Saves AI costs.

**5. `ai_classify_and_answer` — AI Comprehensive Answer**
```
User message → FAQ match → Preset answers as knowledge context → AI generates comprehensive answer → Reply
```
AI references FAQ content and generates a more complete answer.

**6. `rag` — RAG Knowledge Base Retrieval**
```
User message → FAQ match → Dify Knowledge API vector search
             → Returns relevant document chunks → AI generates answer from context → Reply
```
Most powerful mode. Retrieves from external knowledge base for AI to answer.

**7. `ai_intent` — AI Intent Classification**
```
User message → FAQ match → AI classifies intent → Returns JSON {"category": "xxx", "confidence": 0.95}
```

**8. `ai_template` — Template Filling**
```
User message → FAQ match → Get template with {variable} placeholders → AI fills variables → Reply
```

#### Recommended Configurations

| Scenario | Match Mode | Reply Mode | Notes |
|----------|-----------|------------|-------|
| Fixed FAQ | `contains` / `regex` | `direct` | Business hours, contact info |
| Product inquiries | `regex` | `ai_polish` | AI polishes preset answers |
| Knowledge base Q&A | `catch_all` (low priority) | `rag` | Fallback to knowledge base |
| General support | `catch_all` (lowest priority) | `ai_only` | All unmatched → AI |
| Hybrid | High priority `contains` + low `catch_all` | `direct` + `rag` | Exact match first, then RAG |

</details>

### Plugin System
- **ACP Plugin Architecture** &mdash; Sandboxed plugin runtime with 5 capability declarations: database, bot handler, API routes, frontend pages, settings tab
- **ACP Market Integration** &mdash; Browse, install and manage third-party plugins via [ACP Market](https://acpmarket.novahelix.org) with instant success/error toast notifications
- **Market JWT Authentication** &mdash; Connect to Market via email/password login or API key paste; Bearer token management with account status display in Settings
- **Ed25519 Bundle Signature Verification** &mdash; Auto-fetches Market's public key; verifies Ed25519 signatures on plugin downloads to prevent bundle tampering
- **Uninstall Confirmation & Data Cleanup** &mdash; Confirmation dialog before uninstalling with optional "Delete all plugin data (database tables)" checkbox
- **Plugin Settings Shortcut** &mdash; Installed plugins with settings tabs show a gear icon that navigates directly to the corresponding Settings tab
- **Plugin SDK + CLI** &mdash; [acp-plugin-sdk](https://github.com/fxxkrlab/acp-plugin-sdk) provides type hints + `acp-cli` CLI tool for init / validate / build / publish workflow
- **Official Plugin Repository** &mdash; [ACP_PLUGINS](https://github.com/fxxkrlab/ACP_PLUGINS) open-source example plugins (e.g. TMDB Movie Request System)

- **User Management** &mdash; Tags, groups, blocking, search, and full Telegram user profile display
- **AI Integration** &mdash; OpenAI-compatible API format with multi-provider configuration
- **Cloudflare Turnstile** &mdash; Human verification for private chat users to prevent abuse
- **Bot Groups + FAQ Group Routing** &mdash; Organize bots and FAQ rules into a Group &rarr; Category hierarchy; matched rules automatically route replies through the assigned bot group
- **Role-Based Access Control** &mdash; Super Admin / Admin / Agent with granular permission sets
- **Audit Logging** &mdash; Automatic tracking of all critical operations
- **Missed Knowledge Analysis** &mdash; Detects unmatched questions and builds daily frequency rankings (updated at 3 AM)
- **Global Error Boundary** &mdash; Frontend error isolation preventing full-page crashes
- **Docker One-Click Deployment** &mdash; `docker compose up` to run, with pre-built images published to GHCR

<details>
<summary><strong>RAG Knowledge Base Setup Guide (click to expand)</strong></summary>

#### Complete RAG Customer Service Flow

```
User sends message on Telegram
  → ADMINCHAT Bot receives message
  → FAQ Engine matches rule (reply_mode=rag)
  → Calls Dify Knowledge API (sends user question)
  → Dify uses GTE-multilingual-base to vectorize the question
  → pgvector performs vector search, finds most relevant knowledge
  → Returns search results to ADMINCHAT
  → ADMINCHAT calls AI API (search results + user question)
  → AI generates natural language answer based on knowledge base
  → Bot replies to user
```

Component responsibilities:

| Component | Role |
|-----------|------|
| **Dify** | Knowledge base management + vector search (retrieval only) |
| **GTE-multilingual-base** | Embedding model (text → vectors, runs on CPU) |
| **pgvector** (PostgreSQL extension) | Store and retrieve vectors |
| **AI API** (external, e.g. GPT/Claude) | Generate final answer (based on retrieved context) |
| **ADMINCHAT Panel** | Orchestrates all components + Telegram Bot management |

#### Step 1: Deploy Dify

We recommend Dify's official Docker Compose deployment.

```bash
# Clone Dify
git clone https://github.com/langgenius/dify.git
cd dify/docker

# Copy environment variables
cp .env.example .env

# Start (includes PostgreSQL + pgvector + Redis + Dify API + Web)
docker compose up -d
```

After startup, visit `http://your-server-ip` to complete Dify initialization.

> **Advanced**: If you already have PostgreSQL (with pgvector extension) and Redis, you can disable Dify's built-in database components via `docker-compose.override.yaml` and point Dify to your existing services. Refer to Dify's official docs for external database configuration.

#### Step 2: Deploy Text Embedding Inference (TEI)

GTE-multilingual-base is the recommended multilingual embedding model (~1.1GB, runs on CPU). Deploy it via the Hugging Face TEI container.

**Option A: Auto-download model (simple, but slower first start)**

```bash
docker run -d \
  --name gte-embedding \
  --restart unless-stopped \
  -p 8090:80 \
  -v tei-data:/data \
  ghcr.io/huggingface/text-embeddings-inference:cpu-1.6 \
  --model-id Alibaba-NLP/gte-multilingual-base \
  --port 80
```

> First startup automatically downloads the model from Hugging Face. This may take a few minutes.

**Option B: Pre-download model locally (recommended, faster startup)**

```bash
# Download model to a local directory
mkdir -p /opt/models
pip install huggingface_hub
huggingface-cli download Alibaba-NLP/gte-multilingual-base \
  --local-dir /opt/models/gte-multilingual-base

# Start TEI container with local model mount
docker run -d \
  --name gte-embedding \
  --restart unless-stopped \
  -p 8090:80 \
  -v /opt/models/gte-multilingual-base:/model \
  ghcr.io/huggingface/text-embeddings-inference:cpu-1.6 \
  --model-id /model \
  --port 80
```

**Verify TEI is running:**

```bash
curl http://localhost:8090/embed \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{"inputs": "test text"}'
```

**Connect TEI to the Docker network (so Dify can reach it):**

```bash
# If Dify uses the default network docker_default
docker network connect docker_default gte-embedding

# Or if you use a custom shared network
docker network connect your-shared-network gte-embedding
```

#### Step 3: Install TEI Plugin in Dify and Configure

1. Log in to Dify → **Plugins**
2. Search for `Text Embedding Inference` → Install
3. Go to **Settings** → **Model Providers** → find **Text Embedding Inference**
4. Configure:
   - **Model Name**: `gte-multilingual-base` (display label, customizable)
   - **Server URL**: `http://gte-embedding:80` (Docker internal container name)
5. Save and test the connection

> **Note**: The TEI container name IS the Docker internal DNS name. As long as both containers are on the same Docker network, you can address it by container name.

#### Step 4: Create Knowledge Base and Import Documents

1. Go to Dify → **Knowledge** → **Create Knowledge Base**
2. Select `gte-multilingual-base` as the embedding model
3. Upload documents (TXT, PDF, Markdown, CSV, etc.)
4. Dify will automatically segment, vectorize, and store in pgvector
5. After creation, note down:
   - **Dataset ID**: The UUID in the knowledge base URL (e.g. `abc123-def456` from `datasets/abc123-def456/...`)

#### Step 5: Get Dify API Credentials

1. Go to Dify → **Knowledge** → select your knowledge base
2. Go to **API Access** or **Settings**
3. Get the **Dataset API Key** (format: `dataset-xxxxxxxx`)
4. Note the Dify API internal address: `http://<dify-api-container-name>:5001/v1` (Docker internal)

> The Dify API container listens on port 5001 by default. Find the container name with `docker ps | grep dify-api` (typically `docker-api-1`).

#### Step 6: Configure RAG in ADMINCHAT Panel

1. Log in to the ADMINCHAT admin panel
2. Go to **AI Settings** → **RAG Knowledge Base** tab
3. Click **Add RAG Config** and fill in:
   - **Name**: Custom name (e.g. "Product Knowledge Base")
   - **Provider**: `dify`
   - **Base URL**: Dify API internal address (e.g. `http://docker-api-1:5001/v1`)
   - **API Key**: Dataset API Key (`dataset-xxxxxxxx`)
   - **Dataset ID**: Knowledge base UUID
   - **Top K**: `3` (return top 3 most relevant results)
4. Click **Test** to verify the connection
5. Save

> **Important**: The ADMINCHAT backend container must be on the same Docker network as the Dify API container, otherwise it can't resolve the container name.

#### Step 7: Configure FAQ Rules to Use RAG

1. Go to **FAQ Rules** → create or edit a rule
2. Set **Reply Mode** to `rag`
3. Select the RAG Config you just created
4. Recommended: pair with `catch_all` match mode as a low-priority fallback rule, so all unmatched messages go through RAG

#### Recommended Deployment Architecture

```
┌───────────────────────────────────────────────────────┐
│  Docker Host                                           │
│                                                         │
│  ┌── Shared Docker Network ────────────────────────┐   │
│  │                                                   │   │
│  │  ┌──────────────┐   ┌────────────────────────┐   │   │
│  │  │ ADMINCHAT    │   │ Dify                    │   │   │
│  │  │  backend     │──→│  api (:5001)            │   │   │
│  │  │  frontend    │   │  web                    │   │   │
│  │  └──────────────┘   │  worker                 │   │   │
│  │                      │  plugin_daemon          │   │   │
│  │  ┌──────────────┐   └────────────────────────┘   │   │
│  │  │ TEI Server   │                                 │   │
│  │  │ gte-multi    │   ┌────────────────────────┐   │   │
│  │  │ (:80/8090)   │   │ PostgreSQL + pgvector   │   │   │
│  │  └──────────────┘   │ Redis                   │   │   │
│  │                      └────────────────────────┘   │   │
│  └───────────────────────────────────────────────────┘   │
│                                                           │
│                ┌─────────────────────┐                    │
│                │ AI API (external)   │                    │
│                │ GPT / Claude / etc. │                    │
│                └─────────────────────┘                    │
└───────────────────────────────────────────────────────┘
```

> **Tip**: All components (ADMINCHAT, Dify, TEI, PostgreSQL, Redis) communicate via a shared Docker bridge network using container names as DNS addresses. No extra ports need to be exposed — faster and more secure.

</details>

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

<details>
<summary><strong>Architecture & Flow Diagrams (click to expand)</strong></summary>

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
        APScheduler["APScheduler (scheduled tasks)"]
        OAuthModule["OAuth 2.0 + PKCE"]
    end

    subgraph Storage
        PostgreSQL[("PostgreSQL 16")]
        Redis[("Redis 7")]
    end

    subgraph External Services
        TelegramAPI["Telegram Bot API"]
        CloudflareAPI["Cloudflare Turnstile"]
        AIAPI["AI API (OpenAI compatible)"]
        DifyAPI["Dify Knowledge API"]
        OAuthProviders["OAuth Providers\n(OpenAI / Claude / Gemini)"]
    end

    React -->|"REST API + WebSocket"| FastAPI
    FastAPI --> aiogram
    FastAPI --> SQLAlchemy
    FastAPI --> OAuthModule
    SQLAlchemy --> PostgreSQL
    FastAPI --> Redis
    aiogram -->|"Bot API"| TelegramAPI
    FastAPI -->|"Verification"| CloudflareAPI
    FastAPI -->|"AI Replies"| AIAPI
    FastAPI -->|"RAG Retrieval"| DifyAPI
    OAuthModule -->|"OAuth 2.0 + PKCE"| OAuthProviders
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

## AI Provider OAuth Flow

```mermaid
flowchart TB
    U["Admin"] -->|"Select Auth Method"| S{"Auth Method"}
    S -->|"API Key"| K["Enter Key Manually"]
    S -->|"OpenAI / Gemini OAuth"| P["Popup Login + Auto Callback"]
    S -->|"Claude OAuth"| C["Open Link + Paste Code"]
    S -->|"Claude Session Token"| T["Paste Cookie"]
    K & P & C & T -->|"access_token stored in api_key"| DB["AiConfig Record"]
    DB -->|"Check expiry every 5 min"| R["Auto Refresh Token"]
    R -->|"Update api_key"| DB
```

</details>

<details>
<summary><strong>Database Schema & Feature Reference (click to expand)</strong></summary>

### Database Schema

| Table | Description | Key Fields |
|-------|-------------|------------|
| `admins` | Panel admins and agents | username, role, permissions (JSONB) |
| `tg_users` | Telegram users | tg_uid, is_blocked, turnstile_verified_at |
| `bots` | Bot pool | token, priority, is_rate_limited |
| `conversations` | Chat sessions | status, source_type, assigned_to |
| `messages` | Message records | direction, content_type, faq_matched |
| `tg_groups` | Telegram groups | tg_chat_id, title |
| `group_bots` | Group-bot associations | tg_group_id, bot_id |
| `tags` / `user_tags` | User tags | name, color (many-to-many) |
| `user_groups` / `user_group_members` | User groups | name, description (many-to-many) |
| `faq_rules` | FAQ rules | response_mode, reply_mode, category_id |
| `faq_questions` / `faq_answers` | FAQ Q&A pairs | keyword, match_mode / content, content_type |
| `faq_rule_questions` / `faq_rule_answers` | FAQ rule M2M links | faq_rule_id, question_id / answer_id |
| `faq_groups` | FAQ groups (level 1) | name, bot_group_id |
| `faq_categories` | FAQ categories (level 2) | name, faq_group_id, bot_group_id |
| `faq_hit_stats` | FAQ hit statistics | hit_count, date |
| `missed_keywords` | Unmatched keyword rankings | keyword, occurrence_count |
| `missed_keyword_filters` | Keyword filter rules | pattern, match_mode (exact/prefix/contains/regex) |
| `unmatched_messages` | Raw unmatched messages | text_content, tg_user_id |
| `bot_groups` / `bot_group_members` | Bot groups | name / bot_group_id, bot_id |
| `ai_configs` | AI provider configurations | base_url, api_key, model, auth_method, oauth_data |
| `ai_usage_logs` | AI usage tracking | tokens_used, cost_estimate |
| `rag_configs` | RAG knowledge base configs | provider, base_url, api_key, dataset_id, top_k, is_active |
| `system_settings` | System settings | key-value (JSONB) |
| `audit_logs` | Audit trail | action, target_type, details |
| `tmdb_api_keys` | TMDB API keys for rotation | api_key, is_rate_limited, request_count |
| `movie_requests` | Movie/TV requests from users | tmdb_id, media_type, status, request_count, in_library |
| `movie_request_users` | Request-user junction | movie_request_id, tg_user_id (unique pair) |
| `media_library_configs` | External media DB config | db_type, host, table_name, tmdb_id_column |
| `installed_plugins` | Installed plugin registry | slug, version, status, capabilities (JSONB) |
| `plugin_secrets` | Plugin encrypted secrets | plugin_slug, key, encrypted_value |

> 36 tables total. See [docs/DATABASE_DESIGN.md](docs/DATABASE_DESIGN.md) for the full schema.

## FAQ Match Modes

| Mode | Code | Description |
|------|------|-------------|
| Exact | `exact` | Full text must equal the keyword (case-insensitive) |
| Prefix | `prefix` | Text must start with the keyword |
| Contains | `contains` | Keyword appears anywhere in the text |
| Regex | `regex` | Text matches a regular expression pattern |
| Catch All | `catch_all` | Matches any incoming message; designed as a low-priority fallback for RAG rules |

## FAQ Reply Modes

| Mode | Code | Description |
|------|------|-------------|
| Direct Match | `direct` | Return the preset answer on keyword match |
| AI Only | `ai_only` | Forward the question directly to AI (rate limited) |
| AI Polish | `ai_polish` | Match a preset answer, then let AI rewrite it for a natural tone |
| AI Fallback | `ai_fallback` | Try FAQ first; hand off to AI only when no rule matches |
| AI Intent | `ai_intent` | AI classifies the user's intent, then routes to the matching FAQ category |
| Template Fill | `ai_template` | Preset template with AI-filled dynamic variables |
| RAG | `rag` | Vector retrieval (Dify / pgvector) combined with an AI-synthesized answer |
| AI Comprehensive | `ai_classify_and_answer` | AI generates an answer referencing the full FAQ knowledge base |

## Missed Keyword Filters

The missed knowledge analysis system automatically collects unmatched user messages and ranks them by frequency. To keep the rankings useful, you can configure **keyword filters** that automatically bypass irrelevant messages such as bot commands (`/start`, `/help`, `/about`) or common greetings.

Each filter supports 4 match modes:

| Mode | Behavior |
|------|----------|
| `exact` | Message must exactly equal the pattern |
| `prefix` | Message must start with the pattern |
| `contains` | Pattern appears anywhere in the message |
| `regex` | Message matches the regular expression |

## AI Provider Auth Methods

| Method | Flow | Description |
|--------|------|-------------|
| API Key | Manual input | Traditional method: enter Base URL + API Key directly |
| OpenAI OAuth | Popup login | OAuth 2.0 + PKCE, browser popup with auto-callback |
| Claude OAuth | Code paste | OAuth 2.0 + PKCE, Claude displays a code on its fixed callback page; the user copies and pastes it |
| Claude Session Token | Cookie paste | Copy the `sessionKey` cookie from claude.ai; the backend exchanges it for access tokens |
| Gemini OAuth | Popup login | Google OAuth 2.0 + PKCE, browser popup with auto-callback |

> **Automatic token refresh:** A background job checks every 5 minutes for tokens approaching expiry and renews them automatically. The refresh also runs at server startup to compensate for any downtime.

</details>

## Quick Start

```bash
# Clone the repository
git clone https://github.com/fxxkrlab/ADMINCHAT_PANEL.git
cd ADMINCHAT_PANEL/deploy

# Configure environment variables
cp .env.example .env
nano .env  # Set passwords, bot tokens, domain, etc.

# One-click start (includes PostgreSQL + Redis + Nginx)
docker compose -f docker-compose.full.yml up -d

# Visit http://your-server-ip
# Default login: admin / (see INIT_ADMIN_PASSWORD in .env)
```

## Installation Methods

For detailed deployment instructions, see [`deploy/README.md`](deploy/README.md).

| Method | File | Use Case |
|--------|------|----------|
| Docker Run | [`deploy/docker-run.sh`](deploy/docker-run.sh) | Existing PG + Redis, deploy the app only |
| Compose Standalone | [`deploy/docker-compose.standalone.yml`](deploy/docker-compose.standalone.yml) | Existing PG + Redis, Compose-managed |
| Compose Full Stack | [`deploy/docker-compose.full.yml`](deploy/docker-compose.full.yml) | Fresh server, deploy everything at once |

Each method supports both **Named Volumes** (Docker-managed) and **Bind Mounts** (host directory mapping). Switch between them by toggling the comments in the respective yml file.

<details>
<summary><strong>Project Structure (click to expand)</strong></summary>

```
ADMINCHAT_PANEL/
├── backend/                    # Python backend
│   ├── app/
│   │   ├── api/v1/            # REST API routes (17 modules)
│   │   ├── bot/               # Telegram Bot core
│   │   │   ├── manager.py     # Multi-bot lifecycle management
│   │   │   ├── handlers/      # Message handlers (private/group/commands/movie_request)
│   │   │   ├── dispatcher.py  # Message dispatch + failover
│   │   │   └── rate_limiter.py# Rate-limit detection (Redis token bucket)
│   │   ├── faq/               # FAQ engine
│   │   │   ├── engine.py      # Match engine
│   │   │   ├── matcher.py     # 5 match mode functions
│   │   │   ├── ai_handler.py  # AI reply handler (8 modes)
│   │   │   ├── rag_handler.py # RAG compatibility wrapper
│   │   │   └── rag/           # Modular RAG system
│   │   │       ├── base.py    # RAGProvider abstract base class
│   │   │       └── dify_provider.py  # Dify Knowledge API provider
│   │   ├── oauth/             # OAuth 2.0 multi-auth
│   │   │   ├── base.py        # OAuthProvider abstract base class
│   │   │   ├── encryption.py  # Fernet token encryption
│   │   │   ├── openai.py      # OpenAI OAuth + PKCE
│   │   │   ├── claude.py      # Claude OAuth + Session Token
│   │   │   ├── gemini.py      # Gemini/Google OAuth + PKCE
│   │   │   └── token_refresh.py # Automatic token refresh task
│   │   ├── models/            # SQLAlchemy ORM (36 tables)
│   │   ├── schemas/           # Pydantic request/response models
│   │   ├── services/          # Business services (Redis/audit/media/Turnstile)
│   │   ├── ws/                # WebSocket real-time communication
│   │   └── tasks/             # Scheduled tasks (APScheduler)
│   ├── alembic/               # Database migrations
│   └── Dockerfile
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── pages/             # 14+ pages
│   │   ├── components/        # Reusable components (chat/layout/ui/ai)
│   │   │   └── ai/           # OAuth authentication components
│   │   │       ├── AuthMethodSelector.tsx  # Auth method selector
│   │   │       └── OAuthFlowModal.tsx      # OAuth flow modal
│   │   ├── stores/            # Zustand state management
│   │   ├── services/          # API service layer (11 modules)
│   │   ├── hooks/             # Custom hooks (WebSocket, debounce)
│   │   └── types/             # TypeScript type definitions
│   └── Dockerfile
├── deploy/                     # Deployment configurations
├── docs/                       # Design documents
├── docker-compose.yml          # Local dev (PG + Redis only)
├── .env.example
└── LICENSE                     # GPL-3.0
```

</details>

<details>
<summary><strong>Development Guide (click to expand)</strong></summary>

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Start PostgreSQL and Redis (if not already running)
docker compose up postgres redis -d

# Run database migrations
alembic upgrade head

# Start the development server
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Visit http://localhost:5173
```

</details>

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).

**Copyright &copy; 2026 NovaHelix & SAKAKIBARA**

You are free to use, modify, and distribute this software, provided that you:
- Keep derivative works open source (closed-source commercial use is permitted only by the copyright holders)
- Retain the original copyright notice
- License derivative works under the same GPL-3.0 terms

---

<p align="center">
  <small>&reg; 2026 NovaHelix & SAKAKIBARA</small>
</p>
