"""POST /me/telegram/test: the Settings "Send test message" button."""

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.api import me as me_api
from app.db import get_db
from app.deps import get_current_user
from app.main import app
from app.rate_limit import RateLimitMiddleware
from app.services import telegram as tg

TEST_ROUTE = ("POST", "/me/telegram/test")


@pytest.fixture
def setup(monkeypatch):
    user = SimpleNamespace(id="u1", telegram_chat_id=4242, name="Priya Sharma")
    sent, unlinked = [], []

    async def fake_send(chat_id, user_name=None):
        sent.append((chat_id, user_name))

    # The app is shared across tests; keep its rate limit out of these ones.
    monkeypatch.delitem(RateLimitMiddleware.LIMITS, TEST_ROUTE)
    monkeypatch.setattr(me_api, "telegram_configured", lambda: True)
    monkeypatch.setattr(me_api, "send_test_message", fake_send)
    monkeypatch.setattr(me_api, "unlink_user", lambda _db, u: unlinked.append(u.id))
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: object()
    yield SimpleNamespace(
        http=TestClient(app), user=user, sent=sent, unlinked=unlinked, monkeypatch=monkeypatch
    )
    app.dependency_overrides.clear()


def test_sends_to_the_linked_chat(setup):
    assert setup.http.post("/me/telegram/test").status_code == 204
    assert setup.sent == [(4242, "Priya Sharma")]


def test_needs_a_linked_chat(setup):
    setup.user.telegram_chat_id = None
    response = setup.http.post("/me/telegram/test")
    assert response.status_code == 409 and "Connect Telegram first" in response.json()["detail"]
    assert setup.sent == []


def test_needs_telegram_configured(setup):
    setup.monkeypatch.setattr(me_api, "telegram_configured", lambda: False)
    assert setup.http.post("/me/telegram/test").status_code == 503


def test_blocked_bot_unlinks_and_asks_to_reconnect(setup):
    async def blocked(_chat_id, _user_name=None):
        raise tg.TelegramBlocked("sendMessage: forbidden")

    setup.monkeypatch.setattr(me_api, "send_test_message", blocked)
    response = setup.http.post("/me/telegram/test")
    assert response.status_code == 409 and "Connect Telegram again" in response.json()["detail"]
    assert setup.unlinked == ["u1"]


def test_missing_chat_unlinks_too(setup):
    async def missing(_chat_id, _user_name=None):
        raise tg.TelegramChatMissing("sendMessage: Bad Request: chat not found")

    setup.monkeypatch.setattr(me_api, "send_test_message", missing)
    assert setup.http.post("/me/telegram/test").status_code == 409
    assert setup.unlinked == ["u1"]


def test_other_rejections_keep_the_link(setup):
    async def rejected(_chat_id, _user_name=None):
        raise tg.TelegramRejected("sendMessage: Bad Request: message is too long")

    setup.monkeypatch.setattr(me_api, "send_test_message", rejected)
    assert setup.http.post("/me/telegram/test").status_code == 502
    assert setup.unlinked == []


def test_temporary_failure_keeps_the_link(setup):
    async def down(_chat_id, _user_name=None):
        raise tg.TelegramError("sendMessage: network error")

    setup.monkeypatch.setattr(me_api, "send_test_message", down)
    response = setup.http.post("/me/telegram/test")
    assert response.status_code == 502
    assert setup.unlinked == []


def test_test_message_greets_by_first_name_only():
    # Same rule as reminders: first name at most, nothing from notes or reflections.
    text = tg.format_test_message("Priya Sharma")
    assert text.startswith("Hey Priya!") and "Sharma" not in text
    assert text.endswith("— Aster") and "{" not in text


def test_button_is_rate_limited():
    # Each press sends a real Telegram message.
    assert RateLimitMiddleware.LIMITS[TEST_ROUTE] == (3, 60)
