from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    conversation_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tg_message_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    direction: Mapped[str] = mapped_column(
        String(10), nullable=False, index=True
    )  # 'inbound' | 'outbound'
    sender_type: Mapped[str] = mapped_column(
        String(10), nullable=False
    )  # 'user' | 'admin' | 'bot' | 'faq'
    sender_admin_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("admins.id"), nullable=True, index=True
    )
    via_bot_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("bots.id"), nullable=True, index=True
    )
    content_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # 'text','photo','video','document','sticker','voice','animation','location'
    text_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    media_file_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    media_cached: Mapped[bool] = mapped_column(Boolean, server_default="false")
    media_cache_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    media_cache_expires: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    reply_to_message_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    raw_data: Mapped[dict] = mapped_column(JSONB, server_default="{}")
    faq_matched: Mapped[bool] = mapped_column(Boolean, server_default="false", index=True)
    faq_rule_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("faq_rules.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default="now()", index=True)
    updated_at: Mapped[datetime] = mapped_column(server_default="now()")

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
