# Changelog

All notable changes to the ADMINCHAT Panel project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.3] - 2026-04-07

### Fixed
- **Plugin reactivation served stale code (CRITICAL)** — `PluginManager.deactivate()` only removed the top-level `plg_{id}` entry from `sys.modules`, leaving submodules like `backend.routes`, `backend.handlers`, and `backend.services.*` cached. On reactivate (after an update or a manual deactivate/activate cycle) `from backend.routes import router` returned the *previous* version's router object even though the file on disk had been replaced. Symptom: a freshly installed plugin update kept exposing old endpoints; movie-request 1.0.6 → 1.0.8 update never took effect until the panel container was restarted. Fixed by snapshotting `sys.modules` around `exec_module`, recording every module the plugin imported on `_LoadedPlugin.imported_modules`, and purging that exact set on deactivate. A path-based fallback (`_pop_modules_under_path`) catches modules that were lazy-imported during runtime — typically inside `teardown()` handlers.
- **Cross-plugin namespace collision** — Two plugins that both ship a top-level `backend` package silently shadowed each other: whichever activated first won, and the second plugin's `from backend.routes import router` resolved to the first plugin's module. Fixed by scanning each plugin directory's top-level packages on activate and proactively evicting any conflicting `sys.modules` entries before `exec_module` runs.
- **`sys.path` leaked on activation failure** — If `exec_module` raised, the plugin directory was left appended to `sys.path` even though the plugin failed to load, polluting later imports. Now removed in the failure path alongside the partial `sys.modules` rollback.
- **Partial activation leaked mounted routes** — If `setup()` raised after `get_router()` had already mounted the API router (and possibly the bot router and static files), those mounts stayed in the routing table because the previous code only logged the exception. Now the mount + setup phase is wrapped in a transactional `try/except` that unmounts API router, bot router, and static files (and unsubscribes events) in the rollback path before re-raising.
- **`_contexts` polluted on `setup()` failure** — `PluginContext` was committed to `self._contexts` *before* `setup()` ran, so a setup exception left a dangling context entry that other code paths could observe. Context is now stored only after `setup()` succeeds.

### Added
- **OpenAPI schema invalidation on plugin mount/unmount** — `DynamicRouterMount.mount/unmount` now clear `app.openapi_schema` so `/docs` and `/openapi.json` reflect plugin route changes without a process restart.
- **Robust plugin route filtering on unmount** — `DynamicRouterMount.unmount` now matches both `route.path` and `route.path_format`, so parametrised routes (e.g. `/{request_id:int}`) are removed reliably regardless of which attribute the underlying Starlette `Route` exposes.
- **Static mount idempotency** — `PluginStaticServer.mount` now tears down a stale mount before adding a fresh one, preventing duplicate `Mount` routes after a crash that bypassed `deactivate`. Unmount filters by both `name` and `path` for symmetry.

### Plugin Authoring Notes
- Plugin authors should now expect that `from backend.routes import router` is always re-evaluated against the current files on disk after a deactivate / activate cycle — no need to restart the panel after publishing a fix.
- Two plugins may now safely share top-level package names (e.g. both have a `backend/` directory) as long as only one is active at a time. Simultaneous activation of name-conflicting plugins will still log a warning and the later one wins; we recommend using a unique top-level name (e.g. `myplugin_backend/`) when shipping a plugin to the Market.

[1.1.3]: https://github.com/fxxkrlab/ADMINCHAT_PANEL/compare/v1.1.2...v1.1.3

## [1.1.2] - 2026-03-28

### Fixed
- **Plugin bot router mount crash on startup** — `RuntimeError: Router is already attached` raised in `HotSwappableRouter._rebuild()` when re-including a router that retained a stale `_parent_router` reference; now resets the reference before re-including. As a side effect, plugin API routes (`/api/v1/p/*`) failed to mount on startup until the next manual activation.

