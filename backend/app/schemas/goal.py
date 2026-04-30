from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

Priority = Literal["low", "medium", "high"]


class GoalCreate(BaseModel):
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


class GoalLogOut(BaseModel):
    id: UUID
    goal_id: UUID
    completed: bool
    reflection: str
    soulful: bool | None
    created_at: datetime

    model_config = {"from_attributes": True}
