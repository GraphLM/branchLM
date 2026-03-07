from __future__ import annotations

from typing import Any, Protocol


class Store(Protocol):
    @property
    def mode(self) -> str: ...

    def workspace_exists(self, user_id: str, workspace_id: str) -> bool: ...

    def chat_exists(self, user_id: str, workspace_id: str, chat_id: str) -> bool: ...
    def get_chat(self, user_id: str, workspace_id: str, chat_id: str) -> dict[str, Any] | None: ...

    def list_workspaces(self, user_id: str) -> list[dict[str, Any]]: ...

    def create_workspace(self, user_id: str, title: str) -> dict[str, Any]: ...

    def update_workspace_title(self, user_id: str, workspace_id: str, title: str) -> None: ...

    def delete_workspace(self, user_id: str, workspace_id: str) -> None: ...

    def list_chats(self, user_id: str, workspace_id: str) -> list[dict[str, Any]]: ...

    def list_messages(self, user_id: str, workspace_id: str) -> list[dict[str, Any]]: ...

    def list_messages_for_chat(
        self, user_id: str, workspace_id: str, chat_id: str
    ) -> list[dict[str, Any]]: ...

    def list_context_edges(self, user_id: str, workspace_id: str) -> list[dict[str, Any]]: ...
    def list_context_messages_for_chat(
        self, user_id: str, workspace_id: str, chat_id: str
    ) -> list[dict[str, Any]]: ...

    def create_chat(
        self,
        user_id: str,
        workspace_id: str,
        title: str,
        position_x: float,
        position_y: float,
        model: str | None = None,
    ) -> dict[str, Any]: ...

    def update_chat_title(
        self, user_id: str, workspace_id: str, chat_id: str, title: str
    ) -> None: ...

    def delete_chat(self, user_id: str, workspace_id: str, chat_id: str) -> None: ...

    def create_message(
        self, user_id: str, workspace_id: str, chat_id: str, role: str, text: str
    ) -> dict[str, Any]: ...

    def delete_message(self, user_id: str, workspace_id: str, message_id: str) -> None: ...

    def update_chat_positions(
        self,
        user_id: str,
        workspace_id: str,
        positions: dict[str, tuple[float, float]],
    ) -> None: ...

    def replace_context_edges(
        self, user_id: str, workspace_id: str, edges: list[dict[str, Any]]
    ) -> None: ...
