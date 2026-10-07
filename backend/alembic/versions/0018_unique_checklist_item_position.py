"""make checklist item positions unique per checklist

Revision ID: 0018
Revises: 0017
Create Date: 2026-10-07

Adding items locks the checklist row, so positions cannot collide; this
constraint is the backstop that keeps the order well defined if anything
ever bypasses that path. Existing rows already have distinct positions
(each list is written once with 0..n-1 and appends take max + 1).
"""

from alembic import op

revision: str = "0018"
down_revision: str | None = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_checklist_items_checklist_position", "checklist_items", ["checklist_id", "position"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_checklist_items_checklist_position", "checklist_items", type_="unique")
