from fastapi import APIRouter, Depends

from app.deps import get_current_user
from app.models.user import User
from app.schemas.chat import ChatIn, ChatOut
from app.services.ai_coach import get_coach

router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatOut)
async def chat(data: ChatIn, current_user: User = Depends(get_current_user)) -> ChatOut:
    coach = get_coach()
    reply = await coach.reply(data.history, data.message)
    return ChatOut(reply=reply)
