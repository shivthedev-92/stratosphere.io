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

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.goal import Goal, GoalLog
from app.models.user import User
from app.schemas.goal import GoalCreate, GoalLogCreate, GoalLogOut, GoalOut

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
        user_id=current_user.id,
        title=data.title,
        notes=data.notes,
        is_timed=data.is_timed,
        scheduled_for=data.scheduled_for if data.is_timed else None,
        priority=data.priority,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


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
) -> GoalLog:
    get_owned_goal(goal_id, current_user, db)
    log = GoalLog(
        user_id=current_user.id,
        goal_id=goal_id,
        completed=data.completed,
        reflection=data.reflection,
        soulful=data.soulful,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def get_owned_goal(goal_id: UUID, current_user: User, db: Session) -> Goal:
    goal = (
        db.query(Goal)
        .filter(Goal.id == goal_id, Goal.user_id == current_user.id)
        .first()
    )
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal
