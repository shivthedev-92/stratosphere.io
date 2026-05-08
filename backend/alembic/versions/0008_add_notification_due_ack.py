"""add notification due acknowledgement fields

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-08 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("notifications", sa.Column("due_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("notifications", sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_notifications_user_due", "notifications", ["user_id", "due_at"])


def downgrade() -> None:
    op.drop_index("ix_notifications_user_due", table_name="notifications")
    op.drop_column("notifications", "acknowledged_at")
    op.drop_column("notifications", "due_at")
