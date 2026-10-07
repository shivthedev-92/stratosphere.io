############################################################################
#    _____ __             __                   __                     _     
#   / ___// /__________ _/ /_____  _________  / /_  ___  ________    (_)___ 
#   \__ \/ __/ ___/ __ `/ __/ __ \/ ___/ __ \/ __ \/ _ \/ ___/ _ \  / / __ \
#  ___/ / /_/ /  / /_/ / /_/ /_/ (__  ) /_/ / / / /  __/ /  /  __/ / / /_/ /
# /____/\__/_/   \__,_/\__/\____/____/ .___/_/ /_/\___/_/   \___(_)_/\____/ 
#                                   /_/                                     
############################################################################
# Copyright (c) 2024. Sivarajan kakamaniyan. All rights reserved.
# Statosphere is a product of Sivarajan Kakamaniyan. 
# Unauthorized copying of this file, via any medium is strictly prohibited.
# Version 0.1.0 | 2024-06
############################################################################

"""Checklists: lists of action items written into a task's journal."""

from collections import defaultdict
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.goals import get_owned_goal
from app.db import get_db
from app.deps import get_current_user
from app.models.goal import ChecklistItem, GoalChecklist
from app.models.user import User
from app.schemas.checklist import (
    MAX_CHECKLIST_ITEMS,
    ChecklistCreate,
    ChecklistItemCreate,
    ChecklistItemOut,
    ChecklistItemUpdate,
    ChecklistOut,
)

router = APIRouter(tags=["checklists"])


def set_item_completed(item: ChecklistItem, completed: bool, now: datetime) -> None:
    """Tick or untick. Re-ticking a ticked item keeps its original time."""
    if completed and item.completed_at is None:
        item.completed_at = now
    elif not completed:
        item.completed_at = None


def checklist_out(checklist: GoalChecklist, items: list[ChecklistItem]) -> ChecklistOut:
    return ChecklistOut(
        id=checklist.id,
        goal_id=checklist.goal_id,
        title=checklist.title,
        created_at=checklist.created_at,
        items=[
            ChecklistItemOut.model_validate(item)
            for item in sorted(items, key=lambda i: i.position)
        ],
    )


def get_owned_checklist(
    checklist_id: UUID, current_user: User, db: Session, lock: bool = False
) -> GoalChecklist:
    query = db.query(GoalChecklist).filter(
        GoalChecklist.id == checklist_id, GoalChecklist.user_id == current_user.id
    )
    checklist = (query.with_for_update() if lock else query).first()
    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist not found")
    return checklist


def get_owned_item(item_id: UUID, current_user: User, db: Session) -> ChecklistItem:
    item = (
        db.query(ChecklistItem)
        .filter(ChecklistItem.id == item_id, ChecklistItem.user_id == current_user.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    return item


@router.get("/goals/{goal_id}/checklists", response_model=list[ChecklistOut])
def list_checklists(
    goal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ChecklistOut]:
    get_owned_goal(goal_id, current_user, db)
    checklists = (
        db.query(GoalChecklist)
        .filter(GoalChecklist.goal_id == goal_id, GoalChecklist.user_id == current_user.id)
        .order_by(GoalChecklist.created_at.desc())
        .all()
    )
    if not checklists:
        return []
    items_by_checklist: dict[UUID, list[ChecklistItem]] = defaultdict(list)
    for item in (
        db.query(ChecklistItem)
        .filter(
            ChecklistItem.checklist_id.in_([c.id for c in checklists]),
            ChecklistItem.user_id == current_user.id,
        )
        .all()
    ):
        items_by_checklist[item.checklist_id].append(item)
    return [checklist_out(c, items_by_checklist[c.id]) for c in checklists]


@router.post(
    "/goals/{goal_id}/checklists", response_model=ChecklistOut, status_code=status.HTTP_201_CREATED
)
def create_checklist(
    goal_id: UUID,
    data: ChecklistCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChecklistOut:
    get_owned_goal(goal_id, current_user, db)
    # One timestamp for the list and its items, so "took" starts together.
    now = datetime.now(timezone.utc)
    checklist = GoalChecklist(
        id=uuid4(), user_id=current_user.id, goal_id=goal_id, title=data.title, created_at=now
    )
    items = [
        ChecklistItem(
            id=uuid4(),
            user_id=current_user.id,
            checklist_id=checklist.id,
            text=text,
            position=position,
            created_at=now,
        )
        for position, text in enumerate(data.items)
    ]
    db.add(checklist)
    db.flush()  # the checklist row must exist before its items reference it
    db.add_all(items)
    db.commit()
    return checklist_out(checklist, items)


@router.delete("/checklists/{checklist_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_checklist(
    checklist_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    db.delete(get_owned_checklist(checklist_id, current_user, db))
    db.commit()


@router.post(
    "/checklists/{checklist_id}/items",
    response_model=ChecklistItemOut,
    status_code=status.HTTP_201_CREATED,
)
def add_checklist_item(
    checklist_id: UUID,
    data: ChecklistItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChecklistItem:
    checklist = get_owned_checklist(checklist_id, current_user, db, lock=True)
    # The row lock above serialises concurrent adds to this checklist, so the
    # count and next position below cannot be read by two requests at once.
    count, last_position = (
        db.query(func.count(ChecklistItem.id), func.max(ChecklistItem.position))
        .filter(ChecklistItem.checklist_id == checklist.id)
        .one()
    )
    if count >= MAX_CHECKLIST_ITEMS:
        raise HTTPException(
            status_code=422, detail=f"A checklist holds up to {MAX_CHECKLIST_ITEMS} items"
        )
    item = ChecklistItem(
        id=uuid4(),
        user_id=current_user.id,
        checklist_id=checklist.id,
        text=data.text,
        position=0 if last_position is None else last_position + 1,
        created_at=datetime.now(timezone.utc),
    )
    db.add(item)
    db.commit()
    return item


@router.patch("/checklists/items/{item_id}", response_model=ChecklistItemOut)
def update_checklist_item(
    item_id: UUID,
    data: ChecklistItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChecklistItem:
    item = get_owned_item(item_id, current_user, db)
    if data.text is not None:
        item.text = data.text
    if data.completed is not None:
        set_item_completed(item, data.completed, datetime.now(timezone.utc))
    db.commit()
    return item


@router.delete("/checklists/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_checklist_item(
    item_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    db.delete(get_owned_item(item_id, current_user, db))
    db.commit()
