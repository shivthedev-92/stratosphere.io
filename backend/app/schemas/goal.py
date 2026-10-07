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

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.safety import SafetyNoticeOut

Priority = Literal["low", "medium", "high"]
EmotionLabel = Literal[
    "happy",
    "sad",
    "excited",
    "calm",
    "anxious",
    "overwhelmed",
    "hopeful",
    "tired",
    "unable_to_describe",
    "other",
]


class GoalCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    emoji: str | None = Field(default=None, max_length=16)
    notes: str | None = Field(default=None, max_length=2000)
    is_timed: bool = False
    scheduled_for: datetime | None = None
    priority: Priority = "medium"


class GoalUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    emoji: str | None = Field(default=None, max_length=16)
    notes: str | None = Field(default=None, max_length=2000)
    is_timed: bool = False
    scheduled_for: datetime | None = None
    priority: Priority = "medium"
    completed: bool | None = None


class GoalOut(BaseModel):
    id: UUID
    title: str
    emoji: str | None
    notes: str | None
    is_timed: bool
    scheduled_for: datetime | None
    priority: Priority
    completed: bool
    completed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class GoalLogCreate(BaseModel):
    # Omitted by current clients: the server records whether the task was
    # complete when the reflection was written. Older mobile builds still send it.
    completed: bool | None = None
    reflection: str = Field(min_length=1, max_length=2000)
    soulful: bool | None = None
    emotion_label: EmotionLabel | None = None


class GoalLogOut(BaseModel):
    id: UUID
    goal_id: UUID
    completed: bool
    reflection: str
    soulful: bool | None
    emotion_label: EmotionLabel | None
    created_at: datetime
    # Additive only. The reflection is always saved; this simply surfaces
    # crisis resources alongside it when the text trips detection.
    safety: SafetyNoticeOut | None = None

    model_config = {"from_attributes": True}
