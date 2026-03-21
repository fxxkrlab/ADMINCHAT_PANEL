from fastapi import APIRouter

from app.api.v1.admin import router as admin_router
from app.api.v1.auth import router as auth_router
from app.api.v1.blacklist import router as blacklist_router
from app.api.v1.bots import router as bots_router
from app.api.v1.faq import router as faq_router
from app.api.v1.conversations import router as conversations_router
from app.api.v1.media import router as media_router
from app.api.v1.messages import router as messages_router
from app.api.v1.stats import router as stats_router
from app.api.v1.tags import router as tags_router
from app.api.v1.users import router as users_router
from app.api.v1.ai_config import router as ai_config_router
from app.api.v1.audit import router as audit_router
from app.api.v1.settings import router as settings_router
from app.services.turnstile import router as turnstile_router

router = APIRouter(prefix="/v1")

router.include_router(auth_router, prefix="/auth", tags=["Auth"])
router.include_router(stats_router, prefix="/stats", tags=["Stats"])
router.include_router(admin_router, prefix="/admins", tags=["Admins"])
router.include_router(conversations_router, prefix="/conversations", tags=["Conversations"])
router.include_router(messages_router, prefix="/conversations", tags=["Messages"])
router.include_router(users_router, prefix="/users", tags=["Users"])
router.include_router(media_router, prefix="/messages", tags=["Media"])
router.include_router(bots_router, prefix="/bots", tags=["Bots"])
router.include_router(tags_router, tags=["Tags & Groups"])
router.include_router(blacklist_router, prefix="/blacklist", tags=["Blacklist"])
router.include_router(faq_router, prefix="/faq", tags=["FAQ"])
router.include_router(ai_config_router, prefix="/ai", tags=["AI Config"])
router.include_router(settings_router, prefix="/settings", tags=["Settings"])
router.include_router(turnstile_router, prefix="/turnstile", tags=["Turnstile"])
router.include_router(audit_router, prefix="/audit-logs", tags=["Audit Logs"])
