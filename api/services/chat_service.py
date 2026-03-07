from __future__ import annotations

from typing import Any

from schemas import CreateChatBody
from store.base import Store


class ChatService:
    def __init__(self, store: Store) -> None:
        self._store = store

    def create_chat(self, *, user_id: str, body: CreateChatBody) -> dict[str, Any]:
        return self._store.create_chat(user_id, body.title, body.position.x, body.position.y)
