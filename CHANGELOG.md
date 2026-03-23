# Changelog

All notable changes to the ADMINCHAT Panel project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.1] - 2026-03-23

### Added
- AI usage tracking: every AI call now logs `prompt_tokens`, `completion_tokens`, `model`, and `reply_mode` to `ai_usage_logs`
- Model pricing table (`model_pricing.py`) with 25+ models (GPT-4o, Claude, Gemini, DeepSeek, etc.) and fuzzy name matching
- `log_ai_usage()` helper function wired into all 8 AI call sites (private + group handlers)
- Cost estimation calculated automatically from model pricing on each AI request
- Enhanced Usage Statistics tab: 4-card summary with input/output token breakdown, model column in provider table, avg tokens/request card
- Alembic migration `006_extend_ai_usage_logs` adding 4 columns to `ai_usage_logs`

### Fixed
- Chat message stacking on 5-second auto-refresh: store now skips update when data is unchanged
- Auto-scroll jumping to bottom on every poll: now tracks `lastMessageId` instead of `messages.length`

## [0.8.0] - 2026-03-23

### Added
- Missed Keyword Filter system (backend model, API CRUD, frontend UI)
- `catch_all` match mode for FAQ questions (always matches, useful for RAG fallback)
- Global Error Boundary in frontend App
- JWT secret key and OAuth encryption key startup warnings
- `keyword_matches_filter()` utility extracted to shared module
- `updated_at` column on `messages` and `tags` tables

### Fixed
- N+1 queries in conversation list (reduced from 3 queries/row to batch), user list (message count), and FAQ rules (hit stats)
- `tag.color` server_default had extra quotes storing wrong value in DB
- `message.faq_rule_id` missing foreign key constraint
- Missing indexes on `conversations.source_group_id`, `conversations.primary_bot_id`, `messages.sender_admin_id`, `messages.via_bot_id`
- `datetime.utcnow()` deprecated calls replaced with `datetime.now(timezone.utc)`
- Mutable default values in Pydantic schemas (`= {}` replaced with `Field(default_factory=dict)`)
- Frontend: empty catch blocks now log errors
- Frontend: `WSEvent` type missing `new_conversation` event
- Frontend: `api.ts` `_retry` property type safety
- Frontend: hardcoded Chinese strings replaced with English in MessageBubble
- Frontend: `chatStore.updateConversationStatus` error silently swallowed
- `ConversationStatusUpdate.status` now validated with `Literal` type
- `MessageCreate.content_type` and `parse_mode` now validated with `Literal` types

### Changed
- FAQ schema `reply_mode`, `response_mode`, and `match_mode` use `Literal` types instead of regex patterns
- `MatchMode` expanded: exact, prefix, contains, regex, catch_all
- Conversation relationships now use `lazy="selectin"` for async safety
- Migration 005 adds all DB fixes (indexes, FKs, defaults, columns)

## [0.7.1] - 2026-03-23

### Added
- `RagConfig` SQLAlchemy model and Alembic migration (`003_add_rag_configs_table`)
- `RagConfig` Pydantic schemas (Create/Update/Response/List/Test)
- `/api/v1/rag/configs` CRUD and connectivity test API endpoints
- Frontend: `ragConfigApi.ts` RAG configuration API service
- Frontend: RAG configuration types in `types/index.ts`

### Changed
- RAG configuration modularized into independent `rag_configs` table
- RAG Provider factory function adapted to read from new `rag_configs` table
- Removed legacy RAG endpoints from `ai_config.py`
- Frontend: `AISettings.tsx` adapted for new RAG config interface
- Supports multiple RAG configurations (multi-knowledge-base ready)

### Fixed
- Removed unused imports causing TypeScript build failure

## [0.7.0] - 2026-03-23

### Added
- AI Provider OAuth multi-authentication system
- OAuth 2.0 + PKCE support for OpenAI and Gemini/Google providers
- Claude OAuth with code-paste flow and session token support
- Fernet-based encryption for OAuth token storage (`oauth/encryption.py`)
- `OAuthProvider` abstract base class with `OAuthTokens` data model
- OAuth API endpoints: auth-url, callback, exchange, session-token, status
- Automatic token refresh scheduler (every 5 minutes + on startup)
- `AiConfig` model extended with `auth_method` and `oauth_data` columns
- Alembic migration `002_add_oauth_to_ai_configs`
- Frontend: `AuthMethodSelector` component for choosing authentication method
- Frontend: `OAuthFlowModal` for Popup, Code-Paste, and Session Token flows
- Frontend: `aiOAuthApi.ts` OAuth API service layer

