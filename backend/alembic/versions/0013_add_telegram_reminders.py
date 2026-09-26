"""link reminders to goals and add Telegram delivery

Revision ID: 0013
Revises: 0012
Create Date: 2026-09-26

notifications.goal_id lets a reminder follow its task: rescheduling
replaces it, completing the task suppresses it, deleting the task removes
it. Before this, reminders were free-standing rows keyed only by title.

notifications.telegram_sent_at is the at-most-once claim for Telegram
delivery. The sender sets it with a conditional UPDATE before sending.

users.telegram_* hold the linked chat and the short-lived, hashed one-time
token used to link it (same pattern as password_reset_token_hash).
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "notifications",
        sa.Column(
            "goal_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("goals.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    op.create_index("ix_notifications_goal_id", "notifications", ["goal_id"])
    op.add_column(
        "notifications",
        sa.Column("telegram_sent_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.add_column("users", sa.Column("telegram_chat_id", sa.BigInteger(), nullable=True))
    op.create_unique_constraint("uq_users_telegram_chat_id", "users", ["telegram_chat_id"])
    op.add_column(
        "users", sa.Column("telegram_linked_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column("users", sa.Column("telegram_link_token_hash", sa.String(), nullable=True))
    op.add_column(
        "users",
        sa.Column("telegram_link_expires_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "telegram_link_expires_at")
    op.drop_column("users", "telegram_link_token_hash")
    op.drop_column("users", "telegram_linked_at")
    op.drop_constraint("uq_users_telegram_chat_id", "users", type_="unique")
    op.drop_column("users", "telegram_chat_id")
    op.drop_column("notifications", "telegram_sent_at")
    op.drop_index("ix_notifications_goal_id", table_name="notifications")
    op.drop_column("notifications", "goal_id")
