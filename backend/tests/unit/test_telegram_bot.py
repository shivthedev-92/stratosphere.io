"""The interactive Telegram bot: buttons, commands and short conversations."""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4
from zoneinfo import ZoneInfo

import pytest

from app.services import telegram_bot as bot
from app.services.telegram import crisis_text

IST = ZoneInfo("Asia/Kolkata")
NOW = datetime(2026, 10, 7, 5, 0, tzinfo=timezone.utc)  # 10:30 in India


def goal(title="Meditate", completed=False, scheduled_for=None, created_at=NOW):
    return SimpleNamespace(
        id=uuid4(),
        title=title,
        completed=completed,
        completed_at=None,
        is_timed=scheduled_for is not None,
        scheduled_for=scheduled_for,
        created_at=created_at,
    )


class FakeStore:
    """Stands in for bot.Store: same methods, in memory."""

    def __init__(self, goals=()):
        self.goals = {g.id: g for g in goals}
        self.reflections, self.snoozes, self.added = [], [], []
        self.messages = {}
        self.pending_state = None

    def goal(self, user, goal_id):
        return self.goals.get(goal_id)

    def open_goals(self, user, now):
        return [g for g in self.goals.values() if not g.completed]

    def goal_for_message(self, user, message_id):
        return self.messages.get(message_id)

    def add_goal(self, user, title, when):
        g = goal(title, scheduled_for=when)
        self.goals[g.id] = g
        self.added.append((title, when))
        return g

    def set_completed(self, user, g, completed, now):
        g.completed, g.completed_at = completed, now if completed else None

    def snooze(self, user, g, until):
        self.snoozes.append((g.id, until))

    def save_reflection(self, user, g, text):
        self.reflections.append((g.id, text))

    def pending(self, user, now):
        return self.pending_state

    def set_pending(self, user, action, text, now):
        self.pending_state = bot.Pending(action, text)

    def clear_pending(self, user):
        self.pending_state = None


USER = SimpleNamespace(id=uuid4(), timezone="Asia/Kolkata")


@pytest.fixture(autouse=True)
def public_app(monkeypatch):
    monkeypatch.setattr(bot.app_button.__globals__["settings"], "FRONTEND_URL", "https://s.in")


def say(store, text, reply_to=None):
    return bot.reply_to_message(store, USER, text, reply_to, NOW)


def press(store, data):
    return bot.handle_tap(store, USER, data, NOW)


# --- Buttons on reminders ----------------------------------------------------


def test_done_completes_the_task_and_swaps_the_buttons():
    g = goal()
    store = FakeStore([g])

    result = press(store, f"done:{g.id}")

    assert g.completed and g.completed_at == NOW
    assert result.toast.startswith("✅")
    assert [b["text"] for b in result.keyboard[0]] == ["📝 Reflect", "↩️ Reopen"]


def test_done_twice_does_not_redo_it():
    g = goal(completed=True)
    assert press(FakeStore([g]), f"done:{g.id}").toast == "Already done ✅"


def test_reopen_undoes_done():
    g = goal(completed=True)
    result = press(FakeStore([g]), f"undo:{g.id}")
    assert not g.completed and result.toast == "↩️ Reopened"


def test_snooze_reminds_again_in_an_hour():
    g = goal()
    store = FakeStore([g])

    result = press(store, f"snz:{g.id}")

    assert store.snoozes == [(g.id, NOW + timedelta(hours=1))]
    assert result.toast == "⏰ I'll remind you today at 11:30 AM"  # local time, IST
    assert [b["text"] for b in result.keyboard[0]] == ["✅ Done", "📝 Reflect"]


def test_snoozing_a_finished_task_does_nothing():
    g = goal(completed=True)
    store = FakeStore([g])
    assert press(store, f"snz:{g.id}").toast == "Already done ✅" and store.snoozes == []


@pytest.mark.parametrize("data", ["done:not-a-uuid", f"done:{uuid4()}", "zap:x", "menu:zap"])
def test_unknown_or_foreign_buttons_are_expired(data):
    # A task id the account doesn't own looks exactly like a missing one.
    assert press(FakeStore([goal()]), data).toast == bot.EXPIRED_TOAST


# --- Reflections ---------------------------------------------------------------


def test_reflect_then_type_saves_a_reflection():
    g = goal()
    store = FakeStore([g])

    prompt = press(store, f"rfl:{g.id}").replies[0]
    replies = say(store, "Felt calmer after ten minutes.")

    assert prompt.force_reply and "Meditate" in prompt.text and "stays in this chat" in prompt.text
    assert store.reflections == [(g.id, "Felt calmer after ten minutes.")]
    assert replies[0].text.startswith("📝 Saved to your journal for <b>Meditate</b>")
    assert store.pending_state is None


def test_replying_to_a_reminder_saves_on_its_task():
    g = goal()
    store = FakeStore([g])
    store.messages[555] = g

    say(store, "Skipped it, too tired", reply_to=555)

    assert store.reflections == [(g.id, "Skipped it, too tired")]


