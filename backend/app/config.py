from __future__ import annotations

import logging
import warnings

from pydantic_settings import BaseSettings
from typing import Optional, List

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App
    APP_NAME: str = "ADMINCHAT Panel"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://adminchat:adminchat@localhost:5432/adminchat"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Bot
    BOT_MODE: str = "polling"  # "webhook" | "polling"
    WEBHOOK_BASE_URL: Optional[str] = None
    WEBHOOK_PATH: str = "/webhook/bot"

    # Cloudflare Turnstile
    TURNSTILE_SITE_KEY: Optional[str] = None
    TURNSTILE_SECRET_KEY: Optional[str] = None
    TURNSTILE_TTL_DAYS: int = 30

    # Media cache
    MEDIA_CACHE_TTL_DAYS: int = 7
    MEDIA_CACHE_DIR: str = "/app/media"

    # Initial admin
    INIT_ADMIN_USERNAME: str = "admin"
    INIT_ADMIN_PASSWORD: str = "admin123"

    # AI (optional)
    AI_BASE_URL: Optional[str] = None
    AI_API_KEY: Optional[str] = None
    AI_MODEL: Optional[str] = None

    # RAG (optional)
    RAG_PROVIDER: Optional[str] = None          # "dify" | None
    DIFY_BASE_URL: Optional[str] = None         # e.g. http://docker-api-1:5001/v1
    DIFY_API_KEY: Optional[str] = None           # dataset-xxx
    DIFY_DATASET_ID: Optional[str] = None        # UUID
    RAG_TOP_K: int = 3

    # OAuth
    OAUTH_ENCRYPTION_KEY: str = ""     # Fernet key; auto-generated if empty
    PANEL_BASE_URL: str = ""           # e.g. "https://acp.halotv.top" for OAuth callbacks
    GEMINI_OAUTH_CLIENT_ID: str = ""
    GEMINI_OAUTH_CLIENT_SECRET: str = ""

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


settings = Settings()

# Warn about insecure defaults at import time
if settings.JWT_SECRET_KEY == "change-me-in-production":
    warnings.warn(
        "JWT_SECRET_KEY is using the default insecure value. "
        "Set JWT_SECRET_KEY environment variable in production!",
        stacklevel=1,
    )
if not settings.OAUTH_ENCRYPTION_KEY:
    logger.warning(
        "OAUTH_ENCRYPTION_KEY is empty — a random key will be generated. "
        "OAuth tokens will be lost on restart. Set this in production."
    )
