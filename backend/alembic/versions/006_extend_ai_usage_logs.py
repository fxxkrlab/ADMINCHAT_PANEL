"""Extend ai_usage_logs with prompt/completion tokens, model, reply_mode

Revision ID: 006_extend_ai_usage_logs
Revises: 005_fix_model_issues
Create Date: 2026-03-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006_extend_ai_usage_logs"
down_revision: Union[str, None] = "005_fix_model_issues"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("ai_usage_logs", sa.Column("prompt_tokens", sa.Integer(), nullable=True))
    op.add_column("ai_usage_logs", sa.Column("completion_tokens", sa.Integer(), nullable=True))
    op.add_column("ai_usage_logs", sa.Column("model", sa.String(100), nullable=True))
    op.add_column("ai_usage_logs", sa.Column("reply_mode", sa.String(30), nullable=True))


def downgrade() -> None:
    op.drop_column("ai_usage_logs", "reply_mode")
    op.drop_column("ai_usage_logs", "model")
    op.drop_column("ai_usage_logs", "completion_tokens")
    op.drop_column("ai_usage_logs", "prompt_tokens")
