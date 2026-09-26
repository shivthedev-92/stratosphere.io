"""index goal_logs by (user_id, created_at)

Revision ID: 0016
Revises: 0015
Create Date: 2026-09-26

The progress heatmap reads one user's reflections over a date range. A
composite index serves that and every existing user_id lookup, so it
replaces the single-column one.
"""

from alembic import op

revision: str = "0016"
down_revision: str | None = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_goal_logs_user_created", "goal_logs", ["user_id", "created_at"])
    op.drop_index("ix_goal_logs_user_id", table_name="goal_logs")


def downgrade() -> None:
    op.create_index("ix_goal_logs_user_id", "goal_logs", ["user_id"])
    op.drop_index("ix_goal_logs_user_created", table_name="goal_logs")
