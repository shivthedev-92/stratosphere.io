"""create goals

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-30

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "goals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_timed", sa.Boolean(), nullable=False),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=True),
        sa.Column("priority", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_goals_user_id", "goals", ["user_id"])

    op.create_table(
        "goal_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("goal_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("completed", sa.Boolean(), nullable=False),
        sa.Column("reflection", sa.Text(), nullable=False),
        sa.Column("soulful", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["goal_id"], ["goals.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_goal_logs_user_id", "goal_logs", ["user_id"])
    op.create_index("ix_goal_logs_goal_id", "goal_logs", ["goal_id"])


def downgrade() -> None:
    op.drop_index("ix_goal_logs_goal_id", table_name="goal_logs")
    op.drop_index("ix_goal_logs_user_id", table_name="goal_logs")
    op.drop_table("goal_logs")
    op.drop_index("ix_goals_user_id", table_name="goals")
    op.drop_table("goals")
