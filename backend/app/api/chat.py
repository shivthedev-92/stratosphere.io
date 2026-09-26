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

import json
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db import SessionLocal, get_db
from app.deps import get_current_user
from app.models.chat import ChatMessageRecord, ChatSession
from app.models.goal import Goal, GoalLog
from app.models.user import User
from app.schemas.chat import (
    ChatIn,
    ChatMessage,
    ChatOut,
    ChatSessionCreate,
    ChatSessionDetailOut,
    ChatSessionOut,
    SafetyNoticeOut,
)
from app.services.ai_coach import get_coach
from app.services.safety import (
    CRISIS_MESSAGE,
    build_crisis_notice,
    detect_crisis,
)

router = APIRouter(tags=["chat"])


@router.get("/chat/sessions", response_model=list[ChatSessionOut])
def list_chat_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ChatSession]:
    return (
        db.query(ChatSession)
        .filter(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
        .limit(50)
        .all()
    )


@router.post("/chat/sessions", response_model=ChatSessionOut)
def create_chat_session(
    data: ChatSessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatSession:
    if data.goal_id:
        get_owned_goal(data.goal_id, current_user, db)
    session = ChatSession(
        user_id=current_user.id,
        goal_id=data.goal_id,
        title=clean_session_title(data.title) if data.title else "New chat",
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/chat/sessions/{session_id}", response_model=ChatSessionDetailOut)
def get_chat_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatSessionDetailOut:
    session = get_owned_session(session_id, current_user, db)
    messages = (
        db.query(ChatMessageRecord)
        .filter(
            ChatMessageRecord.session_id == session.id,
            ChatMessageRecord.user_id == current_user.id,
        )
        .order_by(ChatMessageRecord.created_at.asc())
        .all()
    )
    return ChatSessionDetailOut.model_validate({**session.__dict__, "messages": messages})


@router.post("/chat", response_model=ChatOut)
async def chat(
    data: ChatIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatOut:
    session = get_or_create_session(data, current_user, db)
    history = _load_history(session.id, current_user, db, data)

    # Safety gate. This runs BEFORE the coach and, on a hit, the model is
    # never called - the user gets fixed human-authored copy instead of a
    # generated one. See app/services/safety.py for why.
    safety: SafetyNoticeOut | None = None
    if detect_crisis(data.message) is not None:
        reply = CRISIS_MESSAGE
        safety = build_crisis_notice()
    else:
        coach = get_coach()
        task_context = build_task_context(current_user, db, session.goal_id)
        reply = await coach.reply(history, data.message, task_context)

    db.add(
        ChatMessageRecord(
            session_id=session.id,
            user_id=current_user.id,
            role="user",
            content=data.message,
        )
    )
    db.add(
        ChatMessageRecord(
            session_id=session.id,
            user_id=current_user.id,
            role="assistant",
            content=reply,
        )
    )
    if session.title == "New chat":
        session.title = make_title(data.message)
    session.updated_at = datetime.now(timezone.utc)
    db.add(session)
    db.commit()
    return ChatOut(reply=reply, session_id=session.id, safety=safety)



def _load_history(
    session_id: UUID,
    current_user: User,
    db: Session,
    data: ChatIn,
) -> list[ChatMessage]:
    """Recent turns for this session, oldest first. Falls back to whatever the
    client sent when the session has no stored messages yet."""
    saved_messages = (
        db.query(ChatMessageRecord)
        .filter(
            ChatMessageRecord.session_id == session_id,
            ChatMessageRecord.user_id == current_user.id,
        )
        .order_by(ChatMessageRecord.created_at.desc())
        .limit(30)
        .all()
    )
    saved_messages.reverse()
    history = [
        ChatMessage(role=message.role, content=message.content) for message in saved_messages
    ]
    return history or data.history[-20:]


def get_or_create_session(data: ChatIn, current_user: User, db: Session) -> ChatSession:
    if data.session_id:
        session = get_owned_session(data.session_id, current_user, db)
        if data.goal_id and session.goal_id and session.goal_id != data.goal_id:
            raise HTTPException(
                status_code=400,
                detail="Chat session is already linked to a different task",
            )
        if data.goal_id and not session.goal_id:
            get_owned_goal(data.goal_id, current_user, db)
            session.goal_id = data.goal_id
            db.add(session)
            db.commit()
            db.refresh(session)
        return session

    if data.goal_id:
        goal = get_owned_goal(data.goal_id, current_user, db)
        title = f"{goal.emoji or 'Task'} {goal.title}"
    else:
        title = make_title(data.message)
    session = ChatSession(user_id=current_user.id, goal_id=data.goal_id, title=title)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_owned_session(session_id: UUID, current_user: User, db: Session) -> ChatSession:
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        .first()
    )
    if session is None:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return session


def get_owned_goal(goal_id: UUID, current_user: User, db: Session) -> Goal:
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == current_user.id).first()
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal


def build_task_context(current_user: User, db: Session, focus_goal_id: UUID | None = None) -> str:
    goals = (
        db.query(Goal)
        .filter(Goal.user_id == current_user.id)
        .order_by(Goal.created_at.desc())
        .limit(25)
        .all()
    )
    logs = (
        db.query(GoalLog)
        .filter(GoalLog.user_id == current_user.id)
        .order_by(GoalLog.created_at.desc())
        .limit(50)
        .all()
    )
    latest_logs_by_goal_id: dict[str, GoalLog] = {}
    for log in logs:
        goal_id = str(log.goal_id)
        if goal_id not in latest_logs_by_goal_id:
            latest_logs_by_goal_id[goal_id] = log

    today = datetime.now(timezone.utc).date().isoformat()
    lines = [
        "Task context from the user's productivity app.",
        f"User name: {current_user.name}",
        f"Today: {today}",
        "Use this context only to relate advice to the user's own tasks and reflections.",
        "Do not invent tasks, deadlines, emotions, or completions that are not listed here.",
    ]
    if focus_goal_id:
        focus_goal = next((goal for goal in goals if goal.id == focus_goal_id), None)
        if focus_goal:
            lines.append(f"Focused task for this chat: {focus_goal.title}")

    if not goals:
        lines.append("Current tasks: none found.")
        return "\n".join(lines)

    lines.append("Current tasks:")
    for index, goal in enumerate(goals, start=1):
        latest_log = latest_logs_by_goal_id.get(str(goal.id))
        scheduled_for = goal.scheduled_for.isoformat() if goal.scheduled_for else "unscheduled"
        emoji = f"{goal.emoji} " if goal.emoji else ""
        status = "no reflection yet"
        if latest_log:
            status = "task completed" if goal.completed else "task open"
        lines.append(
            f"{index}. {emoji}{goal.title} | priority={goal.priority} | "
            f"scheduled_for={scheduled_for} | latest_status={status}"
        )
        if goal.notes:
            lines.append(f"   Notes: {truncate_text(goal.notes, 180)}")
        if latest_log:
            emotion = latest_log.emotion_label or "not set"
            reflection = truncate_text(latest_log.reflection, 220)
            lines.append(f"   Latest reflection: emotion={emotion}; {reflection}")

    recent_reflections = logs[:8]
    if recent_reflections:
        lines.append("Recent reflection pattern:")
        for log in recent_reflections:
            created_at = log.created_at.isoformat() if log.created_at else "unknown date"
            emotion = log.emotion_label or "not set"
            lines.append(
                f"- {created_at}: emotion={emotion}, "
                f"reflection={truncate_text(log.reflection, 160)}"
            )

    return "\n".join(lines)


def truncate_text(value: str, limit: int) -> str:
    normalized = " ".join(value.split())
    if len(normalized) <= limit:
        return normalized
    return f"{normalized[: limit - 3]}..."


def clean_session_title(value: str) -> str:
    title = " ".join(value.split())
    return title[:200] or "New chat"


def make_title(message: str) -> str:
    title = clean_session_title(message)
    if len(title) <= 48:
        return title
    return f"{title[:45]}..."


def _sse(event: str, payload: dict) -> str:
    """One Server-Sent Event frame."""
    return f"event: {event}\ndata: {json.dumps(payload)}\n\n"


def _persist_turn(session_id: UUID, user_id: UUID, user_message: str, reply: str) -> None:
    """Write the finished turn using a FRESH session.

    The request-scoped session from Depends(get_db) is already closed by the
    time the StreamingResponse body runs, so it cannot be used here.
    """
    db = SessionLocal()
    try:
        db.add(
            ChatMessageRecord(
                session_id=session_id, user_id=user_id, role="user", content=user_message
            )
        )
        db.add(
            ChatMessageRecord(
                session_id=session_id, user_id=user_id, role="assistant", content=reply
            )
        )
        chat_session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
        if chat_session is not None:
            if chat_session.title == "New chat":
                chat_session.title = make_title(user_message)
            chat_session.updated_at = datetime.now(timezone.utc)
            db.add(chat_session)
        db.commit()
    finally:
        db.close()


@router.post("/chat/stream")
async def chat_stream(
    data: ChatIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Token-by-token coach reply over SSE.

    POST /chat (non-streaming) is kept for the mobile client, which expects a
    single JSON body. Both share the same provider and the same safety gate.
    """
    session = get_or_create_session(data, current_user, db)
    session_id = session.id
    user_id = current_user.id

    # Everything the generator needs is read here, while the request-scoped
    # session is still open.
    history = _load_history(session_id, current_user, db, data)
    crisis = detect_crisis(data.message) is not None
    task_context = None if crisis else build_task_context(current_user, db, session.goal_id)

    async def event_stream() -> AsyncIterator[str]:
        # Safety gate, same rule as the blocking endpoint: on a hit the coach
        # is never constructed and nothing is generated.
        if crisis:
            yield _sse("safety", build_crisis_notice().model_dump())
            yield _sse("token", {"text": CRISIS_MESSAGE})
            _persist_turn(session_id, user_id, data.message, CRISIS_MESSAGE)
            yield _sse("done", {"session_id": str(session_id)})
            return

        collected: list[str] = []
        try:
            coach = get_coach()
            async for chunk in coach.stream_reply(history, data.message, task_context):
                collected.append(chunk)
                yield _sse("token", {"text": chunk})
        except HTTPException as exc:
            yield _sse("error", {"detail": exc.detail})
        except Exception:
            yield _sse("error", {"detail": "The AI coach is unavailable right now."})
        finally:
            # Persist whatever was produced, even on a disconnect or error, so
            # a partial reply is not silently lost from the transcript.
            reply = "".join(collected)
            if reply:
                _persist_turn(session_id, user_id, data.message, reply)

        yield _sse("done", {"session_id": str(session_id)})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
