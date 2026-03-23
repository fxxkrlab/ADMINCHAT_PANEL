from datetime import date as date_type
from datetime import datetime
from typing import List, Optional

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class FaqHitStat(Base):
    __tablename__ = "faq_hit_stats"
    __table_args__ = (
        UniqueConstraint("faq_rule_id", "question_id", "date", name="uq_faq_hit_rule_q_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    faq_rule_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("faq_rules.id", ondelete="CASCADE"), nullable=False
    )
    question_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("faq_questions.id"), nullable=True
    )
    hit_count: Mapped[int] = mapped_column(Integer, server_default="0")
    last_hit_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    date: Mapped[date_type] = mapped_column(Date, nullable=False)

    # Relationships
    faq_rule = relationship("FaqRule", back_populates="hit_stats")


class MissedKeyword(Base):
    __tablename__ = "missed_keywords"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    keyword: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    sample_messages: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(Text), nullable=True
    )
    occurrence_count: Mapped[int] = mapped_column(Integer, server_default="1", index=True)
    is_resolved: Mapped[bool] = mapped_column(Boolean, server_default="false", index=True)
    last_seen_at: Mapped[datetime] = mapped_column(server_default="now()")
    updated_at: Mapped[datetime] = mapped_column(server_default="now()")
    created_at: Mapped[datetime] = mapped_column(server_default="now()")


class MissedKeywordFilter(Base):
    __tablename__ = "missed_keyword_filters"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    pattern: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    match_mode: Mapped[str] = mapped_column(String(20), server_default="exact")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true")
    created_at: Mapped[datetime] = mapped_column(server_default="now()")
    updated_at: Mapped[datetime] = mapped_column(server_default="now()")


class UnmatchedMessage(Base):
    __tablename__ = "unmatched_messages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tg_user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("tg_users.id"), nullable=True
    )
    text_content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default="now()")
