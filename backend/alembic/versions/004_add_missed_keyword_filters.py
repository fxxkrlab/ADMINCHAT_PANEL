"""Add missed_keyword_filters table

Revision ID: 004_missed_keyword_filters
Revises: 003_rag_configs
Create Date: 2026-03-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision: str = '004_missed_keyword_filters'
down_revision: Union[str, None] = '003_rag_configs'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'missed_keyword_filters',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('pattern', sa.String(500), nullable=False, index=True),
        sa.Column('match_mode', sa.String(20), server_default='exact', nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('missed_keyword_filters')
