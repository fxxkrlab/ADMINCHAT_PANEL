from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class TgGroup(Base, TimestampMixin):
    __tablename__ = "tg_groups"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tg_chat_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    group_type: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True
    )  # 'group', 'supergroup', 'channel'
    member_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    raw_info: Mapped[dict] = mapped_column(JSONB, server_default="{}")
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true")

    # Relationships
    group_bots = relationship("GroupBot", back_populates="group", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="source_group")


class GroupBot(Base):
    __tablename__ = "group_bots"

    group_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tg_groups.id", ondelete="CASCADE"), primary_key=True
    )
    bot_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("bots.id", ondelete="CASCADE"), primary_key=True
    )
    joined_at: Mapped[datetime] = mapped_column(server_default="now()")

    # Relationships
    group = relationship("TgGroup", back_populates="group_bots")
    bot = relationship("Bot", back_populates="group_bots")