### Fixed
- All OAuth providers switched to code-paste flow for broader compatibility
- TypeScript build errors in OAuth components resolved
- XSS protection, race condition fixes, `postMessage` origin validation

## [0.6.0] - 2026-03-23

### Added
- Modular RAG knowledge base retrieval with Dify Knowledge API
- `RAGProvider` abstract base class and `RAGResult` data class
- `DifyRAGProvider` implementation (hybrid search via Dify Knowledge API)
- Async-safe singleton factory function `get_rag_provider()`
- RAG configuration via environment variables (RAG_PROVIDER, DIFY_BASE_URL, DIFY_API_KEY, DIFY_DATASET_ID, RAG_TOP_K)
- `reply_mode=rag` branch in both private and group message handlers
- `rag_handler.py` backward-compatible wrapper
- Graceful RAG provider shutdown in FastAPI lifespan

### Changed
- Removed all debug `print` statements from message handlers (PII exposure risk)
- Added `try/finally` for `AIHandler` resource cleanup on all code paths
- Added input validation (empty query, top_k bounds) in RAG provider
- Added URL scheme validation for `DIFY_BASE_URL`
- Fixed `ai_only` mode not checking for empty AI response in private handler
- Unified fallback model name across all handlers

## [0.5.0] - 2026-03-22

### Added
- Bot Groups system (`BotGroup` + `BotGroupMember` models)
- FAQ Groups and Categories system (`FaqGroup` + `FaqCategory` models)
- `FaqRule.category_id` field linking rules to categories
- Bot Group CRUD API with member management
- FAQ Group and Category CRUD API
- FAQ routing inheritance logic (category -> group -> fallback)
- `get_bot_from_group()` priority-based bot selection
- Private and Group handlers integrated with bot routing
- Frontend: Bot Pool group UI with member management modal
- Frontend: FAQ list tree navigation (left sidebar)
- Frontend: FAQ Editor category selector
- Alembic migration for 4 new tables + 1 new field

### Fixed
- Removed unused `FAQGroup` import causing CI build failure
- Handler modules now reload for each bot to avoid Router reuse conflicts

### Changed
- README updated with design screenshots and v0.5.0 documentation

## [0.4.1] - 2026-03-22

### Fixed
- Badge display switched from sticker images to HTML bold text labels for cleaner Telegram replies
- Badge styling inconsistencies in Telegram message replies

## [0.4.0] - 2026-03-22

### Added
- AI reply modes in bot handlers (ai_only, ai_polish, ai_fallback, ai_intent, ai_template, ai_classify_and_answer)
- AI reply mode support in group handler (matching private handler behavior)
- Colored source badges for FAQ, AI, and Human replies in Telegram
- Emoji source labels on all Telegram replies
- Badge images sent alongside replies in Telegram
- FAQ editor redesigned with separate Match Mode and AI Mode panels
- CRS GPT Responses streaming format support
- API format selector (OpenAI Chat / Anthropic Responses)
- Expandable sidebar with hover animation (64px -> 224px)
- FAQ auto-replies stored in database and displayed in web panel
- FAQ matching integrated into group message handler
- Group photo `@mention` support
- WebSocket connection status indicator (green/red dot)
- APScheduler for missed knowledge analysis (3:00 AM daily)
- Audit logging for critical operations
- Cloudflare Turnstile verification page for private chat users

### Fixed
- CSS reset moved into `@layer base` so Tailwind utility classes work correctly (root cause of all spacing issues)
- Arbitrary hex values replaced with Tailwind theme tokens for v4 compatibility
- Version injection into Docker build via build-args
- All TypeScript build errors resolved for GHCR build
- Unused imports removed preventing build failures
- AI config API response now includes `api_format` field
- Streaming response error handlers no longer call `.read()` on consumed responses
- Duplicate `@` in bot username display removed
- AI reply prefix corrected
- `lazy=selectin` added to all FAQ model relationships for async safety
- FAQ editor labels swapped to correct positions
- Anonymous and channel-mask sender handling in group messages
- UTC+8 timestamps for accurate time display
- Telegram `message.date` used as `created_at` for accurate message timestamps
- WebSocket connection stability improvements
- Telegram webhook routing through APISIX (Origin Verify bypass)
- Docker DNS resolution for external API calls
- bcrypt compatibility (replaced passlib with direct bcrypt)
- Duplicate admin creation on restart

