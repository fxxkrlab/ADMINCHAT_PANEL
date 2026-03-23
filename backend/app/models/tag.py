from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    color: Mapped[str] = mapped_column(String(7), server_default="#3B82F6")
    created_at: Mapped[datetime] = mapped_column(server_default="now()")
    updated_at: Mapped[datetime] = mapped_column(server_default="now()")

    # Relationships
    user_tags = relationship("UserTag", back_populates="tag", cascade="all, delete-orphan")


class UserTag(Base):
    __tablename__ = "user_tags"

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tg_users.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
    )
    created_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("admins.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default="now()")

    # Relationships
    user = relationship("TgUser", back_populates="user_tags")
    tag = relationship("Tag", back_populates="user_tags")
