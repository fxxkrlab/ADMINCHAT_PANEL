# Changelog

All notable changes to ADMINCHAT Panel will be documented in this file.

## [0.4.0] - 2026-03-22

### New Features
- **Expandable Sidebar** - Hover to expand (64px -> 224px), shows icon + label text with smooth animation
- **Bot Selector for Group Replies** - Click "Replying via BotName" to choose which bot sends group replies
- **FAQ Group Support** - Bot @mentions in groups now trigger FAQ matching and auto-reply
- **Anonymous Sender Support** - Channel masks / anonymous admins in groups can trigger FAQ
- **FAQ Reply in Panel** - Auto-replies stored in DB and shown in chat panel (sender_type=faq)
- **FAQ Reply Prefix** - User-facing FAQ replies prefixed with "基于FAQ自动回复"
- **Image/Media Send & Receive** - Full support for photos, videos, documents between panel and Telegram
- **AI API Format Selector** - Choose between OpenAI Chat Completions and Anthropic Responses (CRS)
- **WebSocket Real-time** - New messages auto-appear with 5s polling fallback
- **Connection Indicator** - Green/red dot shows WebSocket connection status
- **APScheduler** - Missed knowledge analysis runs automatically at 3:00 AM daily
- **Audit Logging** - Critical operations automatically tracked with viewer page
- **Turnstile Verification** - CF Turnstile page for private chat user verification

### UI Improvements
- **Root CSS Fix** - Fixed `* { padding: 0 }` overriding all Tailwind utilities (the root cause of all spacing issues)
- All pages now properly display card backgrounds (#0A0A0A), borders (#2f2f2f), and rounded corners
- Pixel-perfect styling matching Pencil design system across all 15+ pages
- UTC+8 (Asia/Shanghai) timezone for all timestamp displays
- Dynamic version display in footer (injected at build time)

### Bug Fixes
- Fixed Telegram webhook routing through APISIX (Origin Verify bypass)
- Fixed Docker DNS resolution for external API calls
- Fixed bcrypt compatibility (replaced passlib with direct bcrypt)
- Fixed duplicate admin creation on restart
- Fixed group photo + @mention detection (caption support)
- Fixed message timestamps using Telegram's message.date
- Fixed AI handler URL construction for CRS compatibility
- Fixed GHCR build failures (unused imports, multi-platform removed)

### DevOps
- Removed arm64 build (amd64 only, 10x faster CI)
- Version injected into Docker build via build-args
- Explicit version tags in docker-compose (no more :latest confusion)
- APISIX auto-restart after deployment

## [0.3.x] - 2026-03-21

Internal development versions. See git history for details.

## [0.2.0] - 2026-03-21

### Features
- Actual Telegram message sending from web panel
- Group reply with reply_to_message_id
- FAQ group matching
- Anonymous sender support

## [0.1.0] - 2026-03-21

### Initial Release
- Multi-Bot pool management with rate limiting and failover
- Bidirectional message forwarding (private + group @mentions)
- Real-time web chat via WebSocket
- FAQ auto-reply engine with 8 modes
- User management (tags, groups, blocking, search)
- AI integration (OpenAI-compatible API)
- Cloudflare Turnstile verification
- Role-based access control (Super Admin / Admin / Agent)
- Docker deployment with GHCR
- 23-table PostgreSQL schema
- 50+ REST API endpoints
- 15+ frontend pages
