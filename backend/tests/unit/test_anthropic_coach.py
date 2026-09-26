"""AnthropicCoach against the real SDK, with Anthropic's wire format simulated.

httpx.MockTransport stands in for api.anthropic.com, so these tests exercise
the SDK's own SSE parsing and error classes, not a fake of our code.
"""

import json

import anthropic
import httpx
import pytest
from fastapi import HTTPException

from app.schemas.chat import ChatMessage
from app.services import ai_coach
from app.services.ai_coach import REFUSAL_TEXT, SYSTEM_PROMPT, AnthropicCoach, get_coach


def sse(*chunks: str, stop_reason: str = "end_turn") -> str:
    events = [
        ("message_start", {"type": "message_start", "message": {
            "id": "msg_test", "type": "message", "role": "assistant", "model": "claude-haiku-4-5",
            "content": [], "stop_reason": None, "stop_sequence": None,
            "usage": {"input_tokens": 12, "output_tokens": 1}}}),
    ]
    if chunks:
        events.append(("content_block_start", {"type": "content_block_start", "index": 0,
                                               "content_block": {"type": "text", "text": ""}}))
        for c in chunks:
            events.append(("content_block_delta", {"type": "content_block_delta", "index": 0,
                                                   "delta": {"type": "text_delta", "text": c}}))
        events.append(("content_block_stop", {"type": "content_block_stop", "index": 0}))
    events += [
        ("message_delta", {"type": "message_delta",
                           "delta": {"stop_reason": stop_reason, "stop_sequence": None},
                           "usage": {"output_tokens": 7}}),
        ("message_stop", {"type": "message_stop"}),
    ]
    return "".join(f"event: {e}\ndata: {json.dumps(d)}\n\n" for e, d in events)


@pytest.fixture
def api(monkeypatch):
    """Route the SDK to a handler; record every request body."""
    state = {"handler": None, "requests": []}

    def transport(request: httpx.Request) -> httpx.Response:
        state["requests"].append(json.loads(request.content))
        return state["handler"](request)

    client = anthropic.AsyncAnthropic(
        api_key="sk-ant-test",
        max_retries=0,
        http_client=httpx.AsyncClient(transport=httpx.MockTransport(transport)),
    )
    monkeypatch.setattr(ai_coach, "_anthropic_client", lambda: client)
    monkeypatch.setattr(ai_coach.settings, "ANTHROPIC_MODEL", "claude-haiku-4-5")
    return state


def ok_stream(*chunks, stop_reason="end_turn"):
    return lambda _r: httpx.Response(
        200, text=sse(*chunks, stop_reason=stop_reason),
        headers={"content-type": "text/event-stream"})


HISTORY = [ChatMessage(role="user", content="hi"), ChatMessage(role="assistant", content="hello")]


@pytest.mark.asyncio
async def test_streams_chunks_in_order_and_reply_joins_them(api):
    api["handler"] = ok_stream("Start ", "with ", "one step.")
    chunks = [c async for c in AnthropicCoach().stream_reply(HISTORY, "what now?", "ctx")]
    assert chunks == ["Start ", "with ", "one step."]
    assert await AnthropicCoach().reply(HISTORY, "what now?") == "Start with one step."


@pytest.mark.asyncio
async def test_request_shape(api):
    api["handler"] = ok_stream("ok")
    await AnthropicCoach().reply(HISTORY, "what now?", "Task context: read 15 min")
    body = api["requests"][0]
    assert body["model"] == "claude-haiku-4-5"
    assert body["max_tokens"] == 1024
    assert body["stream"] is True
    assert "thinking" not in body  # Haiku 4.5: not used for short coaching replies
    assert body["system"][0]["text"] == f"{SYSTEM_PROMPT}\n\nTask context: read 15 min"
    assert body["messages"] == [
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "hello"},
        {"role": "user", "content": "what now?"},
    ]


@pytest.mark.asyncio
async def test_refusal_with_no_text_yields_fallback_not_empty_bubble(api):
    api["handler"] = ok_stream(stop_reason="refusal")
    assert await AnthropicCoach().reply([], "x") == REFUSAL_TEXT


def _status(code, err_type):
    body = {"type": "error", "error": {"type": err_type, "message": "simulated"}}
    return lambda _r: httpx.Response(code, json=body)


@pytest.mark.asyncio
@pytest.mark.parametrize("code,err_type,expect", [
    (401, "authentication_error", 503),
    (403, "permission_error", 503),
    (404, "not_found_error", 503),
    (429, "rate_limit_error", 429),
    (400, "invalid_request_error", 502),
    (500, "api_error", 502),
    (529, "overloaded_error", 502),
])
async def test_api_errors_become_friendly_http_errors(api, code, err_type, expect):
    api["handler"] = _status(code, err_type)
    with pytest.raises(HTTPException) as exc:
        await AnthropicCoach().reply([], "x")
    assert exc.value.status_code == expect
    assert "simulated" not in exc.value.detail  # raw API text never reaches the user


@pytest.mark.asyncio
async def test_network_failure_is_friendly(api):
    def boom(request):
        raise httpx.ConnectError("refused", request=request)
    api["handler"] = boom
    with pytest.raises(HTTPException) as exc:
        await AnthropicCoach().reply([], "x")
    assert exc.value.status_code == 502


def test_missing_key_is_a_clear_503(monkeypatch):
    monkeypatch.setattr(ai_coach.settings, "AI_PROVIDER", "anthropic")
    monkeypatch.setattr(ai_coach.settings, "ANTHROPIC_API_KEY", None)
    with pytest.raises(HTTPException) as exc:
        get_coach()
    assert exc.value.status_code == 503


def test_client_is_shared_across_requests(monkeypatch):
    ai_coach._anthropic_client.cache_clear()
    monkeypatch.setattr(ai_coach.settings, "ANTHROPIC_API_KEY", "sk-ant-test")
    try:
        assert ai_coach._anthropic_client() is ai_coach._anthropic_client()
    finally:
        ai_coach._anthropic_client.cache_clear()