def test_a_crisis_reflection_is_saved_and_answered_with_resources():
    g = goal()
    store = FakeStore([g])
    press(store, f"rfl:{g.id}")

    replies = say(store, "honestly I want to kill myself")

    assert store.reflections == [(g.id, "honestly I want to kill myself")]
    assert replies[-1].text == crisis_text()


def test_overlong_reflection_is_refused_and_still_pending():
    g = goal()
    store = FakeStore([g])
    press(store, f"rfl:{g.id}")

    replies = say(store, "x" * 2001)

    assert store.reflections == [] and "2000" in replies[0].text
    assert store.pending_state.action == f"reflect:{g.id}"


# --- Stray thoughts ------------------------------------------------------------


def test_a_stray_thought_asks_which_task_then_saves_there():
    g = goal("Write essay")
    store = FakeStore([g])

    question = say(store, "Maybe start with the conclusion")[0]
    saved = press(store, f"log:{g.id}")

    labels = [row[0]["text"] for row in question.keyboard]
    assert labels[0] == "📝 Write essay" and labels[-1] == "➕ Make it a new task"
    assert store.reflections == [(g.id, "Maybe start with the conclusion")]
    assert saved.clear_keyboard and saved.replies[0].text.startswith("📝 Saved")


def test_a_stray_thought_can_become_a_task_with_a_time():
    store = FakeStore()
    say(store, "Call mom tomorrow 6pm")

    result = press(store, "new")

    assert store.added == [("Call mom", datetime(2026, 10, 8, 18, 0, tzinfo=IST))]
    assert "tomorrow at 6:00 PM" in result.replies[0].text


def test_never_mind_drops_the_thought():
    store = FakeStore([goal()])
    say(store, "random musing")
    assert press(store, "drop").toast == "Okay, not saved." and store.pending_state is None


def test_a_crisis_message_gets_resources_not_a_task_prompt():
    store = FakeStore([goal()])
    replies = say(store, "I want to end my life")
    assert [r.text for r in replies] == [crisis_text()] and store.pending_state is None


def test_an_expired_thought_cannot_be_saved():
    g = goal()
    store = FakeStore([g])
    result = press(store, f"log:{g.id}")  # nothing pending
    assert "expired" in result.toast and store.reflections == []


# --- Commands ------------------------------------------------------------------


def test_add_with_a_time_creates_a_timed_task():
    store = FakeStore()
    replies = say(store, "/add Pay rent today 5pm")
    assert store.added == [("Pay rent", datetime(2026, 10, 7, 17, 0, tzinfo=IST))]
    assert "today at 5:00 PM" in replies[0].text and "remind you" in replies[0].text


def test_add_without_text_asks_then_uses_the_answer():
    store = FakeStore()
    question = say(store, "/add")[0]
    say(store, "Water plants")
    assert question.force_reply and store.added == [("Water plants", None)]


def test_today_lists_open_tasks_with_buttons():
    carried = goal("Old task", created_at=NOW - timedelta(days=3))
    timed = goal("Gym", scheduled_for=datetime(2026, 10, 7, 12, 30, tzinfo=timezone.utc))
    store = FakeStore([carried, timed, goal("Done one", completed=True)])

    reply = say(store, "/today")[0]

    assert "📋 <b>Today</b> · 2 open" in reply.text
    assert "1. Old task · open since Sun 4 Oct" in reply.text
    assert "2. Gym · ⏰ 6:00 PM" in reply.text
    assert reply.keyboard[0] == [
        {"text": "✅ 1. Old task", "callback_data": f"done:{carried.id}"},
        {"text": "📝", "callback_data": f"rfl:{carried.id}"},
    ]


def test_today_when_nothing_is_open():
    assert say(FakeStore(), "/today")[0].text.startswith("🎉 Nothing open")


def test_menu_and_help():
    menu = say(FakeStore(), "/menu")[0]
    assert menu.keyboard[0][0] == {"text": "📋 Today", "callback_data": "menu:today"}
    assert menu.keyboard[-1][0]["url"] == "https://s.in/dashboard"
    assert say(FakeStore(), "/help")[0].text == bot.HELP_TEXT
    assert say(FakeStore(), "/whatever")[0].text == bot.HELP_TEXT


def test_a_command_cancels_a_pending_reflection():
    g = goal()
    store = FakeStore([g])
    press(store, f"rfl:{g.id}")
    say(store, "/today")
    assert store.pending_state is None


def test_titles_are_escaped_everywhere():
    g = goal("<b>Fix</b> & ship")
    store = FakeStore([g])
    text = say(store, "/today")[0].text + press(store, f"rfl:{g.id}").replies[0].text
    assert "&lt;b&gt;Fix&lt;/b&gt; &amp; ship" in text and "<b>Fix</b>" not in text


# --- Store.pending ---------------------------------------------------------------


def test_pending_state_expires():
    user = SimpleNamespace(
        telegram_pending="add",
        telegram_pending_text=None,
        telegram_pending_expires_at=NOW + timedelta(minutes=1),
    )
    store = bot.Store(db=None)
    assert store.pending(user, NOW) == bot.Pending("add", None)
    assert store.pending(user, NOW + timedelta(minutes=2)) is None