### Changed
- Pixel-perfect UI rewrite matching Pencil design system across all 15+ pages
- Comprehensive spacing overhaul across all pages
- ORIGINAL_REQUIREMENTS.md and designs/ removed from repository
- Removed arm64 build (amd64 only for faster CI)

## [0.3.0] - 2026-03-21

### Added
- Expandable sidebar with toggle animation
- FAQ auto-replies stored in database and shown in web panel
- FAQ matching integrated into group message handler
- Group photo `@mention` support

### Fixed
- WebSocket connection stability improvements
- Anonymous and channel-mask sender handling in group messages
- UTC+8 timestamps for accurate time display
- Telegram `message.date` used as `created_at` for accurate timestamps

### Changed
- Comprehensive spacing overhaul across all pages
- UI polish pass matching Pencil design system specifications

## [0.2.0] - 2026-03-21

### Added
- Bot selector in navigation for choosing reply bot
- UserDetail tags management
- Actual Telegram message sending from web panel
- Smart URL handling for AI API endpoints
- API format selector (OpenAI Chat / Anthropic Responses) for AI configuration
- Webhook update logging for group message troubleshooting

### Fixed
- Image display and loading issues resolved
- Group replies now use `reply_to_message_id` to quote the user's original message
- Group handler accepts `@mentions` with or without extra text
- Naive UTC datetimes to match PostgreSQL TIMESTAMP columns
- Bot registration before `SetWebhook` to handle flood control gracefully
- Footer version reads from VERSION/BUILD_VERSION at build time
- AI API key sent in both `Authorization` and `x-api-key` headers
- aiogram session properly closed with error logging in bot creation
- Left padding added to login brand section
- Duplicate admin creation handled gracefully on restart
- `passlib` replaced with direct `bcrypt` for compatibility
- Auto-create database tables on first startup
- Unused imports removed preventing TypeScript build failure

### Changed
- Completed all TODO placeholders across frontend and backend

## [0.1.0] - 2026-03-21

### Added
- Initial release of ADMINCHAT Panel
- **Backend**: Python 3.12 + FastAPI + aiogram 3 + SQLAlchemy 2.0 (async) + Alembic
- **Frontend**: React 18 + TypeScript + Vite + shadcn/ui + Tailwind CSS + Zustand + TanStack Query
- **Database**: PostgreSQL 16 + Redis 7
- **Deployment**: Docker Compose + GitHub Actions CI/CD with GHCR
- JWT authentication with role-based access control (Super Admin / Admin / Agent)
- Initial admin auto-creation on first startup
- Multi-bot pool management with rate limiting and failover
- Bidirectional message forwarding (private chat + group @mentions)
- Webhook and polling dual mode support
- Real-time web chat via WebSocket with Redis pub/sub
- FAQ auto-reply engine with 4 match modes (exact, prefix, contains, regex)
- FAQ hit statistics and ranking
- Missed knowledge recording with keyword extraction scheduler
- User management (CRUD, tags, groups, blacklist, avatar fetching)
- AI integration with OpenAI-compatible API (6 reply modes)
- Dashboard with real-time statistics, charts, and auto-refresh
- Admin management with permission system
- System settings API
- Cloudflare Turnstile verification middleware
- Media download, caching, expiry cleanup, and re-fetch
- Operation audit log service
- 23-table PostgreSQL schema
- 50+ REST API endpoints
- 15+ frontend pages
- Caddy/Nginx reverse proxy configuration
- Comprehensive deployment documentation and `.env.example`

[0.8.1]: https://github.com/fxxkrlab/ADMINCHAT_PANEL/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/fxxkrlab/ADMINCHAT_PANEL/compare/v0.7.1...v0.8.0
[0.7.1]: https://github.com/user/adminchat-panel/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/user/adminchat-panel/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/user/adminchat-panel/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/user/adminchat-panel/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/user/adminchat-panel/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/user/adminchat-panel/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/user/adminchat-panel/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/user/adminchat-panel/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/user/adminchat-panel/releases/tag/v0.1.0
