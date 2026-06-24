from datetime import datetime, timedelta, timezone

from app.security import verify_password
from app.services.password_reset import (
    RESET_TOKEN_BYTES,
    create_password_reset_request,
    hash_reset_token,
    reset_password,
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


def test_reset_password_rejects_expired_token():
    user = FakeUser()
    token = "expired-reset-token-with-enough-entropy"
    user.password_reset_token_hash = hash_reset_token(token)
    user.password_reset_expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db = FakeSession(user)

    assert reset_password(db, token, "new-secure-password") is False
    assert user.hashed_password == "old-hash"
    assert db.committed is False
