"""add avatar_id to users

Revision ID: 0014
Revises: 0013
Create Date: 2026-09-26

The user's chosen avatar from the brand set (see app.avatars.AVATAR_IDS).
Null means no choice yet; clients fall back to the name's initial.
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_id", sa.String(length=40), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "avatar_id")
