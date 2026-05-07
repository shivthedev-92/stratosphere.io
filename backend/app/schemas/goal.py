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
    notes: str | None = Field(default=None, max_length=2000)
    is_timed: bool = False
    scheduled_for: datetime | None = None
    priority: Priority = "medium"


class GoalUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    notes: str | None = Field(default=None, max_length=2000)
    is_timed: bool = False
    scheduled_for: datetime | None = None
    priority: Priority = "medium"


class GoalOut(BaseModel):
    id: UUID
    title: str
    notes: str | None
    is_timed: bool
    scheduled_for: datetime | None
    priority: Priority
    created_at: datetime

    model_config = {"from_attributes": True}


class GoalLogCreate(BaseModel):
    completed: bool
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

    model_config = {"from_attributes": True}
