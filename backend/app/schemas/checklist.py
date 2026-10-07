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
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

MAX_CHECKLIST_ITEMS = 100


def _clean_text(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("Item text cannot be blank")
    return value


class ChecklistCreate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    items: list[str] = Field(min_length=1, max_length=MAX_CHECKLIST_ITEMS)

    @field_validator("title")
    @classmethod
    def blank_title_is_none(cls, value: str | None) -> str | None:
        return (value or "").strip() or None

    @field_validator("items")
    @classmethod
    def drop_blank_items(cls, values: list[str]) -> list[str]:
        # Blank rows are left over from the editor's "Enter for the next item".
        cleaned = [v.strip() for v in values if v.strip()]
        if not cleaned:
            raise ValueError("Add at least one item")
        if any(len(v) > 500 for v in cleaned):
            raise ValueError("Items are limited to 500 characters")
        return cleaned


class ChecklistItemCreate(BaseModel):
    text: str = Field(min_length=1, max_length=500)

    @field_validator("text")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return _clean_text(value)


class ChecklistItemUpdate(BaseModel):
    """Either field may be sent alone: rename an item, or tick/untick it."""

    text: str | None = Field(default=None, min_length=1, max_length=500)
    completed: bool | None = None

    @field_validator("text")
    @classmethod
    def clean_text(cls, value: str | None) -> str | None:
        return None if value is None else _clean_text(value)


class ChecklistItemOut(BaseModel):
    id: UUID
    checklist_id: UUID
    text: str
    position: int
    # Null while open; when ticked, the moment it was ticked.
    completed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChecklistOut(BaseModel):
    id: UUID
    goal_id: UUID
    title: str | None
    created_at: datetime
    items: list[ChecklistItemOut]
