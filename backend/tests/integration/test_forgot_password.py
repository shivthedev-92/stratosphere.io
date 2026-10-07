import pytest
from fastapi import BackgroundTasks
from pydantic import ValidationError

from app.api.auth import request_password_reset
from app.schemas.auth import PasswordResetRequestIn
from app.services.password_reset import RESET_REQUEST_MESSAGE, send_email


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
        self.committed = False

    def query(self, _model):
        return FakeQuery(self.user)

    def add(self, _item):
        pass

    def commit(self):
        self.committed = True


class FakeUser:
    email = "known@example.com"
    password_reset_token_hash = None
    password_reset_expires_at = None
    hashed_password = "existing-hash"


def test_password_reset_request_returns_generic_message_for_known_user():
    user = FakeUser()
    db = FakeSession(user)

    tasks = BackgroundTasks()

    response = request_password_reset(PasswordResetRequestIn(email=user.email), tasks, db)

    assert response.message == RESET_REQUEST_MESSAGE
    assert db.committed is True
    assert user.password_reset_token_hash is not None
    # The email goes out after the response, not while the caller waits.
    assert [task.func for task in tasks.tasks] == [send_email]


def test_password_reset_request_returns_same_message_for_unknown_user():
    db = FakeSession(None)

    tasks = BackgroundTasks()

    response = request_password_reset(
        PasswordResetRequestIn(email="missing@example.com"), tasks, db
    )

    assert response.message == RESET_REQUEST_MESSAGE
    assert db.committed is False
    assert tasks.tasks == []


def test_password_reset_request_requires_valid_email():
    with pytest.raises(ValidationError):
        PasswordResetRequestIn(email="not-an-email")
