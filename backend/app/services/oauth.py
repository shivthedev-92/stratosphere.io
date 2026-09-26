"""Sign-in with Google and Microsoft (OpenID Connect).

Authorization code flow with PKCE. The browser carries the flow's state,
nonce and PKCE verifier in a short-lived signed cookie, so nothing is stored
server-side between the redirect out and the callback.

Only identities whose email the provider vouches for are accepted:
- Google: the id_token's email_verified claim must be true.
- Microsoft: personal accounts only (the "consumers" tenant). Work and school
  accounts are refused because their email claim is set by the directory
  admin and is not verified, which allows account takeover ("nOAuth").
"""

import base64
import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from urllib.parse import urlencode

import httpx
import jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import OAuthIdentity, User

STATE_COOKIE_NAME = "stratosphere_oauth"
STATE_TTL = timedelta(minutes=10)
_STATE_AUDIENCE = "stratosphere-oauth-state"

# Microsoft's fixed tenant id for personal accounts (Outlook, Hotmail, Live).
MICROSOFT_CONSUMER_TENANT = "9188040d-6c67-4c5b-b112-36a304b66dad"


class OAuthError(Exception):
    """A sign-in that cannot complete. `code` goes to the login page as ?error=."""

    def __init__(self, code: str, detail: str = "") -> None:
        super().__init__(detail or code)
        self.code = code


@dataclass(frozen=True)
class Provider:
    name: str
    authorize_url: str
    token_url: str
    jwks_url: str
    issuer: str
    client_id: str
    client_secret: str

    @property
    def redirect_uri(self) -> str:
        return f"{settings.OAUTH_REDIRECT_BASE.rstrip('/')}/auth/oauth/{self.name}/callback"


@dataclass(frozen=True)
class VerifiedIdentity:
    provider: str
    subject: str
    email: str
    name: str


def get_provider(name: str) -> Provider | None:
    if name == "google" and settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET:
        return Provider(
            name="google",
            authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
            token_url="https://oauth2.googleapis.com/token",
            jwks_url="https://www.googleapis.com/oauth2/v3/certs",
            issuer="https://accounts.google.com",
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
        )
    if name == "microsoft" and settings.MICROSOFT_CLIENT_ID and settings.MICROSOFT_CLIENT_SECRET:
        base = "https://login.microsoftonline.com/consumers"
        return Provider(
            name="microsoft",
            authorize_url=f"{base}/oauth2/v2.0/authorize",
            token_url=f"{base}/oauth2/v2.0/token",
            jwks_url=f"{base}/discovery/v2.0/keys",
            issuer=f"https://login.microsoftonline.com/{MICROSOFT_CONSUMER_TENANT}/v2.0",
            client_id=settings.MICROSOFT_CLIENT_ID,
            client_secret=settings.MICROSOFT_CLIENT_SECRET,
        )
    return None


def enabled_providers() -> list[str]:
    return [name for name in ("google", "microsoft") if get_provider(name)]


def _pkce_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode()).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()


def begin(provider: Provider) -> tuple[str, str]:
    """Return (provider authorize URL, signed state cookie value)."""
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    cookie = jwt.encode(
        {
            "aud": _STATE_AUDIENCE,
            "exp": datetime.now(timezone.utc) + STATE_TTL,
            "p": provider.name,
            "s": state,
            "n": nonce,
            "v": verifier,
        },
        settings.JWT_SECRET,
        algorithm="HS256",
    )
    params = {
        "client_id": provider.client_id,
        "response_type": "code",
        "redirect_uri": provider.redirect_uri,
        "scope": "openid email profile",
        "state": state,
        "nonce": nonce,
        "code_challenge": _pkce_challenge(verifier),
        "code_challenge_method": "S256",
        # Always show the account chooser, so signing out of Stratosphere and
        # back in can pick a different Google/Microsoft account.
        "prompt": "select_account",
    }
    return f"{provider.authorize_url}?{urlencode(params)}", cookie


