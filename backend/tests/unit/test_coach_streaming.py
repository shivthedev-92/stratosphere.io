"""The streaming contract.

`reply()` is derived from `stream_reply()` so the blocking path (mobile,
POST /chat) and the streaming path (web, POST /chat/stream) cannot drift.
"""

from collections.abc import AsyncIterator

import pytest

from app.schemas.chat import ChatMessage
from app.services.ai_coach import CoachProvider, _collect


class FakeCoach:
    """Implements only stream_reply; reply delegates, as real providers do."""

    def __init__(self, chunks: list[str]) -> None:
        self.chunks = chunks

    async def stream_reply(
        self,
        history: list[ChatMessage],
        user_message: str,
        task_context: str | None = None,
    ) -> AsyncIterator[str]:
        for chunk in self.chunks:
            yield chunk

    async def reply(
        self,
        history: list[ChatMessage],
        user_message: str,
        task_context: str | None = None,
    ) -> str:
        return await _collect(self.stream_reply(history, user_message, task_context))


@pytest.mark.asyncio
async def test_collect_joins_chunks_in_order() -> None:
    async def gen() -> AsyncIterator[str]:
        for part in ["Hello", ", ", "world"]:
            yield part

    assert await _collect(gen()) == "Hello, world"


@pytest.mark.asyncio
async def test_reply_equals_concatenated_stream() -> None:
    """The two endpoints must produce identical text for identical input."""
    coach = FakeCoach(["Start ", "with ", "one ", "small ", "step."])
    streamed = "".join([c async for c in coach.stream_reply([], "hi")])
    blocking = await coach.reply([], "hi")
    assert streamed == blocking == "Start with one small step."


@pytest.mark.asyncio
async def test_empty_stream_yields_empty_reply() -> None:
    assert await FakeCoach([]).reply([], "hi") == ""


def test_providers_satisfy_the_protocol() -> None:
    from app.services.ai_coach import OllamaCoach

    assert isinstance(OllamaCoach(), CoachProvider)
    assert isinstance(FakeCoach([]), CoachProvider)
