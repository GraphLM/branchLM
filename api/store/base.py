from __future__ import annotations

from typing import Any, Protocol


class Store(Protocol):
    @property
    def mode(self) -> str: ...

    def list_chats(self, user_id: str) -> list[dict[str, Any]]: ...

    def list_messages(self, user_id: str) -> list[dict[str, Any]]: ...

    def list_context_edges(self, user_id: str) -> list[dict[str, Any]]: ...

    def create_chat(
        self, user_id: str, title: str, position_x: float, position_y: float
    ) -> dict[str, Any]: ...

    def update_chat_positions(
        self, user_id: str, positions: dict[str, tuple[float, float]]
    ) -> None: ...

    def replace_context_edges(self, user_id: str, edges: list[dict[str, Any]]) -> None: ...