def _read_state_cookie(provider: Provider, cookie: str | None, state: str | None) -> dict:
    if not cookie or not state:
        raise OAuthError("oauth_expired", "missing state")
    try:
        data = jwt.decode(
            cookie, settings.JWT_SECRET, algorithms=["HS256"], audience=_STATE_AUDIENCE
        )
    except jwt.PyJWTError as exc:
        raise OAuthError("oauth_expired", "state cookie invalid or expired") from exc
    if data.get("p") != provider.name or not hmac.compare_digest(str(data.get("s")), state):
        raise OAuthError("oauth_failed", "state mismatch")
    return data


@lru_cache(maxsize=4)
def _jwks_client(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(url, cache_keys=True, lifespan=3600, timeout=10)


def _exchange_code(provider: Provider, code: str, verifier: str) -> str:
    try:
        response = httpx.post(
            provider.token_url,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": provider.redirect_uri,
                "client_id": provider.client_id,
                "client_secret": provider.client_secret,
                "code_verifier": verifier,
            },
            headers={"Accept": "application/json"},
            timeout=10,
        )
    except httpx.HTTPError as exc:
        raise OAuthError("oauth_failed", f"token request failed: {type(exc).__name__}") from exc
    if response.status_code != 200:
        raise OAuthError("oauth_failed", f"token endpoint returned {response.status_code}")
    id_token = response.json().get("id_token")
    if not id_token:
        raise OAuthError("oauth_failed", "no id_token in token response")
    return id_token


def verify_id_token(provider: Provider, id_token: str, nonce: str) -> VerifiedIdentity:
    try:
        signing_key = _jwks_client(provider.jwks_url).get_signing_key_from_jwt(id_token)
        claims = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=provider.client_id,
            # Google has used both forms of its issuer.
            issuer=(
                [provider.issuer, "accounts.google.com"]
                if provider.name == "google"
                else provider.issuer
            ),
            options={"require": ["exp", "iat", "sub", "aud", "iss"]},
            leeway=60,
        )
    except jwt.PyJWTError as exc:
        raise OAuthError("oauth_failed", f"id_token rejected: {type(exc).__name__}") from exc

    if not hmac.compare_digest(str(claims.get("nonce", "")), nonce):
        raise OAuthError("oauth_failed", "nonce mismatch")

    if provider.name == "google":
        if claims.get("email_verified") is not True:
            raise OAuthError("email_unverified")
        email = claims.get("email")
    else:
        if claims.get("tid") != MICROSOFT_CONSUMER_TENANT:
            raise OAuthError("work_account")
        email = claims.get("email")

    if not email or "@" not in email:
        raise OAuthError("no_email")
    email = email.strip().lower()

    allowed = settings.oauth_allowed_email_domains
    if allowed and email.rsplit("@", 1)[1] not in allowed:
        raise OAuthError("email_domain")

    name = (claims.get("name") or "").strip() or email.split("@", 1)[0]
    return VerifiedIdentity(
        provider=provider.name, subject=str(claims["sub"]), email=email, name=name[:160]
    )


def finish(
    provider: Provider, code: str | None, state: str | None, cookie: str | None
) -> VerifiedIdentity:
    data = _read_state_cookie(provider, cookie, state)
    if not code:
        raise OAuthError("oauth_failed", "missing code")
    id_token = _exchange_code(provider, code, data["v"])
    return verify_id_token(provider, id_token, data["n"])


def resolve_user(db: Session, identity: VerifiedIdentity) -> User:
    """Find or create the user for a verified provider identity.

    1. A known identity signs in as its user.
    2. Otherwise an existing user with the same email gets this identity
       linked (the provider has verified the address).
    3. Otherwise a new password-less user is created.
    """
    linked = (
        db.query(OAuthIdentity)
        .filter(
            OAuthIdentity.provider == identity.provider,
            OAuthIdentity.subject == identity.subject,
        )
        .first()
    )
    if linked is not None:
        user = db.get(User, linked.user_id)
        if user is not None:
            if linked.email != identity.email:
                linked.email = identity.email
                db.commit()
            return user

    user = db.query(User).filter(User.email == identity.email).first()
    if user is None:
        user = User(email=identity.email, name=identity.name, hashed_password=None)
        db.add(user)
        db.flush()
    db.add(
        OAuthIdentity(
            user_id=user.id,
            provider=identity.provider,
            subject=identity.subject,
            email=identity.email,
        )
    )
    db.commit()
    db.refresh(user)
    return user
