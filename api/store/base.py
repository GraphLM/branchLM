from __future__ import annotations

from typing import Any, Protocol


class Store(Protocol):
    @property
    def mode(self) -> str: ...

    def create_chat(
        self, user_id: str, title: str, position_x: float, position_y: float
    ) -> dict[str, Any]: ...
