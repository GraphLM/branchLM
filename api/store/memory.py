from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


class MemoryStore:
    def __init__(self) -> None:
        self._chats: dict[str, dict[str, Any]] = {}

    @property
    def mode(self) -> str:
        return "memory"

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
