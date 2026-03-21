from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class FaqQuestion(Base, TimestampMixin):
    __tablename__ = "faq_questions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    keyword: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    match_mode: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # 'exact','prefix','contains','regex'
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true")

    # Relationships
    rule_questions = relationship(
        "FaqRuleQuestion", back_populates="question", cascade="all, delete-orphan"
    )


class FaqAnswer(Base, TimestampMixin):
    __tablename__ = "faq_answers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(
        String(20), server_default="text"
    )  # 'text','photo','mixed'
    media_file_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true")

    # Relationships
    rule_answers = relationship(
        "FaqRuleAnswer", back_populates="answer", cascade="all, delete-orphan"
    )


class FaqRule(Base, TimestampMixin):
    __tablename__ = "faq_rules"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    response_mode: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # 'single', 'random', 'all'
    reply_mode: Mapped[str] = mapped_column(
        String(30), nullable=False, server_default="direct"
    )  # 'direct','ai_only','ai_polish','ai_fallback','ai_intent','ai_template','rag'
    ai_config: Mapped[dict] = mapped_column(JSONB, server_default="{}")
    priority: Mapped[int] = mapped_column(Integer, server_default="0")
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", index=True)
    daily_ai_limit: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Relationships
    rule_questions = relationship(
        "FaqRuleQuestion", back_populates="rule", cascade="all, delete-orphan"
    )
    rule_answers = relationship(
        "FaqRuleAnswer", back_populates="rule", cascade="all, delete-orphan"
    )
    hit_stats = relationship("FaqHitStat", back_populates="faq_rule", cascade="all, delete-orphan")


class FaqRuleQuestion(Base):
    __tablename__ = "faq_rule_questions"

    rule_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("faq_rules.id", ondelete="CASCADE"), primary_key=True
    )
    question_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("faq_questions.id", ondelete="CASCADE"), primary_key=True
    )

    # Relationships
    rule = relationship("FaqRule", back_populates="rule_questions")
    question = relationship("FaqQuestion", back_populates="rule_questions")


class FaqRuleAnswer(Base):
    __tablename__ = "faq_rule_answers"

    rule_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("faq_rules.id", ondelete="CASCADE"), primary_key=True
    )
    answer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("faq_answers.id", ondelete="CASCADE"), primary_key=True
    )

    # Relationships
    rule = relationship("FaqRule", back_populates="rule_answers")
    answer = relationship("FaqAnswer", back_populates="rule_answers")
