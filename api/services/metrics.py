from __future__ import annotations

from threading import Lock


class AppMetrics:
    def __init__(self) -> None:
        self._lock = Lock()
        self._counters: dict[str, int] = {}

    def incr(self, key: str, value: int = 1) -> None:
        if value == 0:
            return
        with self._lock:
            self._counters[key] = self._counters.get(key, 0) + value

    def snapshot(self) -> dict[str, int]:
        with self._lock:
            return dict(self._counters)
