import logging
import smtplib
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

from app.models.user import OAuthIdentity
from app.security import verify_password
from app.services import password_reset
from app.services.password_reset import (
    RESET_TOKEN_BYTES,
    OutgoingEmail,
    create_password_reset_request,
    hash_reset_token,
    oauth_sign_in_email,
    prepare_password_reset_email,
    reset_password,
    send_email,
)


class FakeQuery:
    def __init__(self, user):
        self.user = user

    def filter(self, *_args):
        return self

    def first(self):
        return self.user


class FakeSession:
    def __init__(self, user=None):
        self.user = user
        self.added = []
        self.committed = False

    def query(self, _model):
        return FakeQuery(self.user)

    def add(self, item):
        self.added.append(item)

    def commit(self):
        self.committed = True


class FakeUser:
    email = "user@example.com"
    password_reset_token_hash = None
    password_reset_expires_at = None
    hashed_password = "old-hash"
    token_version = 0


def test_hash_reset_token_is_deterministic_and_not_plaintext():
    token = "reset-token"

    hashed = hash_reset_token(token)

    assert hashed == hash_reset_token(token)
    assert hashed != token
    assert len(hashed) == 64


def test_create_password_reset_request_persists_token_for_existing_user():
    user = FakeUser()
    db = FakeSession(user)

    token = create_password_reset_request(db, user.email)

    assert token is not None
    assert len(token) >= RESET_TOKEN_BYTES
    assert user.password_reset_token_hash == hash_reset_token(token)
    assert user.password_reset_expires_at > datetime.now(timezone.utc)
    assert db.added == [user]
    assert db.committed is True


def test_create_password_reset_request_does_not_persist_for_unknown_user():
    db = FakeSession(None)

    token = create_password_reset_request(db, "missing@example.com")

    assert token is None
    assert db.added == []
    assert db.committed is False


def test_reset_password_consumes_valid_token():
    user = FakeUser()
    token = "valid-reset-token-with-enough-entropy"
    user.password_reset_token_hash = hash_reset_token(token)
    user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    db = FakeSession(user)

    assert reset_password(db, token, "new-secure-password") is True
    assert verify_password("new-secure-password", user.hashed_password)
    assert user.password_reset_token_hash is None
    assert user.password_reset_expires_at is None
    assert db.committed is True


def test_reset_password_bumps_token_version_to_revoke_existing_sessions():
    user = FakeUser()
    user.token_version = 3
    token = "valid-reset-token-with-enough-entropy"
    user.password_reset_token_hash = hash_reset_token(token)
    user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    db = FakeSession(user)

    assert reset_password(db, token, "new-secure-password") is True
    assert user.token_version == 4


def test_reset_password_rejects_expired_token():
    user = FakeUser()
    token = "expired-reset-token-with-enough-entropy"
    user.password_reset_token_hash = hash_reset_token(token)
    user.password_reset_expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db = FakeSession(user)

    assert reset_password(db, token, "new-secure-password") is False
    assert user.hashed_password == "old-hash"
    assert user.token_version == 0
    assert db.committed is False


# --- Which email goes out, and how it is delivered ---------------------------

class AccountSession(FakeSession):
    """Answers the user lookup, and the provider lookup for OAuth accounts."""

    def __init__(self, user=None, providers=()):
        super().__init__(user)
        self.providers = providers

    def query(self, model):
        if model is OAuthIdentity.provider:
            return SimpleNamespace(filter=lambda *_: [(p,) for p in self.providers])
        return super().query(model)


def oauth_user():
    return SimpleNamespace(
        id=uuid4(),
        email="oauth@example.com",
        hashed_password=None,
        password_reset_token_hash=None,
        password_reset_expires_at=None,
    )


def test_unknown_email_sends_nothing():
    assert prepare_password_reset_email(AccountSession(None), "missing@example.com") is None


def test_password_account_gets_a_reset_link(monkeypatch):
    monkeypatch.setattr(password_reset.settings, "FRONTEND_URL", "https://stratosphereio.in/")
    user = FakeUser()
    db = AccountSession(user)

    outgoing = prepare_password_reset_email(db, user.email)

    assert outgoing.to == user.email
    assert outgoing.subject == "Reset your Stratosphere password"
    assert "https://stratosphereio.in/reset-password?token=" in outgoing.text
    assert "https://stratosphereio.in/reset-password?token=" in outgoing.html
    assert user.password_reset_token_hash is not None and db.committed


def test_google_account_gets_a_reminder_and_no_reset_token():
    user = oauth_user()
    db = AccountSession(user, providers=["microsoft", "google"])

    outgoing = prepare_password_reset_email(db, user.email)

    assert outgoing.subject == "How you sign in to Stratosphere"
    assert "Google or Microsoft" in outgoing.text
    assert "reset-password" not in outgoing.text
    # No token: a reset must never add a password route into an OAuth account.
    assert user.password_reset_token_hash is None and not db.committed


def test_account_with_neither_password_nor_provider_sends_nothing():
    assert prepare_password_reset_email(AccountSession(oauth_user()), "oauth@example.com") is None


def test_html_escapes_what_it_interpolates():
    html = oauth_sign_in_email("a@example.com", ["<img src=x>"]).html
    assert "<Img" not in html and "&lt;Img Src=X&gt;" in html


EMAIL = OutgoingEmail(to="person@example.com", subject="Subject", text="plain", html="<p>html</p>")


def configure_smtp(monkeypatch, **overrides):
    values = {
        "SMTP_HOST": "smtp.example.com",
        "SMTP_PORT": 587,
        "SMTP_FROM_EMAIL": "Stratosphere <no-reply@example.com>",
        "SMTP_USERNAME": "user",
        "SMTP_PASSWORD": "secret",
        "SMTP_USE_TLS": True,
    } | overrides
    for key, value in values.items():
        monkeypatch.setattr(password_reset.settings, key, value)


def test_unconfigured_smtp_warns_instead_of_failing_silently(monkeypatch, caplog):
    configure_smtp(monkeypatch, SMTP_HOST=None)
    with caplog.at_level(logging.WARNING):
        assert send_email(EMAIL) is False
    assert "SMTP is not configured" in caplog.text
    assert "person@example.com" not in caplog.text


def test_sends_text_and_html_over_tls(monkeypatch):
    configure_smtp(monkeypatch)
    sent = []

    class FakeSMTP:
        def __init__(self, host, port, timeout):
            sent.append(("connect", host, port))

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def starttls(self):
            sent.append(("starttls",))

        def login(self, user, password):
            sent.append(("login", user))

        def send_message(self, message):
            sent.append(("send", message))

    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)

    assert send_email(EMAIL) is True
    assert [step[0] for step in sent] == ["connect", "starttls", "login", "send"]
    message = sent[-1][1]
    assert message["To"] == "person@example.com"
    assert [part.get_content_type() for part in message.iter_parts()] == [
        "text/plain",
        "text/html",
    ]


def test_delivery_failure_is_logged_without_the_address(monkeypatch, caplog):
    configure_smtp(monkeypatch)

    def refuse(*_args, **_kwargs):
        raise smtplib.SMTPConnectError(421, "try later")

    monkeypatch.setattr(smtplib, "SMTP", refuse)
    with caplog.at_level(logging.ERROR):
        assert send_email(EMAIL) is False
    assert "Email delivery failed" in caplog.text
    assert "person@example.com" not in caplog.text
