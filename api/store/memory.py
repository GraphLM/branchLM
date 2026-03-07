from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


class MemoryStore:
    """
    Simple in-memory persistence for first boot/tests.

    Row shapes intentionally match what Supabase returns / what the service expects:
    - chats: {id, user_id, title, position_x, position_y, created_at, updated_at}
    - messages: {id, user_id, chat_id, ordinal, role, text, created_at}
    - context_edges: {id, user_id, from_message_id, to_chat_id, rank, created_at}
    """

    def __init__(self) -> None:
        self._chats: dict[str, dict[str, Any]] = {}
        self._messages: dict[str, dict[str, Any]] = {}
        self._edges: dict[str, dict[str, Any]] = {}

    @property
    def mode(self) -> str:
        return "memory"

    def list_chats(self, user_id: str) -> list[dict[str, Any]]:
        chats = [c for c in self._chats.values() if c["user_id"] == user_id]
        chats.sort(key=lambda r: r["created_at"])
        return chats

    def list_messages(self, user_id: str) -> list[dict[str, Any]]:
        messages = [m for m in self._messages.values() if m["user_id"] == user_id]
        messages.sort(key=lambda r: (r["chat_id"], r["ordinal"]))
        return messages

    def list_messages_for_chat(self, user_id: str, chat_id: str) -> list[dict[str, Any]]:
        messages = [
            m
            for m in self._messages.values()
            if m["user_id"] == user_id and m["chat_id"] == chat_id
        ]
        messages.sort(key=lambda r: r["ordinal"])
        return messages

    def list_context_edges(self, user_id: str) -> list[dict[str, Any]]:
        edges = [e for e in self._edges.values() if e["user_id"] == user_id]
        edges.sort(key=lambda r: r["rank"])
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

    def update_chat_title(self, user_id: str, chat_id: str, title: str) -> None:
        c = self._chats.get(chat_id)
        if c and c["user_id"] == user_id:
            c["title"] = title
            c["updated_at"] = datetime.now(timezone.utc).isoformat()

    def delete_chat(self, user_id: str, chat_id: str) -> None:
        c = self._chats.get(chat_id)
        if not c or c["user_id"] != user_id:
            return
        del self._chats[chat_id]

        removed_message_ids = {
            mid
            for mid, m in self._messages.items()
            if m["chat_id"] == chat_id and m["user_id"] == user_id
        }
        for mid in removed_message_ids:
            del self._messages[mid]

        for eid, e in list(self._edges.items()):
            if e["user_id"] != user_id:
                continue
            if e["to_chat_id"] == chat_id or e["from_message_id"] in removed_message_ids:
                del self._edges[eid]

    def create_message(self, user_id: str, chat_id: str, role: str, text: str) -> dict[str, Any]:
        ords = [
            m["ordinal"]
            for m in self._messages.values()
            if m["user_id"] == user_id and m["chat_id"] == chat_id
        ]
        next_ordinal = (max(ords) + 1) if ords else 0

        message_id = str(uuid4())
        now = datetime.now(timezone.utc).isoformat()
        self._messages[message_id] = {
            "id": message_id,
            "user_id": user_id,
            "chat_id": chat_id,
            "ordinal": next_ordinal,
            "role": role,
            "text": text,
            "created_at": now,
        }
        return {"id": message_id, "ordinal": next_ordinal}

    def delete_message(self, user_id: str, message_id: str) -> None:
        m = self._messages.get(message_id)
        if not m or m["user_id"] != user_id:
            return
        del self._messages[message_id]

        for eid, e in list(self._edges.items()):
            if e["user_id"] == user_id and e["from_message_id"] == message_id:
                del self._edges[eid]

    def update_chat_positions(
        self, user_id: str, positions: dict[str, tuple[float, float]]
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        for chat_id, (x, y) in positions.items():
            c = self._chats.get(chat_id)
            if c and c["user_id"] == user_id:
                c["position_x"] = x
                c["position_y"] = y
                c["updated_at"] = now

    def replace_context_edges(self, user_id: str, edges: list[dict[str, Any]]) -> None:
        # Replace context edges for this user (simple + deterministic).
        for edge_id, edge in list(self._edges.items()):
            if edge["user_id"] == user_id:
                del self._edges[edge_id]

        now = datetime.now(timezone.utc).isoformat()
        for e in edges:
            edge_id = str(uuid4())
            self._edges[edge_id] = {
                "id": edge_id,
                "user_id": user_id,
                "from_message_id": e["from_message_id"],
                "to_chat_id": e["to_chat_id"],
                "rank": e["rank"],
                "created_at": now,
            }
