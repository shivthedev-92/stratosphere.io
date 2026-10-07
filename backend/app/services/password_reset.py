import logging
import smtplib
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from hashlib import sha256
from html import escape
from secrets import token_urlsafe

from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import OAuthIdentity, User
from app.security import hash_password

logger = logging.getLogger(__name__)

RESET_TOKEN_BYTES = 32
RESET_TOKEN_TTL_MINUTES = 30
RESET_REQUEST_MESSAGE = (
    "If an account exists for this email, a password reset link will be sent shortly."
)


def hash_reset_token(token: str) -> str:
    return sha256(token.encode()).hexdigest()


def issue_reset_token(db: Session, user: User) -> str:
    token = token_urlsafe(RESET_TOKEN_BYTES)
    user.password_reset_token_hash = hash_reset_token(token)
    user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=RESET_TOKEN_TTL_MINUTES,
    )
    db.add(user)
    db.commit()
    return token


def create_password_reset_request(db: Session, email: str) -> str | None:
    user = db.query(User).filter(User.email == email).first()
    # Accounts that sign in with Google/Microsoft have no password to reset;
    # issuing one here would add a password route into them.
    if user is None or user.hashed_password is None:
        return None
    return issue_reset_token(db, user)


PROVIDER_NAMES = {"google": "Google", "microsoft": "Microsoft"}


@dataclass(frozen=True)
class OutgoingEmail:
    to: str
    subject: str
    text: str
    html: str


def _email_html(heading: str, paragraphs: list[str], button: tuple[str, str] | None) -> str:
    """A small, inline-styled layout that renders in Gmail, Outlook and Apple Mail."""
    body = "".join(
        f'<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3d3a4b;">{p}</p>'
        for p in paragraphs
    )
    if button:
        label, url = button
        body += (
            '<p style="margin:24px 0;">'
            f'<a href="{escape(url)}" style="display:inline-block;background:#5B4CF0;color:#ffffff;'
            "text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;"
            f'border-radius:10px;">{escape(label)}</a></p>'
            '<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#6b6880;">'
            "If the button doesn't work, paste this link into your browser:<br>"
            f'<a href="{escape(url)}" style="color:#5B4CF0;word-break:break-all;">'
            f"{escape(url)}</a></p>"
        )
    return (
        '<!doctype html><html><body style="margin:0;padding:24px;background:#F7F5F1;'
        "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">"
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
        '<td align="center"><table role="presentation" width="100%" cellpadding="0" '
        'cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;'
        'padding:32px;"><tr><td>'
        '<p style="margin:0 0 24px;font-size:14px;font-weight:700;letter-spacing:.04em;'
        'color:#5B4CF0;">STRATOSPHERE</p>'
        f'<h1 style="margin:0 0 16px;font-size:22px;color:#16151f;">{escape(heading)}</h1>'
        f"{body}"
        '<p style="margin:24px 0 0;font-size:12px;color:#8a879b;">'
        "Didn't ask for this? You can ignore this email; nothing about your account has changed."
        "</p></td></tr></table></td></tr></table></body></html>"
    )


def reset_link_email(email: str, token: str) -> OutgoingEmail:
    reset_url = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={token}"
    minutes = RESET_TOKEN_TTL_MINUTES
    return OutgoingEmail(
        to=email,
        subject="Reset your Stratosphere password",
        text=(
            f"Use the link below to reset your password. It expires in {minutes} minutes.\n\n"
            f"{reset_url}\n\n"
            "Didn't ask for this? You can ignore this email; your password hasn't changed.\n"
        ),
        html=_email_html(
            "Reset your password",
            [
                "Use the button below to choose a new password. "
                f"The link expires in {minutes} minutes and works once."
            ],
            ("Reset password", reset_url),
        ),
    )


def oauth_sign_in_email(email: str, providers: list[str]) -> OutgoingEmail:
    """For accounts with no password: say how they actually sign in."""
    names = " or ".join(PROVIDER_NAMES.get(p, p.title()) for p in providers)
    login_url = f"{settings.FRONTEND_URL.rstrip('/')}/login"
    return OutgoingEmail(
        to=email,
        subject="How you sign in to Stratosphere",
        text=(
            f"Someone asked to reset the password for this email. Your account doesn't use a "
            f"password: you sign in with {names}.\n\n"
            f"Choose \"Continue with {names}\" on the sign-in page:\n{login_url}\n"
        ),
        html=_email_html(
            "You sign in with " + names,
            [
                "Someone asked to reset the password for this email. Your Stratosphere "
                "account doesn't use a password, so there's nothing to reset.",
                f"On the sign-in page, choose <strong>Continue with {escape(names)}</strong>.",
            ],
            ("Go to sign in", login_url),
        ),
    )


def prepare_password_reset_email(db: Session, email: str) -> OutgoingEmail | None:
    """The email this request should send, or None when there is no account.

    Password accounts get a reset link. Google/Microsoft accounts have no
    password (and must not gain one this way), so they get a reminder of how
    they sign in. The API answer is the same either way.
    """
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        return None
    if user.hashed_password is not None:
        return reset_link_email(email, issue_reset_token(db, user))
    providers = sorted(
        {p for (p,) in db.query(OAuthIdentity.provider).filter(OAuthIdentity.user_id == user.id)}
    )
    return oauth_sign_in_email(email, providers) if providers else None


def send_email(outgoing: OutgoingEmail) -> bool:
    """Deliver over SMTP. Never raises: callers run it after the response is sent."""
    if not settings.SMTP_HOST or not settings.SMTP_FROM_EMAIL:
        # Loud, because the user was told an email is on its way.
        logger.warning("SMTP is not configured; %r was not sent", outgoing.subject)
        return False
    message = EmailMessage()
    message["Subject"] = outgoing.subject
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = outgoing.to
    message.set_content(outgoing.text)
    message.add_alternative(outgoing.html, subtype="html")
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
            if settings.SMTP_USE_TLS:
                smtp.starttls()
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(message)
        return True
    except (OSError, smtplib.SMTPException):
        # No address in the log: it is personal data and not needed to debug SMTP.
        logger.exception("Email delivery failed for %r", outgoing.subject)
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
