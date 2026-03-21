from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class AiConfig(Base, TimestampMixin):
    __tablename__ = "ai_configs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    provider: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # 'openai','anthropic','custom'
    base_url: Mapped[str] = mapped_column(String(500), nullable=False)
    api_key: Mapped[str] = mapped_column(String(500), nullable=False)  # encrypted
    model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    api_format: Mapped[str] = mapped_column(
        String(30), server_default="openai_chat",
    )  # 'openai_chat' or 'anthropic_responses'
    default_params: Mapped[dict] = mapped_column(JSONB, server_default="{}")
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true")

    # Relationships
    usage_logs = relationship("AiUsageLog", back_populates="ai_config")


class AiUsageLog(Base):
    __tablename__ = "ai_usage_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tg_user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("tg_users.id"), nullable=True
    )
    ai_config_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("ai_configs.id"), nullable=True
    )
    tokens_used: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cost_estimate: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 6), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default="now()", index=True)

    # Relationships
    ai_config = relationship("AiConfig", back_populates="usage_logs")
