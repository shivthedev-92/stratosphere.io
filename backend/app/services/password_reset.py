from datetime import datetime, timedelta, timezone
from hashlib import sha256
from secrets import token_urlsafe

from sqlalchemy.orm import Session

from app.models.user import User

RESET_TOKEN_BYTES = 32
RESET_TOKEN_TTL_MINUTES = 30
RESET_REQUEST_MESSAGE = (
    "If an account exists for this email, a password reset link will be sent shortly."
)


def hash_reset_token(token: str) -> str:
    return sha256(token.encode()).hexdigest()


def create_password_reset_request(db: Session, email: str) -> str | None:
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        return None

    token = token_urlsafe(RESET_TOKEN_BYTES)
    user.password_reset_token_hash = hash_reset_token(token)
    user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=RESET_TOKEN_TTL_MINUTES,
    )
    db.add(user)
    db.commit()
    return token
