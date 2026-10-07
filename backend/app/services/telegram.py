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
"""Telegram reminders: account linking, bot replies, and the reminder sender.

Flow:
1. The web app calls create_link() and opens t.me/<bot>?start=<token>.
2. The user presses Start; Telegram delivers "/start <token>" to the bot.
3. The poller hands it to reply_for_text(), which links the chat to the
   account whose (hashed, 10-minute) token matches.
4. dispatch_forever() sends each due task reminder to linked chats.

Rules this module holds:
- The bot token is part of every Telegram URL. Network errors are converted
  to TelegramError with a fixed message so the token never reaches a log.
- Only private chats are answered; a group cannot be used to link.
- Reminder text names the task only. Notes and reflections never leave the
  app, since bot chats are not end-to-end encrypted.
- Anything a user types to the bot goes through the same crisis gate as the
  coach, so Telegram is not a channel without a safety floor.
- Delivery is at-most-once: a reminder is claimed with a conditional UPDATE
  before sending, so a restart or a second process cannot double-send.
"""

import asyncio
import hashlib
import logging
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from html import escape
from uuid import UUID

import httpx
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.config import settings
from app.models.goal import Goal
from app.models.notification import Notification
from app.models.user import User
from app.services.safety import (
    CRISIS_MESSAGE,
    EMERGENCY_NUMBER,
    INDIA_RESOURCES,
    detect_crisis,
)

logger = logging.getLogger(__name__)

LINK_TOKEN_TTL = timedelta(minutes=10)
# A reminder more than this late (e.g. the server was down) is dropped
# rather than delivered hours after the moment it was meant for.
REMINDER_STALE_AFTER = timedelta(minutes=30)
DISPATCH_INTERVAL_SECONDS = 30
POLL_TIMEOUT_SECONDS = 25
ERROR_BACKOFF_SECONDS = 5


def telegram_configured() -> bool:
    return bool(settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_BOT_USERNAME)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# ==================#
# Account linking  |
# ==================#


def create_link(db: Session, user: User, now: datetime | None = None) -> tuple[str, datetime]:
    """Issue a one-time deep link. Only the hash is stored."""
    now = now or _utcnow()
    token = secrets.token_urlsafe(24)  # [A-Za-z0-9_-], valid for a /start payload
    user.telegram_link_token_hash = _hash(token)
    user.telegram_link_expires_at = now + LINK_TOKEN_TTL
    db.add(user)
    db.commit()
    url = f"https://t.me/{settings.TELEGRAM_BOT_USERNAME}?start={token}"
    return url, user.telegram_link_expires_at


def link_chat(db: Session, token: str, chat_id: int, now: datetime | None = None) -> User | None:
    """Attach chat_id to the account owning `token`, if valid. Single use."""
    now = now or _utcnow()
    user = db.query(User).filter(User.telegram_link_token_hash == _hash(token)).first()
    expires_at = user.telegram_link_expires_at if user is not None else None
    if expires_at is None or expires_at < now:
        return None
    # One chat belongs to one account: detach it from any previous owner.
    db.query(User).filter(User.telegram_chat_id == chat_id, User.id != user.id).update(
        {User.telegram_chat_id: None, User.telegram_linked_at: None}, synchronize_session=False
    )
    user.telegram_chat_id = chat_id
    user.telegram_linked_at = now
    user.telegram_link_token_hash = None
    user.telegram_link_expires_at = None
    db.add(user)
    db.commit()
    return user


def unlink_chat(db: Session, chat_id: int) -> bool:
    count = (
        db.query(User)
        .filter(User.telegram_chat_id == chat_id)
        .update(
            {User.telegram_chat_id: None, User.telegram_linked_at: None},
            synchronize_session=False,
        )
    )
    db.commit()
    return bool(count)


def unlink_user(db: Session, user: User) -> None:
    user.telegram_chat_id = None
    user.telegram_linked_at = None
    user.telegram_link_token_hash = None
    user.telegram_link_expires_at = None
    db.add(user)
    db.commit()


# ===============#
# Bot messages  |
# ===============#

# Every bot message is sent with parse_mode=HTML, so fixed copy here must be
# valid Telegram HTML, and anything user-supplied (names, task titles) must
# go through escape(). An unescaped "<" makes Telegram reject the message.
LINKED_TEXT = (
    "🎉 <b>You're connected!</b>\n\n"
    "Your Stratosphere task reminders will land right here ⏰\n\n"
    "Send /stop any time to disconnect."
)
LINK_INVALID_TEXT = (
    "⌛ That link has expired or was already used.\n\n"
    "In Stratosphere, open <b>Settings</b> → <b>Connect Telegram</b> for a fresh one."
)
START_WITHOUT_TOKEN_TEXT = (
    "👋 Hi! To get reminders here, open Stratosphere → <b>Settings</b> → "
    "<b>Connect Telegram</b>."
)
TEST_MESSAGE_TEMPLATE = (
    "👋 Hey {name}! Aster here ✨\n\n"
    "Just testing the line 📡 Your task reminders will land right here, like this one.\n\n"
    "Nothing else to do. See you soon! 🌟\n\n"
    "— Aster ✨"
)
STOPPED_TEXT = (
    "👋 Disconnected. You won't get reminders here any more.\n\n"
    "You can reconnect any time from <b>Settings</b> in Stratosphere."
)
NOT_LINKED_TEXT = "🤔 This chat isn't connected to a Stratosphere account."
REMINDERS_ONLY_TEXT = (
    "💬 I only send reminders here. To talk things through, open Aster, your coach, "
    "in the Stratosphere app."
)


def crisis_text() -> str:
    """The fixed crisis copy with the verified lines. Deliberately no emoji."""
    lines = [escape(CRISIS_MESSAGE), ""]
    for resource in INDIA_RESOURCES:
        numbers = " / ".join(resource.numbers)
        lines.append(escape(f"{resource.name} ({resource.hours}): {numbers}"))
    lines += ["", escape(f"Emergency: {EMERGENCY_NUMBER}")]
    return "\n".join(lines)


# Reminders read like a note from Aster, the coach, not a system alert.
# Only the first name and the task title go into a message: never notes or
# reflections. The variant comes from the reminder's id, so a retried send
# repeats the same text.
REMINDER_TEMPLATES = (
    "⏰ Hey {name}!\n\nIt's time for <b>{task}</b>.\n\n"
    "One small step at a time. You've got this 💪\n\n— Aster ✨",
    "🔔 Quick nudge, {name}!\n\n<b>{task}</b> is up now.\n\n"
    "Breathe, begin, and see how it goes 🌱\n\n— Aster ✨",
    "🌤️ Hi {name}!\n\n<b>{task}</b> is on your plan for right now.\n\n"
    "Progress over perfection 🚀\n\n— Aster ✨",
)


def first_name(full_name: str | None) -> str:
    """First word of the account name, or "there" ("Hey there!")."""
    parts = (full_name or "").split()
    return parts[0][:40] if parts else "there"


def format_reminder(task_title: str, user_name: str | None = None, variant: int = 0) -> str:
    template = REMINDER_TEMPLATES[variant % len(REMINDER_TEMPLATES)]
    # Values are inserted, never re-parsed, so braces in a title are safe;
    # escaping keeps "<" or "&" in a title from breaking Telegram's HTML.
    return template.format(name=escape(first_name(user_name)), task=escape(task_title))


def app_button(label: str, path: str) -> dict | None:
    """A button that opens Stratosphere, or None when the app has no public
    https URL (Telegram rejects buttons pointing at localhost or http)."""
    base = settings.FRONTEND_URL.rstrip("/")
    if not base.startswith("https://"):
        return None
    return {"text": label, "url": f"{base}{path}"}


def reply_for_text(db: Session, chat_id: int, text: str, now: datetime | None = None) -> str:
    stripped = text.strip()
    # Safety first, for every message, before any command handling.
    if detect_crisis(stripped) is not None:
        return crisis_text()
    command, _, arg = stripped.partition(" ")
    command = command.split("@", 1)[0].lower()
    if command == "/start":
        if not arg.strip():
            return START_WITHOUT_TOKEN_TEXT
        return LINKED_TEXT if link_chat(db, arg.strip(), chat_id, now) else LINK_INVALID_TEXT
    if command == "/stop":
        return STOPPED_TEXT if unlink_chat(db, chat_id) else NOT_LINKED_TEXT
    return REMINDERS_ONLY_TEXT


# ===========#
# API client |
# ===========#


class TelegramError(Exception):
    """A failed call. The message never contains the request URL (token)."""


class TelegramBlocked(TelegramError):
    """The user blocked the bot or deleted the chat (HTTP 403)."""


class TelegramRejected(TelegramError):
    """A permanent rejection (4xx other than 403/429, e.g. "chat not found").
    Retrying the same request cannot succeed."""


class TelegramChatMissing(TelegramRejected):
    """The chat no longer exists ("chat not found"): the link is dead, the same
    as a blocked bot. Other rejections (a bad request, a bot misconfiguration)
    say nothing about the chat and must not unlink it."""


class TelegramClient:
    def __init__(self, http: httpx.AsyncClient, token: str, base: str) -> None:
        self._http = http
        self._url = f"{base.rstrip('/')}/bot{token}"

    async def _call(self, method: str, payload: dict, timeout: float = 15.0):
        try:
            response = await self._http.post(f"{self._url}/{method}", json=payload, timeout=timeout)
        except httpx.HTTPError:
            raise TelegramError(f"{method}: network error") from None
        if response.status_code == 403:
            raise TelegramBlocked(f"{method}: forbidden")
        try:
            data = response.json()
        except ValueError:
            raise TelegramError(f"{method}: HTTP {response.status_code}") from None
        if not data.get("ok"):
            description = str(data.get("description", "error"))
            detail = f"{method}: {description}"
            if 400 <= response.status_code < 500 and response.status_code != 429:
                if "chat not found" in description.lower():
                    raise TelegramChatMissing(detail)
                raise TelegramRejected(detail)
            raise TelegramError(detail)
        return data["result"]

    async def send_message(self, chat_id: int, text: str, button: dict | None = None) -> None:
        """Send Telegram HTML; `text` must already be escaped where needed."""
        payload: dict = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }
        if button:
            payload["reply_markup"] = {"inline_keyboard": [[button]]}
        await self._call("sendMessage", payload)

    async def get_updates(self, offset: int | None, timeout: int) -> list[dict]:
        payload: dict = {"timeout": timeout, "allowed_updates": ["message"]}
        if offset is not None:
            payload["offset"] = offset
        return await self._call("getUpdates", payload, timeout=timeout + 10)


def format_test_message(user_name: str | None) -> str:
    return TEST_MESSAGE_TEMPLATE.format(name=escape(first_name(user_name)))


async def send_test_message(chat_id: int, user_name: str | None = None) -> None:
    """One-off message for the "Send test message" button in Settings.

    Raises the same TelegramError subclasses as reminder delivery, so the
    caller can tell a blocked bot from a temporary failure.
    """
    async with httpx.AsyncClient() as http:
        client = TelegramClient(http, settings.TELEGRAM_BOT_TOKEN or "", settings.TELEGRAM_API_BASE)
        await client.send_message(
            chat_id,
            format_test_message(user_name),
            app_button("🚀 Open Stratosphere", "/dashboard"),
        )


# ==================#
# Reminder sender  |
# ==================#


@dataclass(frozen=True)
class ClaimedReminder:
    notification_id: UUID
    chat_id: int
    task_title: str
    user_name: str = ""
    goal_id: UUID | None = None


def claim_due_reminders(db: Session, now: datetime | None = None) -> list[ClaimedReminder]:
    """Select due reminders for linked users and claim each one atomically."""
    now = now or _utcnow()
    rows = (
        db.query(
            Notification.id,
            User.telegram_chat_id,
            Notification.body,
            User.name,
            Notification.goal_id,
        )
        .join(User, User.id == Notification.user_id)
        .join(Goal, Goal.id == Notification.goal_id)
        .filter(
            Notification.category == "reminder",
            Notification.due_at <= now,
            Notification.due_at > now - REMINDER_STALE_AFTER,
            Notification.telegram_sent_at.is_(None),
            Notification.acknowledged_at.is_(None),
            User.telegram_chat_id.is_not(None),
            Goal.completed.is_(False),
        )
        .order_by(Notification.due_at.asc())
        .limit(100)
        .all()
    )
    claimed: list[ClaimedReminder] = []
    for notification_id, chat_id, title, user_name, goal_id in rows:
        result = db.execute(
            update(Notification)
            .where(Notification.id == notification_id, Notification.telegram_sent_at.is_(None))
            .values(telegram_sent_at=now)
        )
        if result.rowcount == 1:
            claimed.append(
                ClaimedReminder(notification_id, chat_id, title, user_name or "", goal_id)
            )
    db.commit()
    return claimed


def release_claim(db: Session, notification_id: UUID) -> None:
    """Undo a claim after a retryable failure so the next tick tries again."""
    db.execute(
        update(Notification).where(Notification.id == notification_id).values(telegram_sent_at=None)
    )
    db.commit()


def _with_session(session_factory, fn, *args):
    db = session_factory()
    try:
        return fn(db, *args)
    finally:
        db.close()


async def dispatch_once(
    client: TelegramClient, session_factory, now: datetime | None = None
) -> int:
    claimed = await asyncio.to_thread(_with_session, session_factory, claim_due_reminders, now)
    sent = 0
    for reminder in claimed:
        try:
            text = format_reminder(
                reminder.task_title, reminder.user_name, reminder.notification_id.int
            )
            button = (
                app_button("📝 Open task", f"/tasks/{reminder.goal_id}")
                if reminder.goal_id
                else None
            )
            await client.send_message(reminder.chat_id, text, button)
            sent += 1
        except (TelegramBlocked, TelegramChatMissing):
            logger.info("telegram: chat blocked the bot or no longer exists; unlinking")
            await asyncio.to_thread(_with_session, session_factory, unlink_chat, reminder.chat_id)
        except TelegramRejected as exc:
            # Permanent: keep the claim so it is not resent every tick.
            logger.warning("telegram: reminder rejected, not retrying: %s", exc)
        except TelegramError as exc:
            logger.warning("telegram: send failed, will retry: %s", exc)
            await asyncio.to_thread(
                _with_session, session_factory, release_claim, reminder.notification_id
            )
        await asyncio.sleep(0.05)  # stay well under 30 msg/s
    return sent


async def dispatch_forever(client: TelegramClient, session_factory) -> None:
    while True:
        try:
            await dispatch_once(client, session_factory)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.warning("telegram: dispatch tick failed", exc_info=False)
        await asyncio.sleep(DISPATCH_INTERVAL_SECONDS)


async def handle_update(client: TelegramClient, session_factory, update_: dict) -> None:
    message = update_.get("message") or {}
    chat = message.get("chat") or {}
    text = message.get("text")
    if chat.get("type") != "private" or not isinstance(text, str):
        return
    reply = await asyncio.to_thread(
        _with_session, session_factory, reply_for_text, chat["id"], text
    )
    try:
        await client.send_message(chat["id"], reply)
    except TelegramError as exc:
        logger.warning("telegram: reply failed: %s", exc)


async def poll_forever(client: TelegramClient, session_factory) -> None:
    offset: int | None = None
    while True:
        try:
            updates = await client.get_updates(offset, POLL_TIMEOUT_SECONDS)
            for update_ in updates:
                offset = update_["update_id"] + 1
                await handle_update(client, session_factory, update_)
        except asyncio.CancelledError:
            raise
        except TelegramError as exc:
            logger.warning("telegram: polling failed: %s", exc)
            await asyncio.sleep(ERROR_BACKOFF_SECONDS)
        except Exception:
            logger.warning("telegram: polling tick failed", exc_info=False)
            await asyncio.sleep(ERROR_BACKOFF_SECONDS)


# ==========#
# Lifespan |
# ==========#


class TelegramWorkers:
    """Started from the FastAPI lifespan; stopped on shutdown."""

    def __init__(self) -> None:
        self._http: httpx.AsyncClient | None = None
        self._tasks: list[asyncio.Task] = []

    def start(self, session_factory) -> None:
        self._http = httpx.AsyncClient()
        client = TelegramClient(self._http, settings.TELEGRAM_BOT_TOKEN, settings.TELEGRAM_API_BASE)
        self._tasks = [
            asyncio.create_task(
                dispatch_forever(client, session_factory), name="telegram-dispatch"
            ),
            asyncio.create_task(poll_forever(client, session_factory), name="telegram-poll"),
        ]
        logger.info("telegram: reminder sender and bot poller started")

    async def stop(self) -> None:
        for task in self._tasks:
            task.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        if self._http is not None:
            await self._http.aclose()
