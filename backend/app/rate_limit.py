from collections import OrderedDict, deque
from threading import Lock
from time import monotonic

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response

from app.config import settings


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Fixed-window-per-key limiter for the single-process demo deployment.

    Two things to know before scaling this out:

    * State is per-process. Running more than one uvicorn worker or replica
      multiplies every limit by the replica count. Move to Redis first.
    * Client identity comes from X-Forwarded-For, which is only trustworthy
      when the number of proxies in front of the app matches
      settings.TRUSTED_PROXY_HOPS. See _client_ip.
    """

    LIMITS = {
        ("POST", "/auth/signup"): (5, 60),
        ("POST", "/auth/login"): (10, 60),
        ("GET", "/auth/oauth/google/start"): (20, 60),
        ("GET", "/auth/oauth/google/callback"): (20, 60),
        ("GET", "/auth/oauth/microsoft/start"): (20, 60),
        ("GET", "/auth/oauth/microsoft/callback"): (20, 60),
        ("POST", "/auth/password-reset/request"): (5, 300),
        ("POST", "/auth/password-reset/confirm"): (5, 300),
        ("POST", "/support/tickets"): (5, 300),
        ("POST", "/chat"): (20, 60),
        ("POST", "/chat/stream"): (20, 60),
    }

    # Paths that draw on one shared budget. Both coach endpoints spend the same
    # paid model, so switching between them must not double the allowance.
    SHARED_BUCKETS = {"/chat/stream": "/chat"}

    # Hard ceiling on tracked keys. Without this, an attacker rotating source
    # addresses grows the map until the process is OOM-killed, which on a 1GB
    # VM is a cheap denial of service.
    MAX_TRACKED_KEYS = 20_000

    def __init__(self, app) -> None:
        super().__init__(app)
        # OrderedDict gives us O(1) eviction of the least-recently-touched key.
        self._requests: OrderedDict[tuple[str, str], deque[float]] = OrderedDict()
        self._lock = Lock()

    def _client_ip(self, request: Request) -> str:
        """Resolve the caller's address from X-Forwarded-For.

        Each trusted proxy appends the address it received the request from, so
        with N proxies in front of us the real client sits N entries from the
        right. Everything further left is attacker-supplied and must be ignored.

        One Caddy hop (the VM deployment) means index -1. Behind Azure
        Application Gateway or Container Apps ingress there is an extra hop, so
        TRUSTED_PROXY_HOPS must be raised to 2 or every caller collapses into a
        single bucket and one user's failures lock out everybody.
        """
        forwarded = request.headers.get("x-forwarded-for", "")
        hops = max(1, settings.TRUSTED_PROXY_HOPS)
        if forwarded:
            parts = [part.strip() for part in forwarded.split(",") if part.strip()]
            if len(parts) >= hops:
                return parts[-hops]
            # Fewer entries than expected: the request did not traverse the
            # proxy chain we were configured for. Fall back to the socket peer
            # rather than trusting a value the client may have set itself.
        return request.client.host if request.client else "unknown"

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        rule = self.LIMITS.get((request.method, request.url.path))
        if rule is None:
            return await call_next(request)

        limit, window_seconds = rule
        path = request.url.path
        key = (self._client_ip(request), self.SHARED_BUCKETS.get(path, path))
        now = monotonic()

        with self._lock:
            timestamps = self._requests.get(key)
            if timestamps is None:
                timestamps = deque()
                self._requests[key] = timestamps

            while timestamps and timestamps[0] <= now - window_seconds:
                timestamps.popleft()

            if len(timestamps) >= limit:
                retry_after = max(1, int(window_seconds - (now - timestamps[0])))
                self._requests.move_to_end(key)
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests. Try again later."},
                    headers={"Retry-After": str(retry_after)},
                )

            timestamps.append(now)
            self._requests.move_to_end(key)
            self._evict_locked()

        return await call_next(request)

    def _evict_locked(self) -> None:
        """Drop exhausted and least-recently-used keys. Caller must hold the lock."""
        # Empty deques are pure overhead — a caller who went quiet long enough
        # for their window to lapse no longer needs an entry.
        if not self._requests:
            return
        oldest_key = next(iter(self._requests))
        if not self._requests[oldest_key]:
            del self._requests[oldest_key]

        while len(self._requests) > self.MAX_TRACKED_KEYS:
            self._requests.popitem(last=False)
