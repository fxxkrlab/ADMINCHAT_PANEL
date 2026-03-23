from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class MessageOut(BaseModel):
    id: int
    conversation_id: int
    direction: str
    sender_type: str
    sender_admin_id: Optional[int] = None
    sender_admin_name: Optional[str] = None
    via_bot_id: Optional[int] = None
    via_bot_name: Optional[str] = None
    content_type: str
    text_content: Optional[str] = None
    media_url: Optional[str] = None
    reply_to_message_id: Optional[int] = None
    faq_matched: bool = False
    faq_rule_id: Optional[int] = None
    faq_rule_name: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    content_type: str = Field(
        default="text",
        pattern=r"^(text|photo|video|document|sticker|voice|animation)$",
    )
    text_content: Optional[str] = None
    parse_mode: Optional[str] = Field(
        default=None, pattern=r"^(MarkdownV2|HTML)$"
    )
