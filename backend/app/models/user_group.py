from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class UserGroup(Base):
    __tablename__ = "user_groups"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default="now()")

    # Relationships
    members = relationship(
        "UserGroupMember", back_populates="group", cascade="all, delete-orphan"
    )


class UserGroupMember(Base):
    __tablename__ = "user_group_members"

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tg_users.id", ondelete="CASCADE"), primary_key=True
    )
    group_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("user_groups.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default="now()")

    # Relationships
    user = relationship("TgUser", back_populates="user_group_members")
    group = relationship("UserGroup", back_populates="members")
