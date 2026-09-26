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
"""Task reminders: one pending reminder per timed task, kept in step with it.

A reminder is a Notification row with category="reminder", due_at set to
the task's scheduled time, and goal_id pointing at the task. Delivery
(in-app bell, Telegram) reads these rows; this module decides which rows
should exist.
"""

from sqlalchemy.orm import Session

from app.models.goal import Goal
from app.models.notification import Notification
from app.models.user import User


def reminders_wanted(user: User) -> bool:
    """A reminder is worth creating if any channel will deliver it."""
    return bool(
        getattr(user, "in_app_notifications_enabled", False)
        or getattr(user, "telegram_chat_id", None) is not None
    )


def build_reminder(goal: Goal, user: User) -> Notification | None:
    """The reminder this task should have right now, or None."""
    if not (goal.is_timed and goal.scheduled_for):
        return None
    if getattr(goal, "completed", False):
        return None
    if not reminders_wanted(user):
        return None
    return Notification(
        user_id=user.id,
        goal_id=goal.id,
        title="Task reminder",
        body=goal.title,
        category="reminder",
        due_at=goal.scheduled_for,
    )


def sync_goal_reminder(db: Session, goal: Goal, user: User) -> None:
    """Replace the task's pending reminder with one matching its current state.

    "Pending" means not yet delivered to Telegram and not acknowledged in the
    app. Delivered or acknowledged reminders are history and are left alone.
    """
    db.query(Notification).filter(
        Notification.goal_id == goal.id,
        Notification.category == "reminder",
        Notification.telegram_sent_at.is_(None),
        Notification.acknowledged_at.is_(None),
    ).delete(synchronize_session=False)
    reminder = build_reminder(goal, user)
    if reminder is not None:
        db.add(reminder)
