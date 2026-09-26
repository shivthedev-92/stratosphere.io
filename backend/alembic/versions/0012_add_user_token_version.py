"""add token_version to users

Revision ID: 0012
Revises: 0011
Create Date: 2026-08-10

Access tokens carry the token_version they were minted with. Bumping the
column invalidates every session issued before the bump, which is how a
password reset revokes an attacker's existing token.
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("users", "token_version")
