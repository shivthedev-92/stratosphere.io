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
"""Spend controls for the paid AI coach.

Two independent limits, because they stop different things:

- A per-user cap on coach replies in any rolling 24 hours stops *steady*
  spend: one account talking all day. It is counted from stored messages,
  so it survives restarts and does not reset when the user changes network
  (the per-IP rate limiter in app/rate_limit.py only stops bursts).
- A character budget on the history sent with each call caps the cost of
  any *single* call. Without it one request could carry ~240,000
  characters, since a new session uses the history the client supplies.

The crisis gate runs before either check: a user in crisis always gets the
helplines, however many messages they have sent.

Worst case per call, with these limits and the input caps elsewhere
(message <= 8,000 chars, task context bounded by build_task_context):
roughly 8,500 input + 1,024 output tokens, about $0.014 on Claude Haiku
4.5. A typical call measured ~1,100 + ~120 tokens, about $0.0017.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.models.chat import ChatMessageRecord
from app.schemas.chat import ChatMessage
from app.services.safety import CRISIS_MESSAGE

WINDOW = timedelta(hours=24)


def trim_history(history: list[ChatMessage], max_chars: int) -> list[ChatMessage]:
    """Keep the most recent whole messages that fit in max_chars.

    The result never starts with an assistant turn: the Anthropic API
    expects a conversation to open with the user, and a trimmed history
    that began mid-exchange would be rejected.
    """
    kept: list[ChatMessage] = []
    used = 0
    for message in reversed(history):
        size = len(message.content)
        if used + size > max_chars:
            break
        kept.append(message)
        used += size
    kept.reverse()
    while kept and kept[0].role != "user":
        kept.pop(0)
    return kept


def coach_replies_in_window(db: Session, user_id: UUID, now: datetime) -> int:
    """Paid coach replies in the last 24 hours. Crisis responses are free
    (no model call) and are not counted."""
    return (
        db.query(ChatMessageRecord)
        .filter(
            ChatMessageRecord.user_id == user_id,
            ChatMessageRecord.role == "assistant",
            ChatMessageRecord.created_at > now - WINDOW,
            ChatMessageRecord.content != CRISIS_MESSAGE,
        )
        .count()
    )


def enforce_daily_limit(db: Session, user_id: UUID, now: datetime | None = None) -> None:
    limit = settings.COACH_DAILY_MESSAGE_LIMIT
    if limit <= 0:
        return
    now = now or datetime.now(timezone.utc)
    if coach_replies_in_window(db, user_id, now) >= limit:
        raise HTTPException(
            status_code=429,
            detail=(
                f"You've used your {limit} coach messages for today. More become "
                "available over the next 24 hours. Your tasks and reflections "
                "still work as usual."
            ),
        )
