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

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.support import SupportTicket
from app.models.user import User
from app.schemas.auth import UserOut, UserUpdate

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
