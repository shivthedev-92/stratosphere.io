import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.rate_limit import RateLimitMiddleware


def build_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(RateLimitMiddleware)

    @app.post("/auth/signup")
    async def signup():
        return {"ok": True}

    @app.post("/auth/login")
    async def login():
        return {"ok": True}

    @app.post("/chat")
    async def chat():
        return {"ok": True}

    @app.post("/chat/stream")
    async def chat_stream():
        return {"ok": True}

    @app.get("/goals")
    async def goals():
        return {"ok": True}

    return app


def client_for(app: FastAPI, peer: str = "203.0.113.10") -> AsyncClient:
    transport = ASGITransport(app=app, client=(peer, 50000))
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_sensitive_endpoint_is_rate_limited():
    async with client_for(build_app()) as client:
        for _ in range(5):
            assert (await client.post("/auth/signup")).status_code == 200

        response = await client.post("/auth/signup")

    assert response.status_code == 429
    assert response.headers["Retry-After"]


@pytest.mark.asyncio
async def test_limits_are_isolated_per_path():
    """Exhausting signup must not consume the separate login budget."""
    app = build_app()
    async with client_for(app) as client:
        for _ in range(5):
            await client.post("/auth/signup")
        assert (await client.post("/auth/signup")).status_code == 429

        assert (await client.post("/auth/login")).status_code == 200


@pytest.mark.asyncio
async def test_unlisted_endpoints_are_not_limited():
    app = build_app()
    async with client_for(app) as client:
        for _ in range(50):
            assert (await client.get("/goals")).status_code == 200


@pytest.mark.asyncio
async def test_forged_x_forwarded_for_prefix_cannot_evade_the_limit():
    """A caller rotating the left-hand XFF entries must stay in one bucket.

    With one trusted proxy the rightmost entry is the only trustworthy one.
    If the limiter keyed on the leftmost value instead, each request below
    would land in a fresh bucket and the limit would never trigger.
    """
    app = build_app()
    async with client_for(app) as client:
        statuses = []
        for i in range(7):
            response = await client.post(
                "/auth/signup",
                headers={"x-forwarded-for": f"10.0.0.{i}, 203.0.113.10"},
            )
            statuses.append(response.status_code)

    assert statuses[:5] == [200] * 5
    assert statuses[5:] == [429, 429]


@pytest.mark.asyncio
async def test_distinct_real_clients_get_independent_budgets():
    app = build_app()
    async with client_for(app) as client:
        for _ in range(5):
            await client.post(
                "/auth/signup", headers={"x-forwarded-for": "198.51.100.1"}
            )
        exhausted = await client.post(
            "/auth/signup", headers={"x-forwarded-for": "198.51.100.1"}
        )
        other = await client.post(
            "/auth/signup", headers={"x-forwarded-for": "198.51.100.2"}
        )

    assert exhausted.status_code == 429
    assert other.status_code == 200


@pytest.mark.asyncio
async def test_extra_proxy_hop_is_honoured(monkeypatch):
    """Behind two proxies the client sits second from the right.

    This is the Azure Application Gateway / Container Apps shape. If the
    limiter still read the rightmost entry it would key every caller on the
    ingress address, so one user's failures would lock out everyone.
    """
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 2)
    app = build_app()
    async with client_for(app) as client:
        # Same ingress IP on the right, two different real clients in the middle.
        for _ in range(5):
            await client.post(
                "/auth/signup",
                headers={"x-forwarded-for": "1.1.1.1, 198.51.100.7, 10.10.0.1"},
            )
        same_client = await client.post(
            "/auth/signup",
            headers={"x-forwarded-for": "1.1.1.1, 198.51.100.7, 10.10.0.1"},
        )
        different_client = await client.post(
            "/auth/signup",
            headers={"x-forwarded-for": "1.1.1.1, 198.51.100.8, 10.10.0.1"},
        )

    assert same_client.status_code == 429
    assert different_client.status_code == 200


@pytest.mark.asyncio
async def test_tracked_key_count_stays_bounded_under_address_rotation():
    """The memory-exhaustion guard: rotating source addresses must not grow
    the tracking map without limit."""
    inner = FastAPI()

    @inner.post("/auth/signup")
    async def signup():
        return {"ok": True}

    # Wrap by hand rather than via add_middleware so we keep a reference to the
    # live limiter and can inspect its internal map.
    limiter = RateLimitMiddleware(inner)
    limiter.MAX_TRACKED_KEYS = 500

    transport = ASGITransport(app=limiter, client=("203.0.113.10", 50000))
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for i in range(2000):
            await client.post(
                "/auth/signup",
                headers={"x-forwarded-for": f"198.51.{i // 256}.{i % 256}"},
            )

    assert len(limiter._requests) <= limiter.MAX_TRACKED_KEYS


@pytest.mark.asyncio
async def test_streaming_coach_endpoint_is_rate_limited():
    async with client_for(build_app()) as client:
        for _ in range(20):
            assert (await client.post("/chat/stream")).status_code == 200
        assert (await client.post("/chat/stream")).status_code == 429


@pytest.mark.asyncio
async def test_coach_endpoints_share_one_budget():
    """Mixing /chat and /chat/stream must not double the paid-model allowance."""
    async with client_for(build_app()) as client:
        for _ in range(10):
            assert (await client.post("/chat")).status_code == 200
            assert (await client.post("/chat/stream")).status_code == 200
        assert (await client.post("/chat")).status_code == 429
        assert (await client.post("/chat/stream")).status_code == 429

