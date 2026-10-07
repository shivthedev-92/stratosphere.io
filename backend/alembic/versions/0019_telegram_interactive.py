"""interactive Telegram bot: conversation state, timezone, message ids

Revision ID: 0019
Revises: 0018
Create Date: 2026-10-07

users.telegram_pending* hold what the bot is waiting for from a chat (a
reflection after "Reflect", the task for a stray thought), with an expiry.
users.timezone is the IANA zone the web app reports, used for "today" and
for parsing "tomorrow 6pm". notifications.telegram_message_id links a sent
reminder to its Telegram message so a reply to it lands on the right task.
All additive and nullable.
"""

import sqlalchemy as sa

from alembic import op

revision: str = "0019"
down_revision: str | None = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("telegram_pending", sa.String(80), nullable=True))
    op.add_column("users", sa.Column("telegram_pending_text", sa.Text(), nullable=True))
    op.add_column(
        "users", sa.Column("telegram_pending_expires_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column("users", sa.Column("timezone", sa.String(64), nullable=True))
    op.add_column("notifications", sa.Column("telegram_message_id", sa.BigInteger(), nullable=True))


def downgrade() -> None:
    op.drop_column("notifications", "telegram_message_id")
    op.drop_column("users", "timezone")
    op.drop_column("users", "telegram_pending_expires_at")
    op.drop_column("users", "telegram_pending_text")
    op.drop_column("users", "telegram_pending")