[1.1.2]: https://github.com/fxxkrlab/ADMINCHAT_PANEL/compare/v1.1.1...v1.1.2

## [1.1.1] - 2026-03-28

### Fixed
- **Light-mode sidebar transparency** — Sidebar is now opaque white in light mode instead of see-through glass.
- **Dashboard card glass effect in light mode** — Real frosted-glass `backdrop-blur` instead of plain background.
- **Plugin bot handlers fired after FAQ** — Plugin handlers are now registered *before* FAQ handlers so commands like `/req` reach plugins first.
- **Telegram replies to stale message IDs failed silently** — Now retries the send without `reply_to_message_id` on `TelegramBadRequest` instead of dropping the reply.
- **Chat timestamps showed time only** — Chat list now displays full date + time.

[1.1.1]: https://github.com/fxxkrlab/ADMINCHAT_PANEL/compare/v1.1.0...v1.1.1

## [1.1.0] - 2026-03-28

### Added
- **Theme System** — Dual-theme support with Dark (default) and Light mode; all ~1,600 hardcoded hex color values replaced with CSS variable-based Tailwind theme tokens
- **Theme Toggle** — Sun/Moon toggle button in sidebar with `localStorage` persistence and `prefers-color-scheme` system detection
- **Glass Morphism Effects** — `backdrop-blur` glass effects on sidebar, header, and cards (most visible in light theme)
- **Flowing Gradient Background** — Animated radial gradient light blobs behind the layout (light theme only)
- **Glow Border Utility** — Hover gradient border effect CSS class for cards

### Fixed
- **Login page infinite refresh loop** — `useActivePlugins()` was called at the top-level `AppRoutes` component (covering both public and authenticated routes); on `/login` it fired `GET /plugins` → 401 → token refresh failed → `window.location.href = '/login'` → full page reload → infinite loop; fixed by gating the query with `enabled: isAuthenticated` and adding a `/login` path guard to the 401 redirect
- **Colored button contrast in light theme** — 8 instances of `text-text-primary` on `bg-red`/`bg-green`/`bg-blue` buttons changed to `text-white` for proper contrast in both themes

[1.1.0]: https://github.com/fxxkrlab/ADMINCHAT_PANEL/compare/v1.0.22...v1.1.0

## [1.0.18] - 2026-03-27

### Fixed
- **Plugin "No QueryClient set" crash** — `@tanstack/react-query` was bundled separately in plugin, missing the host's QueryClientProvider; now exposed as `window.TanStackReactQuery` alongside React/ReactDOM

[1.0.18]: https://github.com/fxxkrlab/ADMINCHAT_PANEL/compare/v1.0.17...v1.0.18

## [1.0.17] - 2026-03-27

### Fixed
- **Plugin React dual instance crash** — Plugin IIFE bundles included their own React copy, causing `Cannot read properties of null (reading 'useContext')`; Panel now exposes `window.React` and `window.ReactDOM` so plugins can externalize React and share the host's single instance

[1.0.17]: https://github.com/fxxkrlab/ADMINCHAT_PANEL/compare/v1.0.16...v1.0.17

## [1.0.16] - 2026-03-27

### Fixed
- **Plugin static mount lost on startup** — `ensure_app` only ran in route handlers, so startup activation had corrupted `_app` reference; now fixed at startup before activating any plugins
- **Cloudflare cached 404 responses** — Added Page Rule to bypass cache for `/api/*` path

[1.0.16]: https://github.com/fxxkrlab/ADMINCHAT_PANEL/compare/v1.0.15...v1.0.16

## [1.0.15] - 2026-03-27

### Fixed
- **Plugin remoteEntry.js fails with "Failed to resolve module specifier 'react'"** — PluginLoader loaded scripts as `type="module"`, but plugins built with externals produce bare specifiers that browsers can't resolve; removed `type="module"` to support IIFE-format plugin bundles

[1.0.15]: https://github.com/fxxkrlab/ADMINCHAT_PANEL/compare/v1.0.14...v1.0.15

## [1.0.14] - 2026-03-27

### Fixed
- **Plugin static files not mounted** — `PluginManager._app` was corrupted to a module reference; added `ensure_app(request.app)` in route handlers to fix the reference from the live request before every activate/install call

[1.0.14]: https://github.com/fxxkrlab/ADMINCHAT_PANEL/compare/v1.0.13...v1.0.14

## [1.0.13] - 2026-03-27

### Fixed
- **Plugin static files 404** — Static mount path `/api/v1/plugins/{id}/static/` conflicted with existing `/api/v1/plugins/{plugin_id}` route; moved to `/api/v1/p-static/{id}/` to avoid FastAPI route conflicts

[1.0.13]: https://github.com/fxxkrlab/ADMINCHAT_PANEL/compare/v1.0.12...v1.0.13

## [1.0.12] - 2026-03-27

### Fixed
- **Plugin activation: `_app` is module not FastAPI** — `PluginManager._app` reference became a Python module after plugin import; activate now resolves the real FastAPI instance from `app.main.app` as fallback, fixing API router mount, bot handler mount, and static file serving

[1.0.12]: https://github.com/fxxkrlab/ADMINCHAT_PANEL/compare/v1.0.11...v1.0.12

## [1.0.11] - 2026-03-27

### Fixed
- **"Update to v1.0.0" shown when v1.0.1 installed** — Detail modal fallback picked `versions[0]` (oldest) instead of sorting by `published_at` descending to find the newest; also fixed install handler's version selection

[1.0.11]: https://github.com/fxxkrlab/ADMINCHAT_PANEL/compare/v1.0.10...v1.0.11

## [1.0.10] - 2026-03-27

### Fixed
- **Plugin install returns 500 when activation fails** — Auto-activate after install threw unhandled `AttributeError` (static server mount issue), now caught gracefully; install succeeds with warning message, user can activate manually
- **Static server mount guard** — Added type check to prevent crash when `_app` reference is corrupted; logs error and skips mount instead of crashing

[1.0.10]: https://github.com/fxxkrlab/ADMINCHAT_PANEL/compare/v1.0.9...v1.0.10

## [1.0.9] - 2026-03-27

### Fixed
- **Plugin activation crash: `module 'app' has no attribute 'mount'`** — `sys.path.insert(0, ...)` put plugin directory first in search path, shadowing the host `app` package; changed to `sys.path.append(...)` so host packages keep priority
- **Market JWT expired but status shows "Connected"** — Status endpoint now decodes JWT `exp` claim locally (no external call) and returns `connected: false` with "session expired" message when token is expired

[1.0.9]: https://github.com/fxxkrlab/ADMINCHAT_PANEL/compare/v1.0.8...v1.0.9

## [1.0.8] - 2026-03-27

### Fixed
- **Plugin import crash: `ModuleNotFoundError`** — Plugin loader did not add the plugin root directory to `sys.path` before importing, so intra-plugin imports like `from backend.routes import router` failed; now inserts plugin path into `sys.path` before `exec_module()` and cleans up on deactivate
- **Plugin static files unreachable via reverse proxy** — Plugin frontend assets were mounted at `/plugins/{id}` which APISIX didn't route to backend; moved to `/api/v1/plugins/{id}/static/` which goes through the existing `/api/*` route
- **Market status slow loading (3-10s)** — `GET /plugins/market/status` called Market's `/auth/me` endpoint on every request; now caches account info in `system_settings` during connect, status reads from DB instantly
- **Market not-connected banner** — Browse tab shows orange warning when Market is not connected, with "Go to Settings" button linking directly to Market tab

[1.0.8]: https://github.com/fxxkrlab/ADMINCHAT_PANEL/compare/v1.0.7...v1.0.8

## [1.0.7] - 2026-03-27

### Added
- **Market connection banner** — Browse tab shows orange warning banner when Market is not connected, with "Go to Settings" button that navigates directly to Settings > Market tab

