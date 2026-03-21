from __future__ import annotations

from pydantic_settings import BaseSettings
from typing import Optional, List


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

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


settings = Settings()
