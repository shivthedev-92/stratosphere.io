############################################################################
#    _____ __             __                   __                     _
#   / ___// /__________ _/ /_____  _________  / /_  ___  ________    (_)___
#   \__ \/ __/ ___/ __ `/ __/ __ \/ ___/ __ \/ __ \/ _ \/ ___/ _ \  / / __ \
#  ___/ / /_/ /  / /_/ / /_/ /_/ (__  ) /_/ / / / /  __/ /  /  __/ / / /_/ /
# /____/\__/_/   \__,_/\__/\____/____/ .___/_/ /_/\___/_/   \___(_)_/\____/
#                                   /_/
############################################################################

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationOut, NotificationSummaryOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Notification]:
    if not current_user.in_app_notifications_enabled:
        return []
    return (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )


@router.get("/due", response_model=list[NotificationOut])
def list_due_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Notification]:
    if not current_user.in_app_notifications_enabled:
        return []
    return (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.id,
            Notification.category == "reminder",
            Notification.due_at.is_not(None),
            Notification.due_at <= datetime.now(UTC),
            Notification.acknowledged_at.is_(None),
        )
        .order_by(Notification.due_at.asc())
        .limit(20)
        .all()
    )


@router.get("/summary", response_model=NotificationSummaryOut)
def notification_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationSummaryOut:
    if not current_user.in_app_notifications_enabled:
        return NotificationSummaryOut(unread_count=0)
    unread_count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.read_at.is_(None))
        .count()
    )
    return NotificationSummaryOut(unread_count=unread_count)


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Notification:
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notification.read_at is None:
        notification.read_at = datetime.now(UTC)
        db.add(notification)
        db.commit()
        db.refresh(notification)
    return notification


@router.patch("/{notification_id}/acknowledge", response_model=NotificationOut)
def acknowledge_notification(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Notification:
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    now = datetime.now(UTC)
    notification.acknowledged_at = notification.acknowledged_at or now
    notification.read_at = notification.read_at or now
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


@router.patch("/read-all", response_model=NotificationSummaryOut)
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationSummaryOut:
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.read_at.is_(None),
    ).update({Notification.read_at: datetime.now(UTC)}, synchronize_session=False)
    db.commit()
    return NotificationSummaryOut(unread_count=0)
