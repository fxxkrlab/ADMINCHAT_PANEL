import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select

from app.config import settings
from app.api.v1 import router as api_v1_router

logger = logging.getLogger(__name__)


async def create_initial_admin() -> None:
    """Create the initial super_admin account if no admins exist."""
    from app.database import async_session_factory
    from app.models.admin import Admin
    from app.utils.security import hash_password

    try:
        async with async_session_factory() as session:
            result = await session.execute(select(Admin).limit(1))
            existing = result.scalar_one_or_none()

            if existing is not None:
                logger.info("Admin accounts already exist, skipping initial creation.")
                return

            admin = Admin(
                username=settings.INIT_ADMIN_USERNAME,
                password_hash=hash_password(settings.INIT_ADMIN_PASSWORD),
                display_name="Administrator",
                role="super_admin",
                is_active=True,
                permissions={},
            )
            session.add(admin)
            await session.commit()
            logger.info(
                "Initial super_admin created: username=%s",
                settings.INIT_ADMIN_USERNAME,
            )
    except Exception:
        logger.info("Initial admin creation skipped (already exists or error).")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    # --- Startup ---
    # Import models to ensure they are registered with SQLAlchemy
    import app.models  # noqa: F401

    # Create all tables if they don't exist (first run)
    from app.database import engine
    from app.models.base import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables ensured")

    # Create initial admin if no admins exist
    await create_initial_admin()

    # Initialize Redis connection pool
    from app.services.redis import get_redis, close_redis
    await get_redis()
    logger.info("Redis connection initialized")

    # Start bot manager (aiogram dispatchers)
    from app.bot.manager import bot_manager
    try:
        await bot_manager.start()
    except Exception:
        logger.exception("Failed to start BotManager (will continue without bots)")

    # Start WebSocket pub/sub listener
    from app.ws.chat import ws_manager
    await ws_manager.start_pubsub_listener()

    # Start APScheduler
    from app.tasks.scheduler import setup_scheduler
    scheduler = setup_scheduler()
    if scheduler is not None:
        scheduler.start()
        logger.info("APScheduler started")

    yield

    # --- Shutdown ---
    # Stop APScheduler
    if scheduler is not None:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped")

    # Stop WebSocket pub/sub listener
    await ws_manager.stop_pubsub_listener()

    # Stop bot manager
    await bot_manager.stop()

    # Close Redis connections
    await close_redis()

    # Dispose database engine
    from app.database import engine
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(api_v1_router, prefix="/api")


# ---- WebSocket route ----
from app.ws.chat import websocket_chat_endpoint  # noqa: E402

app.add_api_websocket_route("/ws/chat", websocket_chat_endpoint)


# ---- Telegram webhook route ----
@app.post(settings.WEBHOOK_PATH + "/{token_hash}")
async def telegram_webhook(token_hash: str, request: Request):
    """
    Receive incoming Telegram updates via webhook.
    URL: POST /webhook/bot/<sha256_of_bot_token>
    """
    from app.bot.manager import bot_manager

    try:
        data = await request.json()
    except Exception:
        return JSONResponse({"ok": False}, status_code=400)

    # Log incoming update for debugging
    msg = data.get("message", {})
    chat_type = msg.get("chat", {}).get("type", "unknown")
    chat_title = msg.get("chat", {}).get("title", "")
    text = (msg.get("text") or "")[:50]
    logger.info(
        "Webhook update: chat_type=%s chat=%s text=%s update_id=%s",
        chat_type, chat_title or msg.get("chat", {}).get("id"), text, data.get("update_id"),
    )

    try:
        handled = await bot_manager.feed_webhook_update(token_hash, data)
    except Exception:
        logger.exception("Error processing webhook update")
        return JSONResponse({"ok": True})

    if not handled:
        logger.warning("Webhook update for unknown token_hash: %s", token_hash[:16])
        return JSONResponse({"ok": False}, status_code=404)

    return JSONResponse({"ok": True})


@app.get("/health")
async def health_check():
    """Health check endpoint for Docker / load balancer."""
    return {"status": "ok"}
