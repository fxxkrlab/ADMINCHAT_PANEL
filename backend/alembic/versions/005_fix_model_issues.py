"""Fix model issues: tag color default, message FK + indexes, conversation indexes, updated_at columns

Revision ID: 005_fix_model_issues
Revises: 004_missed_keyword_filters
Create Date: 2026-03-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision: str = '005_fix_model_issues'
down_revision: Union[str, None] = '004_missed_keyword_filters'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Fix tag.color server_default (was "'#3B82F6'" with extra quotes)
    op.alter_column(
        'tags', 'color',
        server_default='#3B82F6',
    )
    # Fix any existing bad data with extra quotes
    op.execute("UPDATE tags SET color = '#3B82F6' WHERE color LIKE '''%'''")

    # 2. Add updated_at to tags
    op.add_column(
        'tags',
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    )

    # 3. Add updated_at to messages
    op.add_column(
        'messages',
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    )

    # 4. Add FK constraint on messages.faq_rule_id
    op.create_foreign_key(
        'fk_messages_faq_rule_id',
        'messages', 'faq_rules',
        ['faq_rule_id'], ['id'],
        ondelete='SET NULL',
    )

    # 5. Add missing indexes on messages
    op.create_index('ix_messages_sender_admin_id', 'messages', ['sender_admin_id'])
    op.create_index('ix_messages_via_bot_id', 'messages', ['via_bot_id'])

    # 6. Add missing indexes on conversations
    op.create_index('ix_conversations_source_group_id', 'conversations', ['source_group_id'])
    op.create_index('ix_conversations_primary_bot_id', 'conversations', ['primary_bot_id'])


def downgrade() -> None:
    op.drop_index('ix_conversations_primary_bot_id', 'conversations')
    op.drop_index('ix_conversations_source_group_id', 'conversations')
    op.drop_index('ix_messages_via_bot_id', 'messages')
    op.drop_index('ix_messages_sender_admin_id', 'messages')
    op.drop_constraint('fk_messages_faq_rule_id', 'messages', type_='foreignkey')
    op.drop_column('messages', 'updated_at')
    op.drop_column('tags', 'updated_at')
    op.alter_column('tags', 'color', server_default="'#3B82F6'")
