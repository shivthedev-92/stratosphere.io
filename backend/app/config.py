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
    ACCESS_COOKIE_SECURE: bool = False
    API_DOCS_ENABLED: bool = True

    AI_PROVIDER: Literal["disabled", "ollama", "anthropic"] = "ollama"
    OLLAMA_HOST: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.1:8b"
    ANTHROPIC_API_KEY: str | None = None
    ANTHROPIC_MODEL: str = "claude-opus-4-7"

    FRONTEND_URL: str = "http://localhost:3000"
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str | None = None
    SMTP_USE_TLS: bool = True

    CORS_ORIGINS: str = "http://localhost:3000"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        if isinstance(v, str) and v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+psycopg://", 1)
        return v

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
