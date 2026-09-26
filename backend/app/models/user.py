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

from sqlalchemy import BigInteger, Boolean, Column, Date, DateTime, Integer, String, func
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
    hashed_password = Column(String, nullable=False)
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
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    @property
    def telegram_linked(self) -> bool:
        return self.telegram_chat_id is not None
