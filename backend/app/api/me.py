from fastapi import APIRouter, Depends

from app.deps import get_current_user
from app.models.user import User
from app.schemas.auth import UserOut

router = APIRouter(tags=["users"])


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
