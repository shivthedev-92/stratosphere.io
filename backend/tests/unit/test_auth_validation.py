import pytest
from pydantic import ValidationError

from app.schemas.auth import PasswordResetConfirmIn, SignupIn, UserUpdate


def test_signup_normalizes_identity_fields():
    data = SignupIn(email="USER@Example.COM", password="long-enough", name="  Taylor  ")

    assert data.email == "user@example.com"
    assert data.name == "Taylor"


@pytest.mark.parametrize("password", ["short", "😀" * 19])
def test_signup_rejects_passwords_bcrypt_cannot_safely_accept(password: str):
    with pytest.raises(ValidationError):
        SignupIn(email="user@example.com", password=password, name="Taylor")


def test_profile_rejects_blank_name():
    with pytest.raises(ValidationError):
        UserUpdate(name="   ", in_app_notifications_enabled=True)


def test_password_reset_requires_a_strong_password():
    with pytest.raises(ValidationError):
        PasswordResetConfirmIn(token="x" * 32, password="short")


def test_overlong_password_fails_login_cleanly():
    from app.security import hash_password, verify_password
    assert verify_password("x" * 100, hash_password("x" * 10)) is False
