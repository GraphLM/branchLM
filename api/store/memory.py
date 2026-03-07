from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


class MemoryStore:
    def __init__(self) -> None:
        self._chats: dict[str, dict[str, Any]] = {}
        self._messages: dict[str, dict[str, Any]] = {}
        self._edges: dict[str, dict[str, Any]] = {}

    @property
    def mode(self) -> str:
        return "memory"

    def list_chats(self, user_id: str) -> list[dict[str, Any]]:
        chats = [chat for chat in self._chats.values() if chat["user_id"] == user_id]
        chats.sort(key=lambda row: row["created_at"])
        return chats

    def list_messages(self, user_id: str) -> list[dict[str, Any]]:
        messages = [message for message in self._messages.values() if message["user_id"] == user_id]
        messages.sort(key=lambda row: (row["chat_id"], row["ordinal"]))
        return messages

    def list_context_edges(self, user_id: str) -> list[dict[str, Any]]:
        edges = [edge for edge in self._edges.values() if edge["user_id"] == user_id]
        edges.sort(key=lambda row: row["rank"])
        return edges

    def create_chat(
        self, user_id: str, title: str, position_x: float, position_y: float
    ) -> dict[str, Any]:
        chat_id = str(uuid4())
        now = datetime.now(timezone.utc).isoformat()
        self._chats[chat_id] = {
            "id": chat_id,
            "user_id": user_id,
            "title": title,
            "position_x": position_x,
            "position_y": position_y,
            "created_at": now,
            "updated_at": now,
        }
        return {"id": chat_id, "title": title}

    def update_chat_positions(
        self, user_id: str, positions: dict[str, tuple[float, float]]
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        for chat_id, (x, y) in positions.items():
            chat = self._chats.get(chat_id)
            if chat and chat["user_id"] == user_id:
                chat["position_x"] = x
                chat["position_y"] = y
                chat["updated_at"] = now

    def replace_context_edges(self, user_id: str, edges: list[dict[str, Any]]) -> None:
        for edge_id, edge in list(self._edges.items()):
            if edge["user_id"] == user_id:
                del self._edges[edge_id]

        now = datetime.now(timezone.utc).isoformat()
        for edge in edges:
            edge_id = str(uuid4())
            self._edges[edge_id] = {
                "id": edge_id,
                "user_id": user_id,
                "from_message_id": edge["from_message_id"],
                "to_chat_id": edge["to_chat_id"],
                "rank": edge["rank"],
                "created_at": now,
            }
