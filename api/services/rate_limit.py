from __future__ import annotations

import time
from collections import defaultdict, deque
from dataclasses import dataclass
from threading import Lock

from settings import Settings


@dataclass(frozen=True)
class RateLimitDecision:
    allowed: bool
    retry_after_seconds: int = 0


class SlidingWindowRateLimiter:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._per_minute: dict[str, deque[float]] = defaultdict(deque)
        self._burst: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def allow(self, key: str) -> RateLimitDecision:
        now = time.time()
        minute_limit = max(self._settings.rate_limit_per_minute, 1)
        burst_limit = max(self._settings.rate_limit_burst, 1)
        burst_window = max(self._settings.rate_limit_burst_window_seconds, 1)

        with self._lock:
            minute_bucket = self._per_minute[key]
            burst_bucket = self._burst[key]

            self._prune(minute_bucket, now - 60.0)
            self._prune(burst_bucket, now - float(burst_window))

            if len(minute_bucket) >= minute_limit:
                retry_after = self._retry_after(minute_bucket[0] + 60.0, now)
                return RateLimitDecision(allowed=False, retry_after_seconds=retry_after)

            if len(burst_bucket) >= burst_limit:
                retry_after = self._retry_after(burst_bucket[0] + float(burst_window), now)
                return RateLimitDecision(allowed=False, retry_after_seconds=retry_after)

            minute_bucket.append(now)
            burst_bucket.append(now)
            return RateLimitDecision(allowed=True)

    @staticmethod
    def _prune(bucket: deque[float], cutoff: float) -> None:
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()

    @staticmethod
    def _retry_after(reset_at: float, now: float) -> int:
        return max(1, int(reset_at - now) + 1)
