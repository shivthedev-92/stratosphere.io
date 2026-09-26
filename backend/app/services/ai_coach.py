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

import functools
import json
import logging
from collections.abc import AsyncIterator
from typing import Protocol, runtime_checkable

import anthropic
import httpx
from fastapi import HTTPException

from app.config import settings
from app.schemas.chat import ChatMessage

logger = logging.getLogger(__name__)

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
Never lecture. Keep responses focused and actionable.

Format: The app shows your reply exactly as written, so use plain text only - no \
Markdown such as asterisks for bold or italics, headings, bullet symbols, or \
horizontal rules. To emphasise something, say it plainly. Keep replies short: usually \
two to four sentences and no more than about 120 words, unless the user asks for \
more detail."""


#================#
# Coach Provider |
#================#

@runtime_checkable
class CoachProvider(Protocol):
    """Streaming is the primitive; `reply` is derived from it.

    Implementing only `stream_reply` keeps the blocking path (used by the
    mobile client via POST /chat) and the streaming path (web, via
    POST /chat/stream) from drifting apart.
    """

    def stream_reply(
        self,
        history: list[ChatMessage],
        user_message: str,
        task_context: str | None = None,
    ) -> AsyncIterator[str]: ...

    async def reply(
        self,
        history: list[ChatMessage],
        user_message: str,
        task_context: str | None = None,
    ) -> str: ...


async def _collect(chunks: AsyncIterator[str]) -> str:
    """Drain a stream into the single string the blocking endpoint returns."""
    return "".join([chunk async for chunk in chunks])

#==============#
# Ollama Coach |
#==============#

class OllamaCoach:
    def _messages(
        self,
        history: list[ChatMessage],
        user_message: str,
        task_context: str | None,
    ) -> list[dict[str, str]]:
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        if task_context:
            messages.append({"role": "system", "content": task_context})
        for msg in history:
            messages.append({"role": msg.role, "content": msg.content})
        messages.append({"role": "user", "content": user_message})
        return messages

    async def stream_reply(
        self,
        history: list[ChatMessage],
        user_message: str,
        task_context: str | None = None,
    ) -> AsyncIterator[str]:
        payload = {
            "model": settings.OLLAMA_MODEL,
            "messages": self._messages(history, user_message, task_context),
            "stream": True,
            "options": {"temperature": 0.4, "num_predict": 350},
        }
        # Read timeout is per-chunk, not per-request. On CPU inference the
        # gap before the first token (prompt evaluation) is the long one;
        # once tokens flow the gaps are small.
        timeout = httpx.Timeout(connect=10.0, read=180.0, write=10.0, pool=10.0)
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream(
                    "POST", f"{settings.OLLAMA_HOST}/api/chat", json=payload
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line.strip():
                            continue
                        try:
                            data = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        chunk = data.get("message", {}).get("content", "")
                        if chunk:
                            yield chunk
                        if data.get("done"):
                            return
        except httpx.TimeoutException as exc:
            raise HTTPException(
                status_code=504,
                detail=(
                    "The local AI model took too long to respond. "
                    "Try a shorter message or use a smaller Ollama model."
                ),
            ) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=502,
                detail="The local AI model is not responding correctly.",
            ) from exc

    async def reply(
        self,
        history: list[ChatMessage],
        user_message: str,
        task_context: str | None = None,
    ) -> str:
        return await _collect(self.stream_reply(history, user_message, task_context))


#=================#
# Anthropic Coach |
#=================#

# Coaching replies are meant to be short; this is also the per-reply cost cap.
ANTHROPIC_MAX_TOKENS = 1024

# Shown if the model declines and produced no text, so the user never sees an
# empty bubble. Deliberately plain; the crisis gate runs before the model.
REFUSAL_TEXT = (
    "I can't help with that one here. If something is weighing on you, it may "
    "help to talk it through with someone you trust."
)


@functools.lru_cache(maxsize=1)
def _anthropic_client() -> anthropic.AsyncAnthropic:
    """One shared client per process, so connections are pooled and reused.

    60s total with a 5s connect timeout, instead of the SDK's 10-minute
    default; a coaching reply that takes longer than that has failed. The SDK
    retries connection errors, 429 and 5xx twice with backoff before raising.
    """
    return anthropic.AsyncAnthropic(
        api_key=settings.ANTHROPIC_API_KEY,
        timeout=anthropic.Timeout(60.0, connect=5.0),
        max_retries=2,
    )


def _coach_error(exc: anthropic.APIError) -> HTTPException:
    """Map an SDK error to what the user sees. Most-specific first."""
    if isinstance(exc, (anthropic.AuthenticationError, anthropic.PermissionDeniedError)):
        logger.error("anthropic: API key rejected (%s)", type(exc).__name__)
        return HTTPException(503, "The AI coach is not configured correctly.")
    if isinstance(exc, anthropic.NotFoundError):
        logger.error("anthropic: model %r not found", settings.ANTHROPIC_MODEL)
        return HTTPException(503, "The AI coach is not configured correctly.")
    if isinstance(exc, anthropic.RateLimitError):
        return HTTPException(429, "The AI coach is busy right now. Please try again in a minute.")
    if isinstance(exc, anthropic.BadRequestError):
        logger.error("anthropic: bad request: %s", exc.message)
        return HTTPException(502, "The AI coach couldn't process that message.")
    if isinstance(exc, anthropic.APITimeoutError):
        return HTTPException(504, "The AI coach took too long to respond. Please try again.")
    if isinstance(exc, anthropic.APIConnectionError):
        return HTTPException(502, "The AI coach can't be reached right now.")
    return HTTPException(502, "The AI coach is temporarily unavailable. Please try again.")


class AnthropicCoach:
    def _request_kwargs(
        self,
        history: list[ChatMessage],
        user_message: str,
        task_context: str | None,
    ) -> dict:
        messages = [{"role": msg.role, "content": msg.content} for msg in history]
        messages.append({"role": "user", "content": user_message})
        system_prompt = SYSTEM_PROMPT if not task_context else f"{SYSTEM_PROMPT}\n\n{task_context}"
        return {
            "model": settings.ANTHROPIC_MODEL,
            "max_tokens": ANTHROPIC_MAX_TOKENS,
            # NOTE: this cache_control is inert on Haiku 4.5, whose minimum
            # cacheable prefix is 4096 tokens - SYSTEM_PROMPT is ~380. It is
            # kept because it does apply on larger models (Opus 5 caches from
            # 512 tokens). Do not pad the prompt to reach the minimum.
            "system": [
                {
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            "messages": messages,
        }

    async def stream_reply(
        self,
        history: list[ChatMessage],
        user_message: str,
        task_context: str | None = None,
    ) -> AsyncIterator[str]:
        produced = False
        try:
            async with _anthropic_client().messages.stream(
                **self._request_kwargs(history, user_message, task_context)
            ) as stream:
                async for text in stream.text_stream:
                    produced = True
                    yield text
                final = await stream.get_final_message()
        except anthropic.APIError as exc:
            raise _coach_error(exc) from None

        if final.stop_reason == "refusal" and not produced:
            yield REFUSAL_TEXT
        elif final.stop_reason == "max_tokens":
            logger.info("anthropic: reply truncated at max_tokens=%d", ANTHROPIC_MAX_TOKENS)

    async def reply(
        self,
        history: list[ChatMessage],
        user_message: str,
        task_context: str | None = None,
    ) -> str:
        return await _collect(self.stream_reply(history, user_message, task_context))


def get_coach() -> CoachProvider:
    if settings.AI_PROVIDER == "disabled":
        raise HTTPException(status_code=503, detail="The AI coach is disabled for this deployment.")
    if settings.AI_PROVIDER == "anthropic":
        if not settings.ANTHROPIC_API_KEY:
            logger.error("anthropic: AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is empty")
            raise HTTPException(503, "The AI coach is not configured on this server.")
        return AnthropicCoach()
    return OllamaCoach()
