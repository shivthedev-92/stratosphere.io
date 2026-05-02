from datetime import datetime, timezone
from uuid import uuid4

from app.api.goals import delete_goal, update_goal
from app.schemas.goal import GoalUpdate


class FakeGoal:
    def __init__(self):
        self.id = uuid4()
        self.user_id = uuid4()
        self.title = "Old title"
        self.notes = "Old notes"
        self.is_timed = False
        self.scheduled_for = None
        self.priority = "low"
        self.created_at = datetime.now(timezone.utc)


class FakeQuery:
    def __init__(self, goal):
        self.goal = goal

    def filter(self, *_args):
        return self

    def first(self):
        return self.goal


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
        self.refreshed.append(item)


class FakeUser:
    def __init__(self, user_id):
        self.id = user_id


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
