"""Coach spend controls: history size cap and per-user daily limit."""

from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.schemas.chat import ChatMessage
from app.services import coach_budget
from app.services.coach_budget import enforce_daily_limit, trim_history


def msg(role, n, ch="x"):
    return ChatMessage(role=role, content=ch * n)


# --- history size cap --------------------------------------------------------

def test_short_history_is_untouched():
    h = [msg("user", 10), msg("assistant", 10)]
    assert trim_history(h, 6000) == h


def test_keeps_most_recent_whole_messages_within_budget():
    h = [msg("user", 3000, "a"), msg("assistant", 3000, "b"),
         msg("user", 2000, "c"), msg("assistant", 2000, "d")]
    out = trim_history(h, 6000)
    assert [m.content[0] for m in out] == ["c", "d"]  # newest that fit, oldest dropped
    assert sum(len(m.content) for m in out) <= 6000


def test_never_starts_with_an_assistant_turn():
    # Budget would admit [assistant, user, assistant]; the API needs user first.
    h = [msg("user", 5000), msg("assistant", 1000, "a"),
         msg("user", 1000, "u"), msg("assistant", 1000, "b")]
    out = trim_history(h, 3000)
    assert out[0].role == "user"
    assert [m.content[0] for m in out] == ["u", "b"]


def test_client_supplied_worst_case_is_capped():
    # 30 x 8,000 characters is what a new session could otherwise send.
    h = [msg("user" if i % 2 == 0 else "assistant", 8000) for i in range(30)]
    assert sum(len(m.content) for m in trim_history(h, 6000)) <= 6000


def test_empty_history():
    assert trim_history([], 6000) == []


# --- daily limit -------------------------------------------------------------

@pytest.fixture
def count(monkeypatch):
    state = {"n": 0}
    monkeypatch.setattr(coach_budget, "coach_replies_in_window",
                        lambda db, user_id, now: state["n"])
    return state


def test_under_limit_passes(count, monkeypatch):
    monkeypatch.setattr(coach_budget.settings, "COACH_DAILY_MESSAGE_LIMIT", 50)
    count["n"] = 49
    enforce_daily_limit(None, uuid4())


def test_at_limit_is_a_friendly_429(count, monkeypatch):
    monkeypatch.setattr(coach_budget.settings, "COACH_DAILY_MESSAGE_LIMIT", 50)
    count["n"] = 50
    with pytest.raises(HTTPException) as exc:
        enforce_daily_limit(None, uuid4())
    assert exc.value.status_code == 429
    assert "50 coach messages" in exc.value.detail
    assert "tasks and reflections still work" in exc.value.detail


def test_zero_disables_the_limit(count, monkeypatch):
    monkeypatch.setattr(coach_budget.settings, "COACH_DAILY_MESSAGE_LIMIT", 0)
    count["n"] = 10_000
    enforce_daily_limit(None, uuid4())
