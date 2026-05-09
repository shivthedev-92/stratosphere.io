"""add goal completion fields

Revision ID: 0010
Revises: 0009
Create Date: 2026-05-09 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "goals",
        sa.Column("completed", sa.Boolean(), server_default="false", nullable=False),
    )
    op.add_column("goals", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_goals_user_completed", "goals", ["user_id", "completed"])
    op.execute(
        """
        UPDATE goals
        SET completed = true,
            completed_at = latest_logs.latest_completed_at
        FROM (
            SELECT goal_id, max(created_at) AS latest_completed_at
            FROM goal_logs
            WHERE completed = true
            GROUP BY goal_id
        ) AS latest_logs
        WHERE goals.id = latest_logs.goal_id
        """
    )


def downgrade() -> None:
    op.drop_index("ix_goals_user_completed", table_name="goals")
    op.drop_column("goals", "completed_at")
    op.drop_column("goals", "completed")
