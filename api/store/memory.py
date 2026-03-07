from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import HTTPException


class MemoryStore:
    """
    In-memory persistence for local boot/tests.

    Row shapes mirror Supabase-backed store.
    """

    def __init__(self) -> None:
        self._workspaces: dict[str, dict[str, Any]] = {}
        self._chats: dict[str, dict[str, Any]] = {}
        self._messages: dict[str, dict[str, Any]] = {}
        self._edges: dict[str, dict[str, Any]] = {}

    @property
    def mode(self) -> str:
        return "memory"

    def workspace_exists(self, user_id: str, workspace_id: str) -> bool:
        workspace = self._workspaces.get(workspace_id)
        return bool(workspace and workspace["user_id"] == user_id)

    def chat_exists(self, user_id: str, workspace_id: str, chat_id: str) -> bool:
        chat = self._chats.get(chat_id)
        return bool(
            chat
            and chat["user_id"] == user_id
            and chat["workspace_id"] == workspace_id
            and self.workspace_exists(user_id, workspace_id)
        )

    def list_workspaces(self, user_id: str) -> list[dict[str, Any]]:
        workspaces = [w for w in self._workspaces.values() if w["user_id"] == user_id]
        workspaces.sort(key=lambda r: r["created_at"])
        return workspaces

    def create_workspace(self, user_id: str, title: str) -> dict[str, Any]:
        workspace_id = str(uuid4())
        now = datetime.now(timezone.utc).isoformat()
        self._workspaces[workspace_id] = {
            "id": workspace_id,
            "user_id": user_id,
            "title": title,
            "created_at": now,
            "updated_at": now,
        }
        return {"id": workspace_id, "title": title}

    def update_workspace_title(self, user_id: str, workspace_id: str, title: str) -> None:
        workspace = self._workspaces.get(workspace_id)
        if not workspace or workspace["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Workspace not found")
        workspace["title"] = title
        workspace["updated_at"] = datetime.now(timezone.utc).isoformat()

    def delete_workspace(self, user_id: str, workspace_id: str) -> None:
        workspace = self._workspaces.get(workspace_id)
        if not workspace or workspace["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Workspace not found")

        del self._workspaces[workspace_id]

        removed_chat_ids = {
            chat_id
            for chat_id, chat in self._chats.items()
            if chat["user_id"] == user_id and chat["workspace_id"] == workspace_id
        }
        for chat_id in removed_chat_ids:
            del self._chats[chat_id]

        removed_message_ids = {
            message_id
            for message_id, message in self._messages.items()
            if message["user_id"] == user_id and message["chat_id"] in removed_chat_ids
        }
        for message_id in removed_message_ids:
            del self._messages[message_id]

        for edge_id, edge in list(self._edges.items()):
            if edge["user_id"] != user_id:
                continue
            if edge["to_chat_id"] in removed_chat_ids or edge["from_message_id"] in removed_message_ids:
                del self._edges[edge_id]

    def list_chats(self, user_id: str, workspace_id: str) -> list[dict[str, Any]]:
        if not self.workspace_exists(user_id, workspace_id):
            raise HTTPException(status_code=404, detail="Workspace not found")
        chats = [
            chat
            for chat in self._chats.values()
            if chat["user_id"] == user_id and chat["workspace_id"] == workspace_id
        ]
        chats.sort(key=lambda r: r["created_at"])
        return chats

    def list_messages(self, user_id: str, workspace_id: str) -> list[dict[str, Any]]:
        if not self.workspace_exists(user_id, workspace_id):
            raise HTTPException(status_code=404, detail="Workspace not found")
        workspace_chat_ids = {
            chat["id"]
            for chat in self._chats.values()
            if chat["user_id"] == user_id and chat["workspace_id"] == workspace_id
        }
        messages = [
            message
            for message in self._messages.values()
            if message["user_id"] == user_id and message["chat_id"] in workspace_chat_ids
        ]
        messages.sort(key=lambda r: (r["chat_id"], r["ordinal"]))
        return messages

    def list_messages_for_chat(
        self, user_id: str, workspace_id: str, chat_id: str
    ) -> list[dict[str, Any]]:
        if not self.workspace_exists(user_id, workspace_id):
            raise HTTPException(status_code=404, detail="Workspace not found")
        if not self.chat_exists(user_id, workspace_id, chat_id):
            return []

        messages = [
            message
            for message in self._messages.values()
            if message["user_id"] == user_id and message["chat_id"] == chat_id
        ]
        messages.sort(key=lambda r: r["ordinal"])
        return messages

    def list_context_edges(self, user_id: str, workspace_id: str) -> list[dict[str, Any]]:
        if not self.workspace_exists(user_id, workspace_id):
            raise HTTPException(status_code=404, detail="Workspace not found")
        workspace_chat_ids = {
            chat["id"]
            for chat in self._chats.values()
            if chat["user_id"] == user_id and chat["workspace_id"] == workspace_id
        }
        workspace_message_ids = {
            message["id"]
            for message in self._messages.values()
            if message["user_id"] == user_id and message["chat_id"] in workspace_chat_ids
        }
        edges = [
            edge
            for edge in self._edges.values()
            if edge["user_id"] == user_id
            and edge["to_chat_id"] in workspace_chat_ids
            and edge["from_message_id"] in workspace_message_ids
        ]
        edges.sort(key=lambda r: r["rank"])
        return edges

    def create_chat(
        self,
        user_id: str,
        workspace_id: str,
        title: str,
        position_x: float,
        position_y: float,
    ) -> dict[str, Any]:
        if not self.workspace_exists(user_id, workspace_id):
            raise HTTPException(status_code=404, detail="Workspace not found")

        chat_id = str(uuid4())
        now = datetime.now(timezone.utc).isoformat()
        self._chats[chat_id] = {
            "id": chat_id,
            "user_id": user_id,
            "workspace_id": workspace_id,
            "title": title,
            "position_x": position_x,
            "position_y": position_y,
            "created_at": now,
            "updated_at": now,
        }
        return {"id": chat_id, "title": title, "workspace_id": workspace_id}

    def update_chat_title(
        self, user_id: str, workspace_id: str, chat_id: str, title: str
    ) -> None:
        chat = self._chats.get(chat_id)
        if (
            not chat
            or chat["user_id"] != user_id
            or chat["workspace_id"] != workspace_id
            or not self.workspace_exists(user_id, workspace_id)
        ):
            raise HTTPException(status_code=404, detail="Chat not found")

        chat["title"] = title
        chat["updated_at"] = datetime.now(timezone.utc).isoformat()

    def delete_chat(self, user_id: str, workspace_id: str, chat_id: str) -> None:
        chat = self._chats.get(chat_id)
        if (
            not chat
            or chat["user_id"] != user_id
            or chat["workspace_id"] != workspace_id
            or not self.workspace_exists(user_id, workspace_id)
        ):
            raise HTTPException(status_code=404, detail="Chat not found")

        del self._chats[chat_id]

        removed_message_ids = {
            message_id
            for message_id, message in self._messages.items()
            if message["user_id"] == user_id and message["chat_id"] == chat_id
        }
        for message_id in removed_message_ids:
            del self._messages[message_id]

        for edge_id, edge in list(self._edges.items()):
            if edge["user_id"] != user_id:
                continue
            if edge["to_chat_id"] == chat_id or edge["from_message_id"] in removed_message_ids:
                del self._edges[edge_id]

    def create_message(
        self, user_id: str, workspace_id: str, chat_id: str, role: str, text: str
    ) -> dict[str, Any]:
        if not self.chat_exists(user_id, workspace_id, chat_id):
            raise HTTPException(status_code=404, detail="Chat not found")

        ordinals = [
            message["ordinal"]
            for message in self._messages.values()
            if message["user_id"] == user_id and message["chat_id"] == chat_id
        ]
        next_ordinal = (max(ordinals) + 1) if ordinals else 0

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

    def delete_message(self, user_id: str, workspace_id: str, message_id: str) -> None:
        message = self._messages.get(message_id)
        if not message or message["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Message not found")

        chat = self._chats.get(message["chat_id"])
        if not chat or chat["workspace_id"] != workspace_id or chat["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Message not found")

        del self._messages[message_id]

        for edge_id, edge in list(self._edges.items()):
            if edge["user_id"] == user_id and edge["from_message_id"] == message_id:
                del self._edges[edge_id]

    def update_chat_positions(
        self,
        user_id: str,
        workspace_id: str,
        positions: dict[str, tuple[float, float]],
    ) -> None:
        if not self.workspace_exists(user_id, workspace_id):
            raise HTTPException(status_code=404, detail="Workspace not found")

        now = datetime.now(timezone.utc).isoformat()
        for chat_id, (x, y) in positions.items():
            chat = self._chats.get(chat_id)
            if (
                chat
                and chat["user_id"] == user_id
                and chat["workspace_id"] == workspace_id
            ):
                chat["position_x"] = x
                chat["position_y"] = y
                chat["updated_at"] = now

    def replace_context_edges(
        self, user_id: str, workspace_id: str, edges: list[dict[str, Any]]
    ) -> None:
        if not self.workspace_exists(user_id, workspace_id):
            raise HTTPException(status_code=404, detail="Workspace not found")

        workspace_chat_ids = {
            chat["id"]
            for chat in self._chats.values()
            if chat["user_id"] == user_id and chat["workspace_id"] == workspace_id
        }
        workspace_message_ids = {
            message["id"]
            for message in self._messages.values()
            if message["user_id"] == user_id and message["chat_id"] in workspace_chat_ids
        }

        for edge_id, edge in list(self._edges.items()):
            if edge["user_id"] != user_id:
                continue
            if edge["to_chat_id"] in workspace_chat_ids or edge["from_message_id"] in workspace_message_ids:
                del self._edges[edge_id]

        now = datetime.now(timezone.utc).isoformat()
        for edge in edges:
            if edge["to_chat_id"] not in workspace_chat_ids:
                continue
            if edge["from_message_id"] not in workspace_message_ids:
                continue
            edge_id = str(uuid4())
            self._edges[edge_id] = {
                "id": edge_id,
                "user_id": user_id,
                "from_message_id": edge["from_message_id"],
                "to_chat_id": edge["to_chat_id"],
                "rank": edge["rank"],
                "created_at": now,
            }
