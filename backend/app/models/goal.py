import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID

from app.db import Base


class Goal(Base):
    __tablename__ = "goals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    notes = Column(Text, nullable=True)
    is_timed = Column(Boolean, nullable=False, default=False)
    scheduled_for = Column(DateTime(timezone=True), nullable=True)
    priority = Column(String, nullable=False, default="medium")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class GoalLog(Base):
    __tablename__ = "goal_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    goal_id = Column(UUID(as_uuid=True), ForeignKey("goals.id", ondelete="CASCADE"), nullable=False)
    completed = Column(Boolean, nullable=False)
    reflection = Column(Text, nullable=False)
    soulful = Column(Boolean, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
