############################################################################
#    _____ __             __                   __                     _
#   / ___// /__________ _/ /_____  _________  / /_  ___  ________    (_)___
#   \__ \/ __/ ___/ __ `/ __/ __ \/ ___/ __ \/ __ \/ _ \/ ___/ _ \  / / __ \
#  ___/ / /_/ /  / /_/ / /_/ /_/ (__  ) /_/ / / / /  __/ /  /  __/ / / /_/ /
# /____/\__/_/   \__,_/\__/\____/____/ .___/_/ /_/\___/_/   \___(_)_/\____/
#                                   /_/
############################################################################

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: UUID
    title: str
    body: str
    category: str
    due_at: datetime | None
    acknowledged_at: datetime | None
    read_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationSummaryOut(BaseModel):
    unread_count: int
