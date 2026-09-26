"""Sign-in with Google / Microsoft: token checks, state cookie, account linking, routes."""

import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app.config import settings
from app.models.user import OAuthIdentity, User
from app.services import oauth

KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(autouse=True)
def providers(monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "google-client")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "google-secret")
    monkeypatch.setattr(settings, "MICROSOFT_CLIENT_ID", "ms-client")
    monkeypatch.setattr(settings, "MICROSOFT_CLIENT_SECRET", "ms-secret")
    monkeypatch.setattr(settings, "OAUTH_ALLOWED_EMAIL_DOMAINS", "")
    # Tokens are signed with KEY; the provider's JWKS returns its public half.
    monkeypatch.setattr(
        oauth,
        "_jwks_client",
        lambda _url: SimpleNamespace(
            get_signing_key_from_jwt=lambda _t: SimpleNamespace(key=KEY.public_key())
        ),
    )


def id_token(provider: str, key=KEY, **overrides) -> str:
    now = datetime.now(timezone.utc)
    claims = {
        "iss": "https://accounts.google.com"
        if provider == "google"
        else f"https://login.microsoftonline.com/{oauth.MICROSOFT_CONSUMER_TENANT}/v2.0",
        "aud": "google-client" if provider == "google" else "ms-client",
        "sub": "subject-123",
        "iat": now,
        "exp": now + timedelta(minutes=5),
        "nonce": "the-nonce",
        "email": "Alex@Example.com",
        "name": "Alex",
    }
    if provider == "google":
        claims["email_verified"] = True
    else:
        claims["tid"] = oauth.MICROSOFT_CONSUMER_TENANT
    claims.update(overrides)
    claims = {k: v for k, v in claims.items() if v is not None}
    return jwt.encode(claims, key, algorithm="RS256")


def verify(provider: str, token: str, nonce: str = "the-nonce"):
    return oauth.verify_id_token(oauth.get_provider(provider), token, nonce)


# --- id_token verification -------------------------------------------------


@pytest.mark.parametrize("provider", ["google", "microsoft"])
def test_valid_token_gives_normalised_identity(provider):
    identity = verify(provider, id_token(provider))
    assert identity.provider == provider
    assert identity.subject == "subject-123"
    assert identity.email == "alex@example.com"
    assert identity.name == "Alex"


def test_google_legacy_issuer_accepted():
    assert verify("google", id_token("google", iss="accounts.google.com")).subject == "subject-123"


@pytest.mark.parametrize(
    ("provider", "overrides", "code"),
    [
        ("google", {"email_verified": False}, "email_unverified"),
        ("google", {"email_verified": None}, "email_unverified"),
        ("google", {"email": None}, "no_email"),
        # Work or school tenant: email is admin-controlled, never trusted.
        ("microsoft", {"tid": "11111111-2222-3333-4444-555555555555"}, "work_account"),
        ("microsoft", {"email": None}, "no_email"),
        ("google", {"aud": "someone-else"}, "oauth_failed"),
        ("google", {"iss": "https://evil.example"}, "oauth_failed"),
        ("microsoft", {"iss": "https://login.microsoftonline.com/other/v2.0"}, "oauth_failed"),
        ("google", {"exp": datetime.now(timezone.utc) - timedelta(hours=1)}, "oauth_failed"),
        ("google", {"nonce": "replayed"}, "oauth_failed"),
    ],
)
def test_untrusted_tokens_are_rejected(provider, overrides, code):
    with pytest.raises(oauth.OAuthError) as exc:
        verify(provider, id_token(provider, **overrides))
    assert exc.value.code == code


def test_token_signed_by_another_key_is_rejected():
    with pytest.raises(oauth.OAuthError) as exc:
        verify("google", id_token("google", key=OTHER_KEY))
    assert exc.value.code == "oauth_failed"


def test_email_domain_allowlist(monkeypatch):
    monkeypatch.setattr(settings, "OAUTH_ALLOWED_EMAIL_DOMAINS", "gmail.com, @Outlook.com")
    assert verify("google", id_token("google", email="a@gmail.com")).email == "a@gmail.com"
    assert (
        verify("microsoft", id_token("microsoft", email="b@outlook.com")).email == "b@outlook.com"
    )
    with pytest.raises(oauth.OAuthError) as exc:
        verify("google", id_token("google", email="a@example.com"))
    assert exc.value.code == "email_domain"


# --- flow state ------------------------------------------------------------


def test_begin_builds_pkce_request_and_signed_state():
    provider = oauth.get_provider("google")
    url, cookie = oauth.begin(provider)
    query = parse_qs(urlparse(url).query)
    assert query["client_id"] == ["google-client"]
    assert query["redirect_uri"] == [f"{settings.OAUTH_REDIRECT_BASE}/auth/oauth/google/callback"]
    assert query["code_challenge_method"] == ["S256"]
    assert query["scope"] == ["openid email profile"]
    state = oauth._read_state_cookie(provider, cookie, query["state"][0])
    assert oauth._pkce_challenge(state["v"]) == query["code_challenge"][0]
    assert state["n"] == query["nonce"][0]


def test_state_must_match_cookie_and_provider():
    google = oauth.get_provider("google")
    _url, cookie = oauth.begin(google)
    with pytest.raises(oauth.OAuthError):
        oauth._read_state_cookie(google, cookie, "forged-state")
    state = parse_qs(urlparse(_url).query)["state"][0]
    with pytest.raises(oauth.OAuthError):
        oauth._read_state_cookie(oauth.get_provider("microsoft"), cookie, state)
    with pytest.raises(oauth.OAuthError) as exc:
        oauth._read_state_cookie(google, None, state)
    assert exc.value.code == "oauth_expired"


