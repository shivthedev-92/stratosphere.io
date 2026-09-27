"""Telegram reminders: linking, bot replies, client errors, and dispatch."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import httpx
import pytest

from app.services import telegram as tg
from app.services.telegram import (
    LINK_INVALID_TEXT,
    LINKED_TEXT,
    REMINDERS_ONLY_TEXT,
    START_WITHOUT_TOKEN_TEXT,
    ClaimedReminder,
    TelegramBlocked,
    TelegramChatMissing,
    TelegramClient,
    TelegramError,
    TelegramRejected,
    crisis_text,
    format_reminder,
    reply_for_text,
)

NOW = datetime(2026, 9, 26, 9, 0, tzinfo=timezone.utc)
TOKEN = "123456:SECRET-BOT-TOKEN"


# --- fakes -------------------------------------------------------------------


class FakeUser:
    def __init__(self):
        self.id = uuid4()
        self.telegram_chat_id = None
        self.telegram_linked_at = None
        self.telegram_link_token_hash = None
        self.telegram_link_expires_at = None


class FakeQuery:
    """Resolves filter(User.telegram_link_token_hash == <hash>) against users."""

    def __init__(self, db):
        self.db, self.hash = db, None

    def filter(self, *exprs):
        for e in exprs:
            left = getattr(getattr(e, "left", None), "key", None)
            if left == "telegram_link_token_hash":
                self.hash = e.right.value
        return self

    def first(self):
        return next((u for u in self.db.users if u.telegram_link_token_hash == self.hash), None)

    def update(self, values, **_kw):
        self.db.updates.append(values)
        return self.db.update_count


class FakeDB:
    def __init__(self, *users, update_count=0):
        self.users, self.updates, self.update_count, self.commits = list(users), [], update_count, 0

    def query(self, _model):
        return FakeQuery(self)

    def add(self, _obj):
        pass

    def commit(self):
        self.commits += 1


@pytest.fixture(autouse=True)
def bot_settings(monkeypatch):
    monkeypatch.setattr(tg.settings, "TELEGRAM_BOT_TOKEN", TOKEN)
    monkeypatch.setattr(tg.settings, "TELEGRAM_BOT_USERNAME", "StratosphereBot")


# --- linking -----------------------------------------------------------------


def test_link_url_carries_token_but_only_hash_is_stored():
    user, db = FakeUser(), FakeDB()
    url, expires = tg.create_link(db, user, NOW)
    token = url.split("start=")[1]
    assert url.startswith("https://t.me/StratosphereBot?start=")
    assert user.telegram_link_token_hash == tg._hash(token)
    assert token not in user.telegram_link_token_hash
    assert expires == NOW + timedelta(minutes=10)


def test_start_with_valid_token_links_chat_once():
    user = FakeUser()
    db = FakeDB(user)
    url, _ = tg.create_link(db, user, NOW)
    token = url.split("start=")[1]

    assert reply_for_text(db, 777, f"/start {token}", NOW) == LINKED_TEXT
    assert user.telegram_chat_id == 777
    assert user.telegram_link_token_hash is None
    # single use
    assert reply_for_text(db, 888, f"/start {token}", NOW) == LINK_INVALID_TEXT
    assert user.telegram_chat_id == 777


def test_expired_token_is_rejected():
    user = FakeUser()
    db = FakeDB(user)
    url, _ = tg.create_link(db, user, NOW)
    token = url.split("start=")[1]
    later = NOW + timedelta(minutes=11)
    assert reply_for_text(db, 777, f"/start {token}", later) == LINK_INVALID_TEXT
    assert user.telegram_chat_id is None


def test_unknown_token_is_rejected():
    db = FakeDB(FakeUser())
    assert reply_for_text(db, 777, "/start not-a-real-token", NOW) == LINK_INVALID_TEXT


def test_start_with_bot_suffix_and_without_token():
    db = FakeDB()
    assert reply_for_text(db, 1, "/start", NOW) == START_WITHOUT_TOKEN_TEXT
    assert reply_for_text(db, 1, "/start@StratosphereBot", NOW) == START_WITHOUT_TOKEN_TEXT


def test_stop_unlinks():
    assert reply_for_text(FakeDB(update_count=1), 1, "/stop", NOW) == tg.STOPPED_TEXT
    assert reply_for_text(FakeDB(update_count=0), 1, "/stop", NOW) == tg.NOT_LINKED_TEXT


# --- safety ------------------------------------------------------------------


def test_crisis_message_to_bot_gets_resources_not_boilerplate():
    reply = reply_for_text(FakeDB(), 1, "honestly I want to kill myself", NOW)
    assert reply == crisis_text()
    assert "14416" in reply and "112" in reply


def test_ordinary_text_gets_reminders_only_reply():
    assert reply_for_text(FakeDB(), 1, "this deadline is killing me", NOW) == REMINDERS_ONLY_TEXT


def test_reminder_text_is_title_only():
    assert format_reminder("Read 15 minutes") == "⏰ Time for: Read 15 minutes"


# --- client: token never leaks ----------------------------------------------


def _client(handler):
    return TelegramClient(
        httpx.AsyncClient(transport=httpx.MockTransport(handler)), TOKEN, "https://api.telegram.org"
    )


@pytest.mark.asyncio
async def test_network_error_message_hides_token():
    def boom(request):
        raise httpx.ConnectError("connection refused", request=request)

    with pytest.raises(TelegramError) as exc:
        await _client(boom).send_message(1, "hi")
    assert TOKEN not in str(exc.value)
    assert "SECRET" not in repr(exc.value)
    assert exc.value.__cause__ is None  # the httpx error (with URL) is not chained


@pytest.mark.asyncio
async def test_403_is_blocked():
    with pytest.raises(TelegramBlocked):
        await _client(lambda r: httpx.Response(403, json={"ok": False})).send_message(1, "hi")


@pytest.mark.asyncio
async def test_permanent_4xx_is_rejected_not_retryable():
    resp = {"ok": False, "description": "Bad Request: message text is empty"}
    with pytest.raises(TelegramRejected, match="message text is empty") as exc:
        await _client(lambda r: httpx.Response(400, json=resp)).send_message(1, "hi")
    # Says nothing about the chat, so it must not be treated as a dead link.
    assert not isinstance(exc.value, TelegramChatMissing)


@pytest.mark.asyncio
async def test_chat_not_found_is_a_missing_chat():
    resp = {"ok": False, "description": "Bad Request: chat not found"}
    with pytest.raises(TelegramChatMissing, match="chat not found") as exc:
        await _client(lambda r: httpx.Response(400, json=resp)).send_message(1, "hi")
    # Still a permanent rejection: never retried.
    assert isinstance(exc.value, TelegramRejected)


@pytest.mark.asyncio
async def test_rate_limit_is_retryable_not_rejected():
    resp = {"ok": False, "description": "Too Many Requests: retry after 3"}
    with pytest.raises(TelegramError) as exc:
        await _client(lambda r: httpx.Response(429, json=resp)).send_message(1, "hi")
    assert not isinstance(exc.value, TelegramRejected)


@pytest.mark.asyncio
async def test_not_ok_is_error():
    resp = {"ok": False, "description": "Too Many Requests: retry after 3"}
    with pytest.raises(TelegramError, match="Too Many Requests"):
        await _client(lambda r: httpx.Response(429, json=resp)).send_message(1, "hi")


# --- dispatch ----------------------------------------------------------------


class FakeClient:
    def __init__(self, fail=None):
        self.sent, self.fail = [], fail or {}

    async def send_message(self, chat_id, text):
        if chat_id in self.fail:
            raise self.fail[chat_id]
        self.sent.append((chat_id, text))


@pytest.mark.asyncio
async def test_dispatch_sends_unlinks_blocked_and_releases_failed(monkeypatch):
    ok, blocked, flaky, rejected, missing = (
        ClaimedReminder(uuid4(), c, f"task {c}") for c in (1, 2, 3, 4, 5)
    )
    monkeypatch.setattr(
        tg, "claim_due_reminders", lambda db, now=None: [ok, blocked, flaky, rejected, missing]
    )
    unlinked, released = [], []
    monkeypatch.setattr(tg, "unlink_chat", lambda db, chat_id: unlinked.append(chat_id))
    monkeypatch.setattr(tg, "release_claim", lambda db, nid: released.append(nid))
    monkeypatch.setattr(tg.asyncio, "sleep", _no_sleep)

    client = FakeClient(
        fail={
            2: TelegramBlocked("x"),
            3: TelegramError("x"),
            4: TelegramRejected("x"),
            5: TelegramChatMissing("x"),
        }
    )
    sent = await tg.dispatch_once(client, lambda: _Closable(), NOW)

    assert sent == 1
    assert client.sent == [(1, "⏰ Time for: task 1")]
    assert unlinked == [2, 5]  # blocked and missing chats; a plain rejection keeps its link
    assert released == [flaky.notification_id]  # rejected (4) keeps its claim


@pytest.mark.asyncio
async def test_group_chats_are_ignored(monkeypatch):
    client = FakeClient()
    called = []
    monkeypatch.setattr(tg, "reply_for_text", lambda *a: called.append(a) or "x")
    message = {"chat": {"id": -100, "type": "group"}, "text": "/start t"}
    update = {"update_id": 1, "message": message}
    await tg.handle_update(client, lambda: _Closable(), update)
    assert called == [] and client.sent == []


class _Closable:
    def close(self):
        pass


async def _no_sleep(_s):
    return None
