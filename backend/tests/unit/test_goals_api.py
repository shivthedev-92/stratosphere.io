from datetime import datetime, timezone
from uuid import uuid4

import pytest

from app.api.goals import create_goal_log, delete_goal, update_goal
from app.schemas.goal import GoalLogCreate, GoalUpdate


class FakeGoal:
    def __init__(self):
        self.id = uuid4()
        self.user_id = uuid4()
        self.title = "Old title"
        self.notes = "Old notes"
        self.is_timed = False
        self.scheduled_for = None
        self.priority = "low"
        self.completed = False
        self.created_at = datetime.now(timezone.utc)


class FakeQuery:
    def __init__(self, goal):
        self.goal = goal

    def filter(self, *_args):
        return self

    def first(self):
        return self.goal

    def delete(self, **_kwargs):
        return 0


class FakeSession:
    def __init__(self, goal):
        self.goal = goal
        self.added = []
        self.deleted = []
        self.committed = False
        self.refreshed = []

    def query(self, _model):
        return FakeQuery(self.goal)

    def add(self, item):
        self.added.append(item)

    def delete(self, item):
        self.deleted.append(item)

    def commit(self):
        self.committed = True

    def refresh(self, item):
        # Stand in for the database filling server defaults.
        item.id = getattr(item, "id", None) or uuid4()
        item.created_at = getattr(item, "created_at", None) or datetime.now(timezone.utc)
        self.refreshed.append(item)


class FakeUser:
    def __init__(self, user_id):
        self.id = user_id
        self.in_app_notifications_enabled = False
        self.telegram_chat_id = None


def test_update_goal_changes_owned_goal_fields():
    goal = FakeGoal()
    user = FakeUser(goal.user_id)
    db = FakeSession(goal)
    scheduled_for = datetime.now(timezone.utc)

    updated = update_goal(
        goal.id,
        GoalUpdate(
            title="New title",
            notes="New notes",
            is_timed=True,
            scheduled_for=scheduled_for,
            priority="high",
        ),
        user,
        db,
    )

    assert updated.title == "New title"
    assert updated.notes == "New notes"
    assert updated.is_timed is True
    assert updated.scheduled_for == scheduled_for
    assert updated.priority == "high"
    assert db.added == [goal]
    assert db.committed is True
    assert db.refreshed == [goal]


def test_delete_goal_removes_owned_goal():
    goal = FakeGoal()
    user = FakeUser(goal.user_id)
    db = FakeSession(goal)

    delete_goal(goal.id, user, db)

    assert db.deleted == [goal]
    assert db.committed is True


@pytest.mark.parametrize("task_completed", [True, False])
def test_reflection_records_whether_the_task_is_complete(task_completed):
    goal = FakeGoal()
    goal.completed = task_completed
    db = FakeSession(goal)

    log = create_goal_log(
        goal.id, GoalLogCreate(reflection="Went fine"), current_user=FakeUser(goal.user_id), db=db
    )

    assert log.completed is task_completed


def test_reflection_keeps_an_explicit_completed_from_older_clients():
    goal = FakeGoal()
    db = FakeSession(goal)

    log = create_goal_log(
        goal.id,
        GoalLogCreate(completed=True, reflection="Went fine"),
        current_user=FakeUser(goal.user_id),
        db=db,
    )

    assert log.completed is True
