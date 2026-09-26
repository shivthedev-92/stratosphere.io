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

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.support import SupportTicket
from app.models.user import User
from app.schemas.auth import (
    AvatarUpdate,
    TelegramLinkOut,
    TelegramStatusOut,
    UserOut,
    UserUpdate,
)
from app.services.telegram import (
    TelegramBlocked,
    TelegramError,
    create_link,
    send_test_message,
    telegram_configured,
    unlink_user,
)

router = APIRouter(tags=["users"])


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.patch("/me", response_model=UserOut)
def update_me(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    current_user.name = data.name.strip()
    current_user.phone_number = data.phone_number.strip() if data.phone_number else None
    current_user.date_of_birth = data.date_of_birth
    current_user.in_app_notifications_enabled = data.in_app_notifications_enabled
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.put("/me/avatar", response_model=UserOut)
def update_avatar(
    data: AvatarUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    # Separate from PATCH /me, which replaces every profile field: a profile
    # save from a client that doesn't know about avatars must not clear one.
    current_user.avatar_id = data.avatar_id
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    # Support tickets use SET NULL so remove them explicitly to erase submitted PII.
    db.query(SupportTicket).filter(SupportTicket.user_id == current_user.id).delete(
        synchronize_session=False
    )
    db.delete(current_user)
    db.commit()


@router.get("/me/telegram", response_model=TelegramStatusOut)
def telegram_status(current_user: User = Depends(get_current_user)) -> TelegramStatusOut:
    return TelegramStatusOut(
        available=telegram_configured(),
        linked=current_user.telegram_linked,
        linked_at=current_user.telegram_linked_at,
    )


@router.post("/me/telegram/link", response_model=TelegramLinkOut)
def telegram_link(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TelegramLinkOut:
    if not telegram_configured():
        raise HTTPException(status_code=503, detail="Telegram reminders are not set up.")
    url, expires_at = create_link(db, current_user)
    return TelegramLinkOut(url=url, expires_at=expires_at)


@router.delete("/me/telegram", status_code=status.HTTP_204_NO_CONTENT)
def telegram_unlink(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    unlink_user(db, current_user)


@router.post("/me/telegram/test", status_code=status.HTTP_204_NO_CONTENT)
async def telegram_test(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Send a test message to the linked chat, so users can see it works."""
    if not telegram_configured():
        raise HTTPException(status_code=503, detail="Telegram reminders are not set up.")
    if current_user.telegram_chat_id is None:
        raise HTTPException(status_code=409, detail="Connect Telegram first.")
    try:
        await send_test_message(current_user.telegram_chat_id)
    except TelegramBlocked:
        # The chat was deleted or the bot blocked: this link is dead.
        await run_in_threadpool(unlink_user, db, current_user)
        raise HTTPException(
            status_code=409,
            detail=(
                "Telegram says the bot was blocked or the chat was deleted. "
                "Connect Telegram again."
            ),
        ) from None
    except TelegramError:
        raise HTTPException(
            status_code=502,
            detail="Telegram didn't take the message. Please try again in a minute.",
        ) from None
