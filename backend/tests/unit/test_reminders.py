"""A task's pending reminder must follow the task.

Before goal_id existed on notifications, rescheduling left the reminder at
the old time and completing or deleting the task left it firing. Telegram
delivery would have made that visible, so these rules are pinned here.
"""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.api.goals import update_goal
from app.schemas.goal import GoalUpdate
from app.services.reminders import build_reminder, reminders_wanted

NOW = datetime(2026, 9, 26, 9, 0, tzinfo=timezone.utc)


class Obj:
    def __init__(self, **kw):
        self.__dict__.update(kw)


def user(in_app=True, chat_id=None):
    return Obj(id=uuid4(), in_app_notifications_enabled=in_app, telegram_chat_id=chat_id)


def goal(**kw):
    base = dict(id=uuid4(), title="Read 15 minutes", notes="private notes", is_timed=True,
                scheduled_for=NOW, completed=False, emoji=None, priority="medium")
    base.update(kw)
    return Obj(**base)


# --- which reminder should exist -------------------------------------------

def test_timed_task_gets_reminder_linked_to_it():
    g, u = goal(), user()
    r = build_reminder(g, u)
    assert r is not None
    assert r.goal_id == g.id and r.due_at == NOW and r.category == "reminder"


def test_reminder_never_carries_task_notes():
    r = build_reminder(goal(notes="I feel awful about this"), user())
    assert "awful" not in (r.body + r.title)


def test_untimed_task_has_no_reminder():
    assert build_reminder(goal(is_timed=False, scheduled_for=None), user()) is None


def test_completed_task_has_no_reminder():
    assert build_reminder(goal(completed=True), user()) is None


def test_telegram_alone_is_enough_to_want_reminders():
    assert reminders_wanted(user(in_app=False, chat_id=12345))
    assert not reminders_wanted(user(in_app=False, chat_id=None))


# --- update_goal keeps the pending reminder in step ------------------------

class RecordingQuery:
    def __init__(self, session, target):
        self.session, self.target = session, target

    def filter(self, *_a):
        return self

    def first(self):
        return self.session.goal

    def delete(self, **_kw):
        self.session.pending_deletes += 1
        return 1


class RecordingSession:
    def __init__(self, g):
        self.goal, self.added, self.pending_deletes = g, [], 0

    def query(self, model):
        return RecordingQuery(self, model)

    def add(self, item):
        self.added.append(item)

    def commit(self):
        pass

    def refresh(self, _item):
        pass


def _update(g, u, **changes):
    fields = dict(title=g.title, notes=g.notes, is_timed=g.is_timed,
                  scheduled_for=g.scheduled_for, priority=g.priority)
    fields.update(changes)
    db = RecordingSession(g)
    update_goal(g.id, GoalUpdate(**fields), u, db)
    return db


def _reminders(db):
    return [a for a in db.added if getattr(a, "category", None) == "reminder"]


def test_reschedule_replaces_pending_reminder():
    g, u = goal(), user()
    later = NOW + timedelta(hours=2)
    db = _update(g, u, scheduled_for=later)
    assert db.pending_deletes == 1
    assert [r.due_at for r in _reminders(db)] == [later]


def test_completing_task_removes_pending_reminder_and_adds_none():
    g, u = goal(), user()
    db = _update(g, u, completed=True)
    assert db.pending_deletes == 1
    assert _reminders(db) == []


def test_untiming_task_removes_pending_reminder():
    g, u = goal(), user()
    db = _update(g, u, is_timed=False, scheduled_for=None)
    assert db.pending_deletes == 1
    assert _reminders(db) == []


def test_unrelated_edit_leaves_reminder_alone():
    g, u = goal(), user()
    db = _update(g, u, priority="high")
    assert db.pending_deletes == 0
    assert _reminders(db) == []
