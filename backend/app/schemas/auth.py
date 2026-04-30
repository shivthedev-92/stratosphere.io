from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


class SignupIn(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: UUID
    email: str
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}
