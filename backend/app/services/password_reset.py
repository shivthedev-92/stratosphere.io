import logging
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from hashlib import sha256
from secrets import token_urlsafe

from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User
from app.security import hash_password

logger = logging.getLogger(__name__)

RESET_TOKEN_BYTES = 32
RESET_TOKEN_TTL_MINUTES = 30
RESET_REQUEST_MESSAGE = (
    "If an account exists for this email, a password reset link will be sent shortly."
)


def hash_reset_token(token: str) -> str:
    return sha256(token.encode()).hexdigest()


def create_password_reset_request(db: Session, email: str) -> str | None:
    user = db.query(User).filter(User.email == email).first()
    # Accounts that sign in with Google/Microsoft have no password to reset;
    # issuing one here would add a password route into them.
    if user is None or user.hashed_password is None:
        return None

    token = token_urlsafe(RESET_TOKEN_BYTES)
    user.password_reset_token_hash = hash_reset_token(token)
    user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=RESET_TOKEN_TTL_MINUTES,
    )
    db.add(user)
    db.commit()
    return token


def send_password_reset_email(email: str, token: str) -> bool:
    if not settings.SMTP_HOST or not settings.SMTP_FROM_EMAIL:
        return False
    reset_url = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={token}"
    message = EmailMessage()
    message["Subject"] = "Reset your Stratosphere password"
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = email
    message.set_content(
        "Use the link below to reset your password. It expires in 30 minutes.\n\n"
        f"{reset_url}\n"
    )
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
            if settings.SMTP_USE_TLS:
                smtp.starttls()
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(message)
        return True
    except (OSError, smtplib.SMTPException):
        logger.exception("Password reset email delivery failed")
        return False


def reset_password(db: Session, token: str, password: str) -> bool:
    token_hash = hash_reset_token(token)
    user = db.query(User).filter(User.password_reset_token_hash == token_hash).first()
    if user is None or user.password_reset_expires_at is None:
        return False
    expires_at = user.password_reset_expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= datetime.now(timezone.utc):
        return False
    user.hashed_password = hash_password(password)
    # Invalidate every access token issued before this reset.
    user.token_version = (user.token_version or 0) + 1
    user.password_reset_token_hash = None
    user.password_reset_expires_at = None
    db.add(user)
    db.commit()
    return True