### Fixed
- **Market credentials lost on container restart** — `OAUTH_ENCRYPTION_KEY` must be set in `.env` for credentials to persist; deployment docs updated with this requirement

[1.0.7]: https://github.com/fxxkrlab/ADMINCHAT_PANEL/compare/v1.0.6...v1.0.7

## [1.0.6] - 2026-03-27

### Fixed
- **Install returns 401 triggering JWT refresh loop** — Market auth failure (401/403) was returned as HTTP 401 which collided with Panel's JWT auth interceptor, causing infinite refresh loops; now returns 422 with clear "Market authentication required" message
- **`activated_at` timezone crash** — `datetime.now(timezone.utc)` (aware) vs `TIMESTAMP WITHOUT TIME ZONE` (naive) column mismatch caused `asyncpg.DataError: can't subtract offset-naive and offset-aware datetimes` on plugin activation
- **Plugin action errors silently swallowed** — `handlePluginAction` (activate/deactivate/update in Installed tab) had no catch block; failures now show error toast with backend detail
- **Notification timer not reset on rapid updates** — Old timer could dismiss new notification early; useEffect now depends on `message`
- **PluginLoader timeout leaked script tags** — Timeout path now calls `script.remove()` matching the onerror cleanup

### Changed
- Error message extraction unified via `getErrorMessage()` utility using `isAxiosError` instead of fragile type assertions

[1.0.6]: https://github.com/fxxkrlab/ADMINCHAT_PANEL/compare/v1.0.5...v1.0.6

## [1.0.5] - 2026-03-27

### Fixed
- **Plugin data lost on container restart** — `/data/plugins` directory was not mounted as a persistent volume; added `adminchat_plugins` volume to all deploy configurations (docker-compose.full.yml, docker-compose.standalone.yml, docker-run.sh)
- **PluginLoader crash could block navigation** — Plugin frontend module load failure (404/timeout) could leave the page in a broken state; added 10s load timeout, failed script tag cleanup, retry tracking, and a manual Retry button
- **"Update to v" empty version** — Plugin detail modal showed "Update to v" with no version number because the detail API doesn't return `latest_version`; now falls back to `versions[0].version`
- **Hardcoded Market URL in frontend** — `installFromMarket()` hardcoded `acpmarket.novahelix.org` download URL; now backend constructs the URL from `settings.ACP_MARKET_URL`
- **Misleading 502 on Market auth failure** — Backend returned generic 502 when Market download failed due to 401/403; now returns clear "Market authentication required" message with 401 status
- **Plugin action errors silently swallowed** — `handlePluginAction` (activate/deactivate/update) had no catch block; failures now show error toast with backend detail message
- **Notification timer not reset** — Rapid successive notifications could be dismissed early because useEffect timer wasn't reset on message change
- **PluginLoader timeout leaked script tags** — Timeout path didn't remove the `<script>` element from DOM, causing potential stale module registrations

### Added
- **Activate/Deactivate buttons in Browse tab** — Plugin cards now show Active/Inactive status badge with a toggle button to activate or deactivate plugins directly from the Browse tab and detail modal
- **Uninstall button in detail modal** — Plugin detail modal footer now shows an Uninstall button (left-aligned) that triggers the confirmation dialog
- **Uninstall confirmation dialog** — Trash button shows a confirmation modal before uninstalling, with a "Delete all plugin data" checkbox that sends `drop_tables: true` to the backend
- **Plugin settings shortcut** — Installed plugins with `settings_tabs` show a gear icon that navigates directly to Settings with the plugin's tab auto-selected
- **Install/uninstall toast notifications** — Success/error feedback toast (auto-dismiss after 4s) for install and uninstall actions
- **Plugin data volume in deploy configs** — All deployment files now include persistent volume mount for `/data/plugins`

[1.0.5]: https://github.com/fxxkrlab/ADMINCHAT_PANEL/compare/v1.0.3...v1.0.5

