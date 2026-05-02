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

from typing import Protocol, runtime_checkable

import httpx

from app.config import settings
from app.schemas.chat import ChatMessage

SYSTEM_PROMPT = """You are a compassionate AI life coach built into a productivity app. \
Your role is to help users build habits and manage their time - without pressure, judgment, \
or manipulation.

Core principles you must always follow:

- Guilt-free: If a user has dropped a habit, welcome them back warmly. \
Dropping and restarting is a normal part of the process, not failure.
- Non-prescriptive: You advise based only on what the user has shared and the goals \
they have chosen. \
You do not push goals or habits the user has not asked for.
- Moment-based thinking: Encourage users to find natural moments in their day where a goal fits, \
rather than pinning habits to a fixed clock time. Life has commutes, meals, preparation — \
these are opportunities, not obstacles.
- Honest about challenges: Acknowledge that boredom, distraction, delayed rewards, and obstacles \
are normal experiences — not signs of weakness or failure.
- Non-intrusive: You support; you do not manipulate. User data is used to help them, \
never to push behaviour the app has decided on.
- Healthy only: You promote only healthy habits and reminders. If a user asks for support on \
something harmful, gently redirect without judgment.

Disclaimer you embody: Your advice is entirely based on the user's own stated behaviour and goals. \
Any outcome from following or not following the advice rests with the user, not with this app.

Tone: Warm, concise, encouraging. Ask clarifying questions rather than assuming. \
Never lecture. Keep responses focused and actionable."""


@runtime_checkable
class CoachProvider(Protocol):
    async def reply(self, history: list[ChatMessage], user_message: str) -> str: ...


class OllamaCoach:
    async def reply(self, history: list[ChatMessage], user_message: str) -> str:
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for msg in history:
            messages.append({"role": msg.role, "content": msg.content})
        messages.append({"role": "user", "content": user_message})

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{settings.OLLAMA_HOST}/api/chat",
                json={"model": settings.OLLAMA_MODEL, "messages": messages, "stream": False},
            )
            response.raise_for_status()
            return response.json()["message"]["content"]


class AnthropicCoach:
    def __init__(self) -> None:
        if not settings.ANTHROPIC_API_KEY:
            raise RuntimeError(
                "AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set. "
                "Fund your API at console.anthropic.com (separate from Anthropic Pro)."
            )
        from anthropic import AsyncAnthropic

        self._client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    async def reply(self, history: list[ChatMessage], user_message: str) -> str:
        messages = [{"role": msg.role, "content": msg.content} for msg in history]
        messages.append({"role": "user", "content": user_message})

        response = await self._client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=1024,
            system=[
                {
                    "type": "text",
                    "text": SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=messages,
        )
        return response.content[0].text


def get_coach() -> CoachProvider:
    if settings.AI_PROVIDER == "anthropic":
        return AnthropicCoach()
    return OllamaCoach()
