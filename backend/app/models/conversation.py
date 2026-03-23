from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Conversation(Base, TimestampMixin):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tg_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tg_users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # 'private' | 'group'
    source_group_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("tg_groups.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(
        String(20), server_default="open", index=True
    )  # 'open', 'resolved', 'blocked'
    assigned_to: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("admins.id"), nullable=True, index=True
    )
    primary_bot_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("bots.id"), nullable=True, index=True
    )
    last_message_at: Mapped[Optional[datetime]] = mapped_column(nullable=True, index=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    resolved_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("admins.id"), nullable=True
    )

    # Relationships
    tg_user = relationship("TgUser", back_populates="conversations", lazy="selectin")
    source_group = relationship("TgGroup", back_populates="conversations", lazy="selectin")
    assigned_admin = relationship(
        "Admin",
        foreign_keys=[assigned_to],
        back_populates="assigned_conversations",
        lazy="selectin",
    )
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", lazy="noload")
