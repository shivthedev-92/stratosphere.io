############################################################################
#    _____ __             __                   __                     _     
#   / ___// /__________ _/ /_____  _________  / /_  ___  ________    (_)___ 
#   \__ \/ __/ ___/ __ `/ __/ __ \/ ___/ __ \/ __ \/ _ \/ ___/ _ \  / / __ \
#  ___/ / /_/ /  / /_/ / /_/ /_/ (__  ) /_/ / / / /  __/ /  /  __/ / / /_/ /
# /____/\__/_/   \__,_/\__/\____/____/ .___/_/ /_/\___/_/   \___(_)_/\____/ 
#                                   /_/                                     
############################################################################
# Copyright (c) 2024. Sivarajan kakamaniyan. All rights reserved.
# Statosphere is a product of Sivarajan Kakamaniyan. 
# Unauthorized copying of this file, via any medium is strictly prohibited.
# Version 0.1.0 | 2024-06
############################################################################

from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

#========================#
# Settings Configuration |
#========================#

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7
    ACCESS_COOKIE_NAME: str = "stratosphere_access_token"
    # Secure-by-default: a deploy that forgets these env vars fails closed
    # (cookies stay HTTPS-only, docs stay private). Local dev opts out via .env.
    ACCESS_COOKIE_SECURE: bool = True
    API_DOCS_ENABLED: bool = False

    AI_PROVIDER: Literal["disabled", "ollama", "anthropic"] = "ollama"
    OLLAMA_HOST: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.1:8b"
    ANTHROPIC_API_KEY: str | None = None
    ANTHROPIC_MODEL: str = "claude-haiku-4-5"

    # Coach spend controls; see app/services/coach_budget.py. A limit of 0
    # disables the daily cap (e.g. local development against free Ollama).
    COACH_DAILY_MESSAGE_LIMIT: int = 50
    COACH_HISTORY_MAX_CHARS: int = 6000

    FRONTEND_URL: str = "http://localhost:3000"
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str | None = None
    SMTP_USE_TLS: bool = True

    CORS_ORIGINS: str = "http://localhost:3000"

    # Sign-in with Google / Microsoft (personal accounts). A provider is
    # offered only when both its id and secret are set. Redirect URIs are
    # OAUTH_REDIRECT_BASE + /auth/oauth/<provider>/callback and must match
    # the ones registered with each provider exactly.
    GOOGLE_CLIENT_ID: str | None = None
    GOOGLE_CLIENT_SECRET: str | None = None
    MICROSOFT_CLIENT_ID: str | None = None
    MICROSOFT_CLIENT_SECRET: str | None = None
    OAUTH_REDIRECT_BASE: str = "http://localhost:8000"
    # Comma-separated email domains allowed to sign in (e.g. "gmail.com,
    # outlook.com"). Empty allows any address the provider has verified.
    OAUTH_ALLOWED_EMAIL_DOMAINS: str = ""
    # New accounts come from Google or Microsoft only. Existing password
    # accounts can still sign in with their password.
    PASSWORD_SIGNUP_ENABLED: bool = False

    # Telegram reminders. Both token and username (without @) come from
    # @BotFather; leave them unset to disable the feature entirely.
    TELEGRAM_BOT_TOKEN: str | None = None
    TELEGRAM_BOT_USERNAME: str | None = None
    TELEGRAM_API_BASE: str = "https://api.telegram.org"
    # The reminder sender and bot poller run inside the API process. Turn
    # off for any extra process that must not also send (e.g. a one-off
    # script), so reminders are not delivered twice.
    TELEGRAM_WORKER_ENABLED: bool = True

    # Number of proxies that append to X-Forwarded-For in front of this app.
    # 1 = Caddy only (the single-VM deployment). Raise to 2 behind Azure
    # Application Gateway or Container Apps ingress, or rate limiting will key
    # every request on the ingress IP instead of the caller's.
    TRUSTED_PROXY_HOPS: int = 1

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        if isinstance(v, str) and v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+psycopg://", 1)
        return v

    @property
    def oauth_allowed_email_domains(self) -> set[str]:
        return {
            domain.strip().lower().lstrip("@")
            for domain in self.OAUTH_ALLOWED_EMAIL_DOMAINS.split(",")
            if domain.strip()
        }

    @property
    def cors_origins(self) -> list[str]:
        value = self.CORS_ORIGINS.strip()
        if value.startswith("[") and value.endswith("]"):
            value = value.strip("[]")
        return [
            origin.strip().strip('"').strip("'").rstrip("/")
            for origin in value.split(",")
            if origin.strip()
        ]


settings = Settings()
