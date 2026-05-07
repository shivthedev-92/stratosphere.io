"""add goal emoji

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-07 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("goals", sa.Column("emoji", sa.String(length=16), nullable=True))


def downgrade() -> None:
    op.drop_column("goals", "emoji")
