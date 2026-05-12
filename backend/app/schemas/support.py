from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class SupportTicketCreate(BaseModel):
    name: str | None = Field(default=None, max_length=160)
    email: EmailStr | None = None
    subject: str = Field(min_length=3, max_length=180)
    message: str = Field(min_length=10, max_length=4000)
    source: str = Field(default="web", max_length=40)


class SupportTicketOut(BaseModel):
    id: UUID
    name: str | None
    email: str | None
    subject: str
    message: str
    source: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
