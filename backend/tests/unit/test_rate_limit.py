import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.rate_limit import RateLimitMiddleware


@pytest.mark.asyncio
async def test_sensitive_endpoint_is_rate_limited():
    app = FastAPI()
    app.add_middleware(RateLimitMiddleware)

    @app.post("/auth/signup")
    async def signup():
        return {"ok": True}

    transport = ASGITransport(app=app, client=("203.0.113.10", 50000))
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for _ in range(5):
            assert (await client.post("/auth/signup")).status_code == 200

        response = await client.post("/auth/signup")

    assert response.status_code == 429
    assert response.headers["Retry-After"]