## [1.0.3] - 2026-03-27

### Added
- **Market JWT authentication** — Panel now authenticates to Market using JWT Bearer tokens (email+password login or API key paste) instead of the non-functional `X-ACP-API-Key` header
- **Market connection management** — New connect/status/disconnect endpoints (`POST /plugins/market/connect`, `GET /plugins/market/status`, `POST /plugins/market/disconnect`) with encrypted credential storage via Fernet
- **Market account status UI** — Settings > Market tab shows connection state, account info (username, role, email, verified status), auth type badge (ENV VAR / API KEY / LOGIN), and disconnect button
- **Ed25519 bundle signature verification** — Panel auto-fetches Market's Ed25519 public key via `GET /signing/public-key`, caches in system_settings, and verifies plugin bundle signatures on download (`X-Bundle-Signature` header)
- **Dual auth source support** — Market credentials can come from `ACP_MARKET_API_KEY` environment variable (priority) or UI-stored JWT tokens; env var connections cannot be disconnected from UI

### Changed
- **Market auth header fix** — All Market API calls now use `Authorization: Bearer <jwt>` instead of the incorrect `X-ACP-API-Key` header that Market never accepted
- **Market tab redesigned** — Removed manual Public Key field; replaced with login form (email/password) and API key paste options with connection status card
- **Plugin download auth** — Bundle downloads from Market now include Bearer auth headers, fixing paid plugin downloads that previously failed silently
- **Signature verifier hardened** — Malformed PEM in `ACP_MARKET_PUBLIC_KEY` env var now raises `PluginSignatureError` at startup instead of silently disabling verification
- **Market proxy error handling** — `_market_request()` now catches httpx errors and returns proper 502 responses instead of leaking raw 500 tracebacks

[1.0.3]: https://github.com/fxxkrlab/ADMINCHAT_PANEL/compare/v1.0.2...v1.0.3

## [1.0.2] - 2026-03-27

### Fixed
- **Market page crash** — `plugin.author.verified` TypeError when Market API returns no author object; added optional chaining on all `plugin.author` accesses
- **Market author display** — Falls back to `author_name` flat field, then `author.display_name`, then 'Unknown'

### Added
- **Market tab in Settings** — Configure Market URL and public key from the Settings page (previously only via environment variables)

### Changed
- Plugin Market README sections updated: movie request content moved to ACP_PLUGINS repo
- CHANGELOG entries added for v1.0.0 and v1.0.1

[1.0.2]: https://github.com/fxxkrlab/ADMINCHAT_PANEL/compare/v1.0.1...v1.0.2

## [1.0.1] - 2026-03-27

### Fixed
- **Claude OAuth 400 error** — Removed deprecated `anthropic-beta` header, updated scopes to match Claude CLI (`org:create_api_key`, `user:sessions`, `user:mcp_servers`), added `code=true` param, handle `code#state` format in authorization codes
- **Claude Session Token flow** — Fixed authorization from GET to POST `/v1/oauth/{org}/authorize`, proper JSON response parsing
- **OpenAI OAuth** — PKCE verifier now uses hex encoding (matching Codex CLI), added `User-Agent: codex-cli/0.91.0`, `codex_cli_simplified_flow` param, refresh scope excludes `offline_access`
- **CRS temperature** — Temperature was silently ignored in Anthropic Responses (CRS) format; now passed for direct API connections, skipped for Claude OAuth proxy (which strips it)

