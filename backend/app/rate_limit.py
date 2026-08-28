"""In-memory rate limiting middleware for public API routes."""

import time
from collections import defaultdict

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.config import settings


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.hits: dict[str, list[float]] = defaultdict(list)

    def _skip(self, request: Request) -> bool:
        path = request.url.path
        if path == "/api/health" or path.startswith("/uploads/"):
            return True
        if path.startswith("/api/bot"):
            return True
        bot_key = request.headers.get("X-Bot-Api-Key") or request.headers.get("x-bot-api-key")
        if bot_key and bot_key == settings.bot_api_key:
            return True
        return False

    def _client_key(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        if request.client:
            return request.client.host
        return "unknown"

    def _limit_for(self, path: str, method: str) -> tuple[int, int]:
        if path.startswith("/api/auth"):
            return settings.rate_limit_auth
        if path.startswith("/api/admin"):
            return settings.rate_limit_write
        if method in ("POST", "PUT", "PATCH", "DELETE"):
            if (
                path.startswith("/api/orders")
                or path.startswith("/api/link")
                or path.startswith("/api/discount")
                or path.startswith("/api/user/wishlist")
            ):
                return settings.rate_limit_write
        if path.endswith("/products/search"):
            return settings.rate_limit_search
        return settings.rate_limit_default

    async def dispatch(self, request: Request, call_next):
        if self._skip(request):
            return await call_next(request)

        path = request.url.path
        if not path.startswith("/api"):
            return await call_next(request)

        max_requests, window = self._limit_for(path, request.method)
        client = self._client_key(request)
        bucket_key = f"{client}:{path}:{request.method}"

        now = time.time()
        window_start = now - window
        timestamps = [t for t in self.hits[bucket_key] if t > window_start]

        if len(timestamps) >= max_requests:
            retry_after = max(1, int(window - (now - timestamps[0])))
            return JSONResponse(
                status_code=429,
                content={"detail": "Zu viele Anfragen. Bitte kurz warten."},
                headers={"Retry-After": str(retry_after)},
            )

        timestamps.append(now)
        self.hits[bucket_key] = timestamps
        return await call_next(request)
