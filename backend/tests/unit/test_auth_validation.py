import pytest
from pydantic import ValidationError

from app.schemas.auth import AvatarUpdate, PasswordResetConfirmIn, SignupIn, UserUpdate


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


def test_avatar_accepts_known_ids_and_null():
    assert AvatarUpdate(avatar_id="sky-comet").avatar_id == "sky-comet"
    assert AvatarUpdate(avatar_id=None).avatar_id is None


@pytest.mark.parametrize("avatar_id", ["", "sky-nope", "../aster/aster-happy", "CREW-TEAL"])
def test_avatar_rejects_unknown_ids(avatar_id: str):
    with pytest.raises(ValidationError):
        AvatarUpdate(avatar_id=avatar_id)


def test_avatar_ids_match_frontend_files():
    from pathlib import Path

    from app.avatars import AVATAR_IDS

    avatars = Path(__file__).resolve().parents[3] / "frontend" / "public" / "avatars"
    if not avatars.is_dir():
        pytest.skip("frontend checkout not present")
    assert {p.stem for p in avatars.glob("*.svg")} == AVATAR_IDS