### Changed
- Claude OAuth/Session default `api_format` changed from `openai_chat` to `anthropic_responses`
- OAuth modal: API format shown as read-only (auto-determined per auth method)
- Temperature slider hidden for Claude OAuth/Session modes (proxy doesn't support it)
- Provider switch in API Key form auto-fills default model, base URL, and API format
- Added Google (Gemini) as provider option in API Key form
- Model placeholder changes dynamically per selected provider
- Plugin system section replaces movie request section in README (movie request moved to ACP_PLUGINS repo)

[1.0.1]: https://github.com/fxxkrlab/ADMINCHAT_PANEL/compare/v1.0.0...v1.0.1

## [1.0.0] - 2026-03-24

### Added
- **Plugin System** — Sandboxed plugin runtime with manifest-driven capabilities (database, bot_handler, api_routes, frontend_pages, settings_tab)
- Plugin lifecycle management: install, activate, deactivate, uninstall with cleanup
- `CoreSDKBridge` providing scoped API access (users, bots, messages, groups, faq, settings)
- `PluginSecretStore` with Fernet encryption for plugin secrets
- `PluginConfigStore` with caching for plugin configuration
- `PluginEventBus` pub/sub system for inter-plugin communication
- Plugin Market integration for one-click install from [ACP Market](https://acpmarket.novahelix.org)
- Database tables: `installed_plugins`, `plugin_secrets`
- Alembic migration for plugin system tables
- Frontend: Plugin management page with install/uninstall/activate UI
- Code review: 11 critical+high security issues resolved

### Changed
- Database schema expanded from 30 to 34 tables
- Movie request system extracted as plugin (see [ACP_PLUGINS](https://github.com/fxxkrlab/ACP_PLUGINS))

[1.0.0]: https://github.com/fxxkrlab/ADMINCHAT_PANEL/compare/v0.9.0...v1.0.0

## [0.9.0] - 2026-03-24

### Added
- **TMDB Movie/TV Request System** — Users submit TMDB URLs via Telegram, Bot fetches details and stores requests with deduplication
- Movie request trigger rules: private chat `/req URL` or `req URL`; group chat `@bot req URL`; bare URLs ignored; group `/req` ignored (prevents duplicate triggers from bot pool)
- TMDB API multi-key rotation with automatic rate-limit detection and failover (`TmdbApiKey` model + `TmdbClient` service)
- Deduplication: same `tmdb_id + media_type` merges into one request, `request_count` increments, new `MovieRequestUser` row added
- Bot reply card with poster image, title, year, type, rating, genres, and status (submitted / N users requested / already in library)
- **Movie Requests management page** (`/requests`) with 4 stat cards (Total/Pending/Fulfilled/Rejected), status filter tabs, poster table, fulfill/reject actions
- **TMDB Keys management** in Settings page (card-based UI: add/delete keys, status badges, request counters)
- **Configurable Media Library Database** — optional external DB (PostgreSQL or MySQL) to check if a title is already in the user's media library; if not configured, all requests forward to admin panel
- Media Library Config UI in Settings TMDB tab: DB type/host/port/database/table/column configuration with connection test
- REST API: `GET/PATCH /requests`, `GET /requests/stats`, `GET/POST/DELETE /requests/tmdb-keys`, `GET/POST/DELETE /requests/media-library`, `POST /requests/media-library/test`
- Custom `MovieRequestTrigger` aiogram Filter for context-aware trigger logic (private vs group, mention detection)
- Alembic migration `007_add_movie_requests` (4 new tables: `tmdb_api_keys`, `movie_requests`, `movie_request_users`, `media_library_configs`)
- Frontend types: `MovieRequest`, `MovieRequestDetail`, `MovieRequestStats`, `TmdbApiKey`, `MediaLibraryConfig`
- Sidebar: `Requests` menu item with Film icon (after Bots, `minRole: admin`)

### Changed
- Bot manager now includes `movie_request` handler router (priority before private/group handlers)
- Database schema expanded from 30 to 34 tables

[0.9.0]: https://github.com/fxxkrlab/ADMINCHAT_PANEL/compare/v0.8.2...v0.9.0

## [0.8.2] - 2026-03-23

### Changed
- Replaced keyword filter collapsible panel with dedicated tab for cleaner UI

[0.8.2]: https://github.com/fxxkrlab/ADMINCHAT_PANEL/compare/v0.8.1...v0.8.2

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
