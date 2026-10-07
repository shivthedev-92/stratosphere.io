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

from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.goal import Goal, GoalLog
from app.models.notification import Notification
from app.models.user import User
from app.schemas.goal import GoalCreate, GoalLogCreate, GoalLogOut, GoalOut, GoalUpdate
from app.services.reminders import build_reminder, sync_goal_reminder
from app.services.safety import build_crisis_notice, detect_crisis

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("", response_model=list[GoalOut])
def list_goals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Goal]:
    return (
        db.query(Goal)
        .filter(Goal.user_id == current_user.id)
        .order_by(Goal.created_at.desc())
        .all()
    )


@router.post("", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
def create_goal(
    data: GoalCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Goal:
    goal = Goal(
        # Explicit id so the reminder can reference the goal before flush.
        id=uuid4(),
        user_id=current_user.id,
        title=data.title,
        emoji=data.emoji,
        notes=data.notes,
        is_timed=data.is_timed,
        scheduled_for=data.scheduled_for if data.is_timed else None,
        priority=data.priority,
    )
    db.add(goal)
    reminder = build_reminder(goal, current_user)
    if reminder is not None:
        db.add(reminder)
    elif current_user.in_app_notifications_enabled:
        db.add(
            Notification(
                user_id=current_user.id,
                goal_id=goal.id,
                title="Action item added",
                body=goal.title,
                category="task",
            )
        )
    db.commit()
    db.refresh(goal)
    return goal


@router.patch("/{goal_id}", response_model=GoalOut)
def update_goal(
    goal_id: UUID,
    data: GoalUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Goal:
    goal = get_owned_goal(goal_id, current_user, db)
    before = (goal.title, goal.is_timed, goal.scheduled_for, getattr(goal, "completed", False))
    goal.title = data.title
    goal.emoji = data.emoji
    goal.notes = data.notes
    goal.is_timed = data.is_timed
    goal.scheduled_for = data.scheduled_for if data.is_timed else None
    goal.priority = data.priority
    if data.completed is not None and goal.completed != data.completed:
        goal.completed = data.completed
        goal.completed_at = datetime.now(timezone.utc) if data.completed else None
    db.add(goal)
    after = (goal.title, goal.is_timed, goal.scheduled_for, getattr(goal, "completed", False))
    if after != before:
        # Rescheduled, un-timed, renamed or (un)completed: the pending
        # reminder must follow, or it fires at the old time or for a done task.
        sync_goal_reminder(db, goal, current_user)
    db.commit()
    db.refresh(goal)
    return goal


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    goal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    goal = get_owned_goal(goal_id, current_user, db)
    db.delete(goal)
    db.commit()


@router.get("/logs", response_model=list[GoalLogOut])
def list_all_goal_logs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[GoalLog]:
    return (
        db.query(GoalLog)
        .filter(GoalLog.user_id == current_user.id)
        .order_by(GoalLog.created_at.asc())
        .all()
    )


@router.get("/{goal_id}", response_model=GoalOut)
def get_goal(
    goal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Goal:
    return get_owned_goal(goal_id, current_user, db)


@router.get("/{goal_id}/logs", response_model=list[GoalLogOut])
def list_goal_logs(
    goal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[GoalLog]:
    get_owned_goal(goal_id, current_user, db)
    return (
        db.query(GoalLog)
        .filter(GoalLog.goal_id == goal_id, GoalLog.user_id == current_user.id)
        .order_by(GoalLog.created_at.desc())
        .all()
    )


@router.post("/{goal_id}/logs", response_model=GoalLogOut, status_code=status.HTTP_201_CREATED)
def create_goal_log(
    goal_id: UUID,
    data: GoalLogCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GoalLogOut:
    goal = get_owned_goal(goal_id, current_user, db)
    log = GoalLog(
        user_id=current_user.id,
        goal_id=goal_id,
        completed=goal.completed if data.completed is None else data.completed,
        reflection=data.reflection,
        soulful=data.soulful,
        emotion_label=data.emotion_label,
    )
    db.add(log)
    if current_user.in_app_notifications_enabled:
        db.add(
            Notification(
                user_id=current_user.id,
                title="Reflection saved",
                body=goal.title,
                category="reflection",
            )
        )
    db.commit()
    db.refresh(log)

    # Additive safety notice. The reflection is already committed above -
    # detection never blocks or discards what the user wrote.
    out = GoalLogOut.model_validate(log)
    if detect_crisis(data.reflection) is not None:
        out.safety = build_crisis_notice()
    return out


def get_owned_goal(goal_id: UUID, current_user: User, db: Session) -> Goal:
    goal = (
        db.query(Goal)
        .filter(Goal.id == goal_id, Goal.user_id == current_user.id)
        .first()
    )
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal
