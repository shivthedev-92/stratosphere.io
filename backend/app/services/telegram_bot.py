"""The interactive side of the Telegram bot.

Buttons on reminders (Done, +1 hour, Reflect), commands (/today, /add,
/menu, /help), and the short conversations behind them: after "Reflect",
or when replying to a reminder, the next message is saved as a reflection
on that task; a stray message asks which task it belongs to.

Only linked chats reach this module, and every task id that arrives in a
button is re-checked against the chat's account (Store.goal), so a
forwarded or replayed button can't touch anyone else's tasks.

Everything here is synchronous and talks to the database only through
Store, so the conversation logic is testable with a fake store.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from html import escape
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.models.goal import Goal, GoalLog
from app.models.notification import Notification
from app.models.user import User
from app.services.reminders import sync_goal_reminder
from app.services.safety import detect_crisis
from app.services.telegram import app_button, crisis_text
from app.services.when import split_title_and_time, zone_for

PENDING_TTL = timedelta(minutes=30)
SNOOZE = timedelta(hours=1)
MAX_REFLECTION = 2000
MAX_TITLE = 200
TODAY_LIMIT = 10
PICK_LIMIT = 5
BUTTON_TITLE = 28

Keyboard = list[list[dict]]


@dataclass(frozen=True)
class BotReply:
    """A message to send. Text is Telegram HTML; anything user-supplied is escaped."""

    text: str
    keyboard: Keyboard | None = None
    force_reply: bool = False
    placeholder: str | None = None


@dataclass(frozen=True)
class TapResult:
    """What to do after a button tap."""

    toast: str  # the small popup on the tapping user's screen
    keyboard: Keyboard | None = None  # new buttons for the tapped message
    clear_keyboard: bool = False  # or remove its buttons
    replies: tuple[BotReply, ...] = ()


@dataclass(frozen=True)
class Pending:
    action: str
    text: str | None


# ==========#
# Database |
# ==========#


class Store:
    """All database access the bot needs, scoped to one user at a time."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def user_for_chat(self, chat_id: int) -> User | None:
        return self.db.query(User).filter(User.telegram_chat_id == chat_id).first()

    def goal(self, user: User, goal_id: UUID) -> Goal | None:
        return self.db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user.id).first()

    def open_goals(self, user: User, now: datetime) -> list[Goal]:
        """Unfinished tasks for today, including ones carried over from earlier
        days: the same rule as the dashboard's Today view."""
        zone = zone_for(user.timezone)
        today = now.astimezone(zone).date()
        goals = (
            self.db.query(Goal)
            .filter(Goal.user_id == user.id, Goal.completed.is_(False))
            .order_by(Goal.created_at.asc())
            .all()
        )
        return [
            goal
            for goal in goals
            if (goal.scheduled_for or goal.created_at).astimezone(zone).date() <= today
        ]

    def goal_for_message(self, user: User, message_id: int) -> Goal | None:
        notification = (
            self.db.query(Notification)
            .filter(
                Notification.user_id == user.id,
                Notification.telegram_message_id == message_id,
                Notification.goal_id.is_not(None),
            )
            .first()
        )
        return self.goal(user, notification.goal_id) if notification else None

    def add_goal(self, user: User, title: str, when: datetime | None) -> Goal:
        goal = Goal(
            user_id=user.id,
            title=title,
            is_timed=when is not None,
            scheduled_for=when.astimezone(timezone.utc) if when else None,
            priority="medium",
        )
        self.db.add(goal)
        self.db.flush()  # the reminder references goal.id
        sync_goal_reminder(self.db, goal, user)
        self.db.commit()
        self.db.refresh(goal)
        return goal

    def set_completed(self, user: User, goal: Goal, completed: bool, now: datetime) -> None:
        # Same effect as the web app's Mark complete / Reopen.
        goal.completed = completed
        goal.completed_at = now if completed else None
        self.db.add(goal)
        sync_goal_reminder(self.db, goal, user)
        self.db.commit()

    def snooze(self, user: User, goal: Goal, until: datetime) -> None:
        self.db.add(
            Notification(
                user_id=user.id,
                goal_id=goal.id,
                title="Task reminder",
                body=goal.title,
                category="reminder",
                due_at=until,
            )
        )
        self.db.commit()

    def save_reflection(self, user: User, goal: Goal, text: str) -> None:
        self.db.add(
            GoalLog(
                user_id=user.id,
                goal_id=goal.id,
                completed=bool(goal.completed),
                reflection=text,
                soulful=None,
            )
        )
        self.db.commit()

    def pending(self, user: User, now: datetime) -> Pending | None:
        expires = user.telegram_pending_expires_at
        if not user.telegram_pending or expires is None or expires <= now:
            return None
        return Pending(user.telegram_pending, user.telegram_pending_text)

    def set_pending(self, user: User, action: str, text: str | None, now: datetime) -> None:
        user.telegram_pending = action
        user.telegram_pending_text = text
        user.telegram_pending_expires_at = now + PENDING_TTL
        self.db.add(user)
        self.db.commit()

    def clear_pending(self, user: User) -> None:
        if user.telegram_pending or user.telegram_pending_text:
            user.telegram_pending = None
            user.telegram_pending_text = None
            user.telegram_pending_expires_at = None
            self.db.add(user)
            self.db.commit()


# =========#
# Buttons |
# =========#


def tap(text: str, data: str) -> dict:
    return {"text": text, "callback_data": data}


def short(title: str) -> str:
    return title if len(title) <= BUTTON_TITLE else title[: BUTTON_TITLE - 1].rstrip() + "…"


def with_open_task(rows: Keyboard, goal: Goal) -> Keyboard:
    button = app_button("📝 Open task", f"/tasks/{goal.id}")
    return rows + [[button]] if button else rows


def reminder_keyboard(goal_id: UUID) -> Keyboard:
    return [
        [
            tap("✅ Done", f"done:{goal_id}"),
            tap("⏰ +1 hour", f"snz:{goal_id}"),
            tap("📝 Reflect", f"rfl:{goal_id}"),
        ]
    ]


def open_task_keyboard(goal_id: UUID) -> Keyboard:
    return [[tap("✅ Done", f"done:{goal_id}"), tap("📝 Reflect", f"rfl:{goal_id}")]]


def done_keyboard(goal_id: UUID) -> Keyboard:
    return [[tap("📝 Reflect", f"rfl:{goal_id}"), tap("↩️ Reopen", f"undo:{goal_id}")]]


MENU_KEYBOARD: Keyboard = [
    [tap("📋 Today", "menu:today"), tap("➕ Add a task", "menu:add")],
    [tap("📝 Journal a thought", "menu:journal")],
]


# =======#
# Copy  |
# =======#

HELP_TEXT = (
    "🤖 <b>Here's what I can do</b>\n\n"
    "📋 /today: your open tasks, with buttons to finish them\n"
    "➕ /add Call mom tomorrow 6pm: add a task (the time is optional)\n"
    "🌤️ /menu: quick actions\n"
    "🛑 /stop: disconnect this chat\n\n"
    "💭 Or just type a thought, and I'll ask which task it belongs to.\n"
    "↩️ Reply to a reminder to save a reflection on that task."
)
EXPIRED_TOAST = "That button has expired."
PRIVACY_NOTE = "<i>It's saved in Stratosphere, and stays in this chat too.</i>"


def fmt_when(when: datetime, zone: ZoneInfo, now: datetime) -> str:
    local, today = when.astimezone(zone), now.astimezone(zone).date()
    clock = local.strftime("%-I:%M %p")
    if local.date() == today:
        return f"today at {clock}"
    if local.date() == today + timedelta(days=1):
        return f"tomorrow at {clock}"
    return f"{local.strftime('%a %-d %b')} at {clock}"


# ==============#
# Conversation |
# ==============#


def reply_to_message(
    store: Store, user: User, text: str, reply_to_id: int | None, now: datetime
) -> list[BotReply]:
    """Replies for a message from a linked chat (not /start or /stop)."""
    text = text.strip()
    if text.startswith("/"):
        store.clear_pending(user)
        command, _, arg = text.partition(" ")
        command = command.split("@", 1)[0].lower()
        if command == "/today":
            return [today_reply(store, user, now)]
        if command == "/add":
            return (
                add_task(store, user, arg, now) if arg.strip() else [ask_for_task(store, user, now)]
            )
        if command == "/menu":
            return [menu_reply()]
        return [BotReply(HELP_TEXT)]  # /help and anything unrecognised

    pending = store.pending(user, now)
    goal = None
    if pending and pending.action.startswith("reflect:"):
        goal = _goal_from(store, user, pending.action.partition(":")[2])
    elif reply_to_id is not None:
        goal = store.goal_for_message(user, reply_to_id)
    if goal is not None:
        return save_reflection(store, user, goal, text)

    if pending and pending.action == "add":
        store.clear_pending(user)
        return add_task(store, user, text, now)

    if detect_crisis(text) is not None:
        store.clear_pending(user)
        return [BotReply(crisis_text())]

    # A stray thought: hold it and ask where it belongs.
    if len(text) > MAX_REFLECTION:
        return [BotReply(f"That's a long one. I can save up to {MAX_REFLECTION} characters.")]
    store.set_pending(user, "thought", text, now)
    return [where_to_save(store, user, now)]


def handle_tap(store: Store, user: User, data: str, now: datetime) -> TapResult:
    action, _, arg = data.partition(":")

    if action == "menu":
        store.clear_pending(user)
        if arg == "today":
            return TapResult("", replies=(today_reply(store, user, now),))
        if arg == "add":
            return TapResult("", replies=(ask_for_task(store, user, now),))
        if arg == "journal":
            return TapResult("", replies=(pick_task_for_journal(store, user, now),))
        return TapResult(EXPIRED_TOAST)

    if action in ("new", "drop"):
        pending = store.pending(user, now)
        store.clear_pending(user)
        if action == "drop":
            return TapResult("Okay, not saved.", clear_keyboard=True)
        if not pending or pending.action != "thought" or not pending.text:
            return TapResult("That message expired. Send it again?", clear_keyboard=True)
        return TapResult(
            "", clear_keyboard=True, replies=tuple(add_task(store, user, pending.text, now))
        )

    goal = _goal_from(store, user, arg)
    if goal is None:
        return TapResult(EXPIRED_TOAST, clear_keyboard=True)
    zone = zone_for(user.timezone)

    if action == "done":
        if goal.completed:
            return TapResult("Already done ✅", keyboard=done_keyboard(goal.id))
        store.set_completed(user, goal, True, now)
        return TapResult("✅ Marked complete. Nice work!", keyboard=done_keyboard(goal.id))
    if action == "undo":
        if goal.completed:
            store.set_completed(user, goal, False, now)
        return TapResult("↩️ Reopened", keyboard=open_task_keyboard(goal.id))
    if action == "snz":
        if goal.completed:
            return TapResult("Already done ✅", keyboard=done_keyboard(goal.id))
        until = now + SNOOZE
        store.snooze(user, goal, until)
        return TapResult(
            f"⏰ I'll remind you {fmt_when(until, zone, now)}", keyboard=open_task_keyboard(goal.id)
        )
    if action in ("rfl", "jrn"):
        store.set_pending(user, f"reflect:{goal.id}", None, now)
        return TapResult("", replies=(ask_for_reflection(goal),))
    if action == "log":
        pending = store.pending(user, now)
        store.clear_pending(user)
        if not pending or pending.action != "thought" or not pending.text:
            return TapResult("That message expired. Send it again?", clear_keyboard=True)
        return TapResult(
            "📝 Saved",
            clear_keyboard=True,
            replies=tuple(save_reflection(store, user, goal, pending.text)),
        )
    return TapResult(EXPIRED_TOAST)


def _goal_from(store: Store, user: User, raw_id: str) -> Goal | None:
    try:
        return store.goal(user, UUID(raw_id))
    except ValueError:
        return None


def save_reflection(store: Store, user: User, goal: Goal, text: str) -> list[BotReply]:
    if not text:
        return [BotReply("That looks empty. Type your reflection and I'll save it.")]
    if len(text) > MAX_REFLECTION:
        return [BotReply(f"That's a long one. I can save up to {MAX_REFLECTION} characters.")]
    store.save_reflection(user, goal, text)
    store.clear_pending(user)
    replies = [
        BotReply(
            f"📝 Saved to your journal for <b>{escape(goal.title)}</b>.",
            keyboard=with_open_task([], goal) or None,
        )
    ]
    # Saved first, always: safety resources are added, never instead of it.
    if detect_crisis(text) is not None:
        replies.append(BotReply(crisis_text()))
    return replies


def ask_for_reflection(goal: Goal) -> BotReply:
    return BotReply(
        f"📝 How did it go with <b>{escape(goal.title)}</b>?\n"
        "Type your reflection and I'll save it to your journal.\n\n" + PRIVACY_NOTE,
        force_reply=True,
        placeholder="What went well, what got in the way…",
    )


def ask_for_task(store: Store, user: User, now: datetime) -> BotReply:
    store.set_pending(user, "add", None, now)
    return BotReply(
        "➕ What's the task? Add a time at the end if you like, e.g. <i>Call mom tomorrow 6pm</i>.",
        force_reply=True,
        placeholder="Call mom tomorrow 6pm",
    )


def add_task(store: Store, user: User, text: str, now: datetime) -> list[BotReply]:
    zone = zone_for(user.timezone)
    parsed = split_title_and_time(text.strip(), now.astimezone(zone))
    if not parsed.title:
        return [BotReply("➕ What's the task? Try <i>/add Call mom tomorrow 6pm</i>.")]
    if len(parsed.title) > MAX_TITLE:
        return [BotReply(f"That title is a bit long. Keep it under {MAX_TITLE} characters.")]
    goal = store.add_goal(user, parsed.title, parsed.when)
    if parsed.when:
        detail = f"for {fmt_when(parsed.when, zone, now)} ⏰ I'll remind you then."
    else:
        detail = "to today."
    return [
        BotReply(
            f"➕ Added <b>{escape(goal.title)}</b> {detail}",
            keyboard=with_open_task(open_task_keyboard(goal.id), goal),
        )
    ]


def today_reply(store: Store, user: User, now: datetime) -> BotReply:
    goals = store.open_goals(user, now)
    if not goals:
        return BotReply("🎉 Nothing open for today. Add something with /add.")
    zone = zone_for(user.timezone)
    today = now.astimezone(zone).date()
    lines, rows = [], []
    for number, goal in enumerate(goals[:TODAY_LIMIT], start=1):
        note = ""
        if goal.is_timed and goal.scheduled_for:
            note = f" · ⏰ {goal.scheduled_for.astimezone(zone).strftime('%-I:%M %p')}"
        day = (goal.scheduled_for or goal.created_at).astimezone(zone).date()
        if day < today:
            note = f" · open since {day.strftime('%a %-d %b')}"
        lines.append(f"{number}. {escape(goal.title)}{note}")
        rows.append(
            [
                tap(f"✅ {number}. {short(goal.title)}", f"done:{goal.id}"),
                tap("📝", f"rfl:{goal.id}"),
            ]
        )
    more = f"\n…and {len(goals) - TODAY_LIMIT} more in the app." if len(goals) > TODAY_LIMIT else ""
    return BotReply(
        f"📋 <b>Today</b> · {len(goals)} open\n\n"
        + "\n".join(lines)
        + more
        + "\n\nTap ✅ to finish one, or 📝 to reflect.",
        keyboard=rows,
    )


def where_to_save(store: Store, user: User, now: datetime) -> BotReply:
    rows = [
        [tap(f"📝 {short(goal.title)}", f"log:{goal.id}")]
        for goal in store.open_goals(user, now)[:PICK_LIMIT]
    ]
    rows += [[tap("➕ Make it a new task", "new"), tap("✖️ Never mind", "drop")]]
    return BotReply("💭 Got it. Which task does this belong to?\n\n" + PRIVACY_NOTE, keyboard=rows)


def pick_task_for_journal(store: Store, user: User, now: datetime) -> BotReply:
    goals = store.open_goals(user, now)[:PICK_LIMIT]
    if not goals:
        return BotReply("📝 No open tasks to journal about. Add one with /add.")
    return BotReply(
        "📝 Which task is this about?",
        keyboard=[[tap(f"📝 {short(goal.title)}", f"jrn:{goal.id}")] for goal in goals],
    )


def menu_reply() -> BotReply:
    button = app_button("🚀 Open Stratosphere", "/dashboard")
    rows = MENU_KEYBOARD + ([[button]] if button else [])
    return BotReply("🌤️ <b>What would you like to do?</b>", keyboard=rows)
