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

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models.user import User
from app.schemas.auth import (
    LoginIn,
    MessageOut,
    PasswordResetConfirmIn,
    PasswordResetRequestIn,
    SignupIn,
    TokenOut,
)
from app.security import (
    burn_password_verify,
    create_access_token,
    hash_password,
    verify_password,
)
from app.services.password_reset import (
    RESET_REQUEST_MESSAGE,
    prepare_password_reset_email,
    reset_password,
    send_email,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def signup(data: SignupIn, response: Response, db: Session = Depends(get_db)) -> TokenOut:
    if not settings.PASSWORD_SIGNUP_ENABLED:
        raise HTTPException(
            status_code=403,
            detail="New accounts sign up with Google or Microsoft.",
        )
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(
        email=data.email,
        name=data.name,
        hashed_password=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(str(user.id), user.token_version)
    set_access_cookie(response, token)
    return TokenOut(access_token=token)


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, response: Response, db: Session = Depends(get_db)) -> TokenOut:
    user = db.query(User).filter(User.email == data.email).first()
    if user is None or user.hashed_password is None:
        # Spend the bcrypt time anyway so a missing account (or one that only
        # signs in with Google/Microsoft) is not detectable from latency.
        burn_password_verify()
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(str(user.id), user.token_version)
    set_access_cookie(response, token)
    return TokenOut(access_token=token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(
        key=settings.ACCESS_COOKIE_NAME,
        path="/",
        secure=settings.ACCESS_COOKIE_SECURE,
        httponly=True,
        samesite="strict",
    )


@router.post("/password-reset/request", response_model=MessageOut)
def request_password_reset(
    data: PasswordResetRequestIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> MessageOut:
    outgoing = prepare_password_reset_email(db, str(data.email))
    # Sent after the response: SMTP can take seconds, and a slower answer
    # for known addresses would reveal which emails have accounts.
    if outgoing:
        background_tasks.add_task(send_email, outgoing)
    return MessageOut(message=RESET_REQUEST_MESSAGE)


@router.post("/password-reset/confirm", response_model=MessageOut)
def confirm_password_reset(
    data: PasswordResetConfirmIn,
    db: Session = Depends(get_db),
) -> MessageOut:
    if not reset_password(db, data.token, data.password):
        raise HTTPException(status_code=400, detail="Reset link is invalid or expired")
    return MessageOut(message="Password updated successfully")


def set_access_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.ACCESS_COOKIE_NAME,
        value=token,
        max_age=settings.JWT_EXPIRE_MINUTES * 60,
        path="/",
        secure=settings.ACCESS_COOKIE_SECURE,
        httponly=True,
        samesite="strict",
    )
