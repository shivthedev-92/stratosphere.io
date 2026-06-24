from collections import defaultdict, deque
from threading import Lock
from time import monotonic

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Small in-memory limiter for the single-process demo deployment."""

    LIMITS = {
        ("POST", "/auth/signup"): (5, 60),
        ("POST", "/auth/login"): (10, 60),
        ("POST", "/auth/password-reset/request"): (5, 300),
        ("POST", "/auth/password-reset/confirm"): (5, 300),
        ("POST", "/support/tickets"): (5, 300),
        ("POST", "/chat"): (20, 60),
    }

    def __init__(self, app) -> None:
        super().__init__(app)
        self._requests: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        self._lock = Lock()

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        rule = self.LIMITS.get((request.method, request.url.path))
        if rule is None:
            return await call_next(request)

        limit, window_seconds = rule
        forwarded_for = request.headers.get("x-forwarded-for", "")
        client_ip = forwarded_for.rsplit(",", 1)[-1].strip()
        if not client_ip:
            client_ip = request.client.host if request.client else "unknown"
        key = (client_ip, request.url.path)
        now = monotonic()

        with self._lock:
            timestamps = self._requests[key]
            while timestamps and timestamps[0] <= now - window_seconds:
                timestamps.popleft()
            if len(timestamps) >= limit:
                retry_after = max(1, int(window_seconds - (now - timestamps[0])))
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests. Try again later."},
                    headers={"Retry-After": str(retry_after)},
                )
            timestamps.append(now)

        return await call_next(request)
