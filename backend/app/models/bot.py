from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Bot(Base, TimestampMixin):
    __tablename__ = "bots"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    token: Mapped[str] = mapped_column(String(255), nullable=False)
    bot_username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    bot_id: Mapped[Optional[int]] = mapped_column(BigInteger, unique=True, nullable=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true")
    is_rate_limited: Mapped[bool] = mapped_column(Boolean, server_default="false")
    rate_limit_until: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    priority: Mapped[int] = mapped_column(Integer, server_default="0")

    # Relationships
    group_bots = relationship("GroupBot", back_populates="bot", cascade="all, delete-orphan")
