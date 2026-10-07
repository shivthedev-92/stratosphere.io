############################################################################
#    _____ __             __                   __                     _
#   / ___// /__________ _/ /_____  _________  / /_  ___  ________    (_)___
#   \__ \/ __/ ___/ __ `/ __/ __ \/ ___/ __ \/ __ \/ _ \/ ___/ _ \  / / __ \
#  ___/ / /_/ /  / /_/ / /_/ /_/ (__  ) /_/ / / / /  __/ /  /  __/ / / /_/ /
# /____/\__/_/   \__,_/\__/\____/____/ .___/_/ /_/\___/_/   \___(_)_/\____/
#                                   /_/
############################################################################

import uuid

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID

from app.db import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    # Set for task reminders so the reminder follows its task. The database
    # deletes the reminder when the task is deleted.
    goal_id = Column(
        UUID(as_uuid=True), ForeignKey("goals.id", ondelete="CASCADE"), nullable=True, index=True
    )
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    category = Column(String, nullable=False, default="general")
    due_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    # At-most-once claim for Telegram delivery; see app/services/telegram.py.
    telegram_sent_at = Column(DateTime(timezone=True), nullable=True)
    # The Telegram message that delivered it, so a reply to that message can
    # be saved as a reflection on the reminder's task.
    telegram_message_id = Column(BigInteger, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