def test_provider_off_without_credentials(monkeypatch):
    monkeypatch.setattr(settings, "MICROSOFT_CLIENT_SECRET", None)
    assert oauth.enabled_providers() == ["google"]
    assert oauth.get_provider("microsoft") is None
    assert oauth.get_provider("github") is None


# --- account resolution ----------------------------------------------------


class FakeQuery:
    def __init__(self, rows):
        self.rows = rows

    def filter(self, *criteria):
        rows = [
            row
            for row in self.rows
            if all(getattr(row, c.left.key) == c.right.value for c in criteria)
        ]
        return FakeQuery(rows)

    def first(self):
        return self.rows[0] if self.rows else None


class FakeDB:
    def __init__(self, users=(), identities=()):
        self.users = list(users)
        self.identities = list(identities)

    def query(self, model):
        return FakeQuery(self.users if model is User else self.identities)

    def get(self, model, key):
        return next((u for u in self.users if u.id == key), None)

    def add(self, row):
        if isinstance(row, User):
            row.id = row.id or uuid.uuid4()
            if row not in self.users:
                self.users.append(row)
        elif row not in self.identities:
            self.identities.append(row)

    def flush(self):
        pass

    def commit(self):
        pass

    def refresh(self, _row):
        pass


IDENTITY = oauth.VerifiedIdentity("google", "subject-123", "alex@example.com", "Alex")


def test_new_identity_creates_passwordless_user():
    db = FakeDB()
    user = oauth.resolve_user(db, IDENTITY)
    assert user.email == "alex@example.com"
    assert user.hashed_password is None
    assert [(i.provider, i.subject, i.user_id) for i in db.identities] == [
        ("google", "subject-123", user.id)
    ]


def test_existing_email_is_linked_not_duplicated():
    existing = User(id=uuid.uuid4(), email="alex@example.com", name="Alex", hashed_password="x")
    db = FakeDB(users=[existing])
    assert oauth.resolve_user(db, IDENTITY) is existing
    assert len(db.users) == 1
    assert db.identities[0].user_id == existing.id


def test_known_identity_signs_in_even_if_email_changed():
    user = User(id=uuid.uuid4(), email="old@example.com", name="Alex", hashed_password=None)
    link = OAuthIdentity(
        user_id=user.id, provider="google", subject="subject-123", email="old@example.com"
    )
    db = FakeDB(users=[user], identities=[link])
    assert oauth.resolve_user(db, IDENTITY) is user
    assert link.email == "alex@example.com"
    assert len(db.identities) == 1


# --- routes ----------------------------------------------------------------


@pytest.fixture
def client(monkeypatch):
    from app.db import get_db
    from app.main import app

    db = FakeDB()
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app, base_url="http://localhost:8000"), db
    app.dependency_overrides.clear()


def test_config_lists_providers_and_closes_password_signup(client, monkeypatch):
    monkeypatch.setattr(settings, "PASSWORD_SIGNUP_ENABLED", False)
    http, _db = client
    assert http.get("/auth/config").json() == {
        "providers": ["google", "microsoft"],
        "password_signup": False,
    }
    response = http.post(
        "/auth/signup", json={"email": "a@b.co", "password": "long-enough", "name": "A"}
    )
    assert response.status_code == 403


def test_start_redirects_with_lax_state_cookie(client):
    http, _db = client
    response = http.get("/auth/oauth/microsoft/start", follow_redirects=False)
    assert response.status_code == 302
    assert response.headers["location"].startswith(
        "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?"
    )
    cookie = response.headers["set-cookie"]
    assert oauth.STATE_COOKIE_NAME in cookie and "SameSite=lax" in cookie and "HttpOnly" in cookie
    assert http.get("/auth/oauth/github/start", follow_redirects=False).status_code == 404


def test_callback_signs_in_and_hands_off_same_origin(client, monkeypatch):
    http, db = client
    monkeypatch.setattr(oauth, "finish", lambda *_a: IDENTITY)
    response = http.get("/auth/oauth/google/callback?code=c&state=s", follow_redirects=False)
    assert response.status_code == 200
    assert 'http-equiv="refresh"' in response.text and "/dashboard" in response.text
    cookies = response.headers.get_list("set-cookie")
    assert any(c.startswith(f"{settings.ACCESS_COOKIE_NAME}=") for c in cookies)
    assert db.users[0].email == "alex@example.com"


@pytest.mark.parametrize(
    ("query", "expected"),
    [("error=access_denied", "oauth_cancelled"), ("error=server_error", "oauth_failed")],
)
def test_callback_provider_errors_go_back_to_login(client, query, expected):
    http, _db = client
    response = http.get(f"/auth/oauth/google/callback?{query}", follow_redirects=False)
    assert response.status_code == 302
    assert response.headers["location"].endswith(f"/login?error={expected}")


def test_callback_rejected_identity_goes_back_to_login(client, monkeypatch):
    http, db = client

    def refuse(*_a):
        raise oauth.OAuthError("work_account")

    monkeypatch.setattr(oauth, "finish", refuse)
    response = http.get("/auth/oauth/microsoft/callback?code=c&state=s", follow_redirects=False)
    assert response.headers["location"].endswith("/login?error=work_account")
    assert db.users == []
