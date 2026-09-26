"""add oauth_identities; password optional

Revision ID: 0015
Revises: 0014
Create Date: 2026-09-26

Sign-in with Google or Microsoft. Each row ties a provider account
(provider + its stable subject id) to a user. Accounts created this way have
no password, so users.hashed_password becomes nullable.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("users", "hashed_password", existing_type=sa.String(), nullable=True)
    op.create_table(
        "oauth_identities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("provider", sa.String(length=20), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("provider", "subject", name="uq_oauth_identities_provider_subject"),
    )


def downgrade() -> None:
    op.drop_table("oauth_identities")
    # Fails if password-less (OAuth-only) users exist; remove them first.
    op.alter_column("users", "hashed_password", existing_type=sa.String(), nullable=False)
