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

import uuid

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    phone_number = Column(String, nullable=True)
    date_of_birth = Column(Date, nullable=True)
    in_app_notifications_enabled = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )
    age_group = Column(String, nullable=True)
    career_track = Column(String, nullable=True)
    # One of app.avatars.AVATAR_IDS, or null for the initial-letter fallback.
    avatar_id = Column(String(40), nullable=True)
    # Null for accounts that only sign in with Google or Microsoft.
    hashed_password = Column(String, nullable=True)
    # Bumped whenever the password changes. Access tokens carry the value they
    # were minted with, so incrementing this invalidates every existing session.
    token_version = Column(Integer, nullable=False, default=0, server_default="0")
    password_reset_token_hash = Column(String, nullable=True)
    password_reset_expires_at = Column(DateTime(timezone=True), nullable=True)
    # Telegram reminders. The chat id is set when the user presses Start in
    # the bot with a valid one-time link token (hashed, short-lived).
    telegram_chat_id = Column(BigInteger, nullable=True, unique=True)
    telegram_linked_at = Column(DateTime(timezone=True), nullable=True)
    telegram_link_token_hash = Column(String, nullable=True)
    telegram_link_expires_at = Column(DateTime(timezone=True), nullable=True)
    # What the bot expects next from this chat, e.g. "reflect:<goal id>" after
    # the Reflect button, with any text it is holding (a thought awaiting
    # "which task?"). Short-lived: ignored after telegram_pending_expires_at.
    telegram_pending = Column(String(80), nullable=True)
    telegram_pending_text = Column(Text, nullable=True)
    telegram_pending_expires_at = Column(DateTime(timezone=True), nullable=True)
    # IANA zone reported by the user's browser; "today" and times in bot
    # messages use it. None until the web app has reported one.
    timezone = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    @property
    def telegram_linked(self) -> bool:
        return self.telegram_chat_id is not None


class OAuthIdentity(Base):
    """A Google or Microsoft account that signs in as a user.

    (provider, subject) is the provider's stable id for the account; the email
    can change on the provider side and is kept only for reference.
    """

    __tablename__ = "oauth_identities"
    __table_args__ = (
        UniqueConstraint("provider", "subject", name="uq_oauth_identities_provider_subject"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider = Column(String(20), nullable=False)
    subject = Column(String(255), nullable=False)
    email = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
