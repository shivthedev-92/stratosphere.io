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

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID

from app.db import Base


class Goal(Base):
    __tablename__ = "goals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    emoji = Column(String(16), nullable=True)
    notes = Column(Text, nullable=True)
    is_timed = Column(Boolean, nullable=False, default=False)
    scheduled_for = Column(DateTime(timezone=True), nullable=True)
    priority = Column(String, nullable=False, default="medium")
    completed = Column(Boolean, nullable=False, default=False, server_default="false")
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class GoalLog(Base):
    __tablename__ = "goal_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    goal_id = Column(UUID(as_uuid=True), ForeignKey("goals.id", ondelete="CASCADE"), nullable=False)
    completed = Column(Boolean, nullable=False)
    reflection = Column(Text, nullable=False)
    soulful = Column(Boolean, nullable=True)
    emotion_label = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
