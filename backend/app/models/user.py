from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class TgUser(Base, TimestampMixin):
    __tablename__ = "tg_users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tg_uid: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False, index=True)
    username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    first_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    language_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    is_premium: Mapped[bool] = mapped_column(Boolean, server_default="false")
    is_bot: Mapped[bool] = mapped_column(Boolean, server_default="false")
    dc_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    phone_region: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    photo_file_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    raw_info: Mapped[dict] = mapped_column(JSONB, server_default="{}")
    is_blocked: Mapped[bool] = mapped_column(Boolean, server_default="false", index=True)
    block_reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    turnstile_verified_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    turnstile_expires_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    first_seen_at: Mapped[datetime] = mapped_column(server_default="now()")
    last_active_at: Mapped[datetime] = mapped_column(server_default="now()", index=True)

    # Relationships
    conversations = relationship("Conversation", back_populates="tg_user")
    user_tags = relationship("UserTag", back_populates="user", cascade="all, delete-orphan")
    user_group_members = relationship(
        "UserGroupMember", back_populates="user", cascade="all, delete-orphan"
    )
