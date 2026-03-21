# ADMINCHAT Panel - Development Guide

## Project Overview
Telegram bidirectional message forwarding bot with web-based customer service management panel.

## Tech Stack
- **Backend**: Python 3.12 + FastAPI + aiogram 3 + SQLAlchemy 2.0 (async) + Alembic
- **Frontend**: React 18 + TypeScript + Vite + shadcn/ui + Tailwind CSS + Zustand + TanStack Query
- **Database**: PostgreSQL 16 + Redis 7
- **Deployment**: Docker Compose + GHCR

## Project Structure
```
/backend        - Python FastAPI backend + Telegram bot
/frontend       - React SPA frontend
/docs           - Design documents & requirements
/docker         - Docker configuration files
```

## Design System (from Pencil designs)
- **Background**: #0C0C0C (page), #080808 (sidebar), #0A0A0A (cards), #141414 (elevated)
- **Primary accent**: #00D9FF (cyan)
- **Status colors**: #059669 (green/success), #FF8800 (orange/warning), #FF4444 (red/error), #8B5CF6 (purple/role)
- **Text**: #FFFFFF (primary), #8a8a8a (secondary), #6a6a6a (muted), #4a4a4a (placeholder)
- **Borders**: #2f2f2f (default), #1A1A1A (subtle)
- **Fonts**: Space Grotesk (headings), Inter (body), JetBrains Mono (data/code)
- **Corner radius**: 6-10px for cards/buttons, 4px for tags/badges

## Backend Conventions
- Use async everywhere (async def, await)
- SQLAlchemy 2.0 style with async session
- Pydantic v2 for schemas
- JWT auth with role-based access control
- API prefix: /api/v1
- Environment variables via pydantic-settings

## Frontend Conventions
- Functional components with hooks
- Zustand for global state
- TanStack Query for server state
- shadcn/ui components (install as needed)
- Tailwind CSS classes matching the design system colors
- WebSocket via custom useWebSocket hook

## Versioning Rules
- **Public version**: `VERSION` file (semver format: MAJOR.MINOR.PATCH, e.g. 0.1.0)
- **Internal version**: `BUILD_VERSION` file (format: YYYYMMDD.NNNN, e.g. 20260321.0001)
- Internal version (`BUILD_VERSION`) updates on EVERY code change commit (increment the 4-digit counter)
- Public version (`VERSION`) follows semver: major changes 0.3.0, small fixes 0.2.1
- **Footer display**: "Powered By ADMINCHAT PANEL v{VERSION} ({BUILD_VERSION})"
- **Copyright**: (R) 2026 NovaHelix & SAKAKIBARA
- When making commits, always update `BUILD_VERSION` with current date and incremented counter
- Update the footer in `frontend/src/components/layout/AppLayout.tsx` and `Sidebar.tsx` to match

## License
- GPL-3.0 with dual copyright: NovaHelix & SAKAKIBARA
- Copyright holders CAN use the code commercially (closed-source)
- Third parties must keep it open source under GPL-3.0

## Key Documents
- `docs/ORIGINAL_REQUIREMENTS.md` - Original requirements (read-only)
- `docs/ARCHITECTURE.md` - System architecture
- `docs/DATABASE_DESIGN.md` - Database schema
- `docs/API_DESIGN.md` - API endpoints
- `docs/BOT_DESIGN.md` - Bot management logic
- `docs/FAQ_ENGINE.md` - FAQ matching engine
- `docs/FRONTEND_PAGES.md` - Page designs
- `docs/DEPLOYMENT.md` - Docker deployment
- `docs/DEVELOPMENT_PROGRESS.md` - Task tracking
