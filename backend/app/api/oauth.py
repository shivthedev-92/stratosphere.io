"""Routes for sign-in with Google and Microsoft. See app/services/oauth.py."""

import logging
from html import escape
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.api.auth import set_access_cookie
from app.config import settings
from app.db import get_db
from app.schemas.auth import AuthConfigOut
from app.security import create_access_token
from app.services import oauth

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/config", response_model=AuthConfigOut)
def auth_config() -> AuthConfigOut:
    """What the sign-in and sign-up pages should offer."""
    return AuthConfigOut(
        providers=oauth.enabled_providers(),
        password_signup=settings.PASSWORD_SIGNUP_ENABLED,
    )


def _frontend(path: str) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}{path}"


def _set_state_cookie(response, value: str) -> None:
    response.set_cookie(
        key=oauth.STATE_COOKIE_NAME,
        value=value,
        max_age=int(oauth.STATE_TTL.total_seconds()),
        path="/",
        secure=settings.ACCESS_COOKIE_SECURE,
        httponly=True,
        # Lax, not Strict: the provider sends the browser back to the
        # callback as a cross-site top-level GET, which Strict would drop.
        samesite="lax",
    )


def _clear_state_cookie(response) -> None:
    response.delete_cookie(
        key=oauth.STATE_COOKIE_NAME,
        path="/",
        secure=settings.ACCESS_COOKIE_SECURE,
        httponly=True,
        samesite="lax",
    )


@router.get("/oauth/{provider_name}/start")
def oauth_start(provider_name: str) -> RedirectResponse:
    provider = oauth.get_provider(provider_name)
    if provider is None:
        raise HTTPException(status_code=404, detail="Sign-in provider not available")
    url, state_cookie = oauth.begin(provider)
    response = RedirectResponse(url, status_code=302)
    _set_state_cookie(response, state_cookie)
    return response


@router.get("/oauth/{provider_name}/callback")
def oauth_callback(
    provider_name: str,
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
):
    provider = oauth.get_provider(provider_name)
    if provider is None:
        raise HTTPException(status_code=404, detail="Sign-in provider not available")

    if error:
        # The user cancelled on the provider's page, or it refused the request.
        code_for_page = "oauth_cancelled" if error == "access_denied" else "oauth_failed"
        response = RedirectResponse(_frontend(f"/login?error={code_for_page}"), status_code=302)
        _clear_state_cookie(response)
        return response

    try:
        identity = oauth.finish(provider, code, state, request.cookies.get(oauth.STATE_COOKIE_NAME))
    except oauth.OAuthError as exc:
        logger.warning("oauth %s sign-in failed: %s (%s)", provider.name, exc.code, exc)
        response = RedirectResponse(_frontend(f"/login?error={quote(exc.code)}"), status_code=302)
        _clear_state_cookie(response)
        return response

    user = oauth.resolve_user(db, identity)
    token = create_access_token(str(user.id), user.token_version)

    # Finish with a same-origin page rather than a redirect. The session
    # cookie is SameSite=Strict, and a redirect chain that started on the
    # provider's site counts as cross-site, so the next request would go out
    # without it. A fresh navigation from our own page does not.
    target = escape(_frontend("/dashboard"), quote=True)
    response = HTMLResponse(
        "<!doctype html><meta charset=utf-8>"
        f'<meta http-equiv="refresh" content="0;url={target}">'
        "<title>Signing you in…</title>"
        f'<p style="font-family:system-ui;padding:2rem">Signing you in… '
        f'<a href="{target}">Continue</a></p>',
        headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"},
    )
    set_access_cookie(response, token)
    _clear_state_cookie(response)
    return response
