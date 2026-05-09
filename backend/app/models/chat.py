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

from sqlalchemy import Column, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID

from app.db import Base


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    goal_id = Column(UUID(as_uuid=True), ForeignKey("goals.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(200), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class ChatMessageRecord(Base):
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(16), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
