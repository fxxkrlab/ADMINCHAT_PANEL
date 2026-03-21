from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Admin(Base, TimestampMixin):
    __tablename__ = "admins"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    role: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="agent"
    )  # 'super_admin', 'admin', 'agent'
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true")
    tg_user_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    permissions: Mapped[dict] = mapped_column(JSONB, server_default="{}")

    # Relationships
    assigned_conversations = relationship(
        "Conversation",
        foreign_keys="Conversation.assigned_to",
        back_populates="assigned_admin",
    )
    audit_logs = relationship("AuditLog", back_populates="admin")
