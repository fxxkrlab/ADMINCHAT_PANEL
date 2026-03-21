# Import all models so Alembic and SQLAlchemy can discover them
from app.models.base import Base
from app.models.admin import Admin
from app.models.user import TgUser
from app.models.tag import Tag, UserTag
from app.models.user_group import UserGroup, UserGroupMember
from app.models.bot import Bot
from app.models.group import TgGroup, GroupBot
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.faq import FaqQuestion, FaqAnswer, FaqRule, FaqRuleQuestion, FaqRuleAnswer
from app.models.stats import FaqHitStat, MissedKeyword, UnmatchedMessage
from app.models.ai_config import AiConfig, AiUsageLog
from app.models.settings import SystemSetting
from app.models.audit import AuditLog

__all__ = [
    "Base",
    "Admin",
    "TgUser",
    "Tag",
    "UserTag",
    "UserGroup",
    "UserGroupMember",
    "Bot",
    "TgGroup",
    "GroupBot",
    "Conversation",
    "Message",
    "FaqQuestion",
    "FaqAnswer",
    "FaqRule",
    "FaqRuleQuestion",
    "FaqRuleAnswer",
    "FaqHitStat",
    "MissedKeyword",
    "UnmatchedMessage",
    "AiConfig",
    "AiUsageLog",
    "SystemSetting",
    "AuditLog",
]
