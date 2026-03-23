"""
Bot Group models — organise bots into named groups for FAQ routing.
"""
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class BotGroup(Base, TimestampMixin):
    __tablename__ = "bot_groups"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true")

    # Relationships
    members: Mapped[list["BotGroupMember"]] = relationship(
        "BotGroupMember", back_populates="bot_group", cascade="all, delete-orphan",
        lazy="selectin",
    )


class BotGroupMember(Base):
    __tablename__ = "bot_group_members"

    bot_group_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("bot_groups.id", ondelete="CASCADE"), primary_key=True
    )
    bot_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("bots.id", ondelete="CASCADE"), primary_key=True
    )

    # A bot can only belong to one group at a time
    __table_args__ = (
        UniqueConstraint("bot_id", name="uq_bot_group_members_bot_id"),
    )

    # Relationships
    bot_group: Mapped["BotGroup"] = relationship("BotGroup", back_populates="members", lazy="selectin")
    bot: Mapped["Bot"] = relationship("Bot", lazy="selectin")
