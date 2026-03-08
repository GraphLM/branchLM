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
        self._context_messages: dict[str, dict[str, Any]] = {}
        self._context_nodes: dict[str, dict[str, Any]] = {}
        self._context_node_edges: dict[str, dict[str, Any]] = {}
        self._context_node_assets: dict[str, dict[str, Any]] = {}

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

    def get_chat(self, user_id: str, workspace_id: str, chat_id: str) -> dict[str, Any] | None:
        chat = self._chats.get(chat_id)
        if not chat:
            return None
        if chat["user_id"] != user_id or chat["workspace_id"] != workspace_id:
            return None
        return chat

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
        removed_context_node_ids = {
            node_id
            for node_id, node in self._context_nodes.items()
            if node["user_id"] == user_id and node["workspace_id"] == workspace_id
        }
        for node_id in removed_context_node_ids:
            del self._context_nodes[node_id]

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
            if (
                edge["to_chat_id"] in removed_chat_ids
                or edge["from_message_id"] in removed_message_ids
            ):
                del self._edges[edge_id]
        for snapshot_id, snapshot in list(self._context_messages.items()):
            if snapshot["user_id"] != user_id:
                continue
            if (
                snapshot["to_chat_id"] in removed_chat_ids
                or snapshot["message_id"] in removed_message_ids
            ):
                del self._context_messages[snapshot_id]
        for edge_id, edge in list(self._context_node_edges.items()):
            if edge["user_id"] != user_id:
                continue
            if (
                edge["to_chat_id"] in removed_chat_ids
                or edge["from_context_node_id"] in removed_context_node_ids
            ):
                del self._context_node_edges[edge_id]
        for asset_id, asset in list(self._context_node_assets.items()):
            if asset["user_id"] != user_id:
                continue
            if asset["context_node_id"] in removed_context_node_ids:
                del self._context_node_assets[asset_id]

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

    def list_context_nodes(self, user_id: str, workspace_id: str) -> list[dict[str, Any]]:
        if not self.workspace_exists(user_id, workspace_id):
            raise HTTPException(status_code=404, detail="Workspace not found")
        nodes = [
            node
            for node in self._context_nodes.values()
            if node["user_id"] == user_id and node["workspace_id"] == workspace_id
        ]
        nodes.sort(key=lambda n: n["created_at"])
        return nodes

    def list_context_node_edges(self, user_id: str, workspace_id: str) -> list[dict[str, Any]]:
        if not self.workspace_exists(user_id, workspace_id):
            raise HTTPException(status_code=404, detail="Workspace not found")
        chat_ids = {
            chat["id"]
            for chat in self._chats.values()
            if chat["user_id"] == user_id and chat["workspace_id"] == workspace_id
        }
        context_node_ids = {
            node["id"]
            for node in self._context_nodes.values()
            if node["user_id"] == user_id and node["workspace_id"] == workspace_id
        }
        edges = [
            edge
            for edge in self._context_node_edges.values()
            if edge["user_id"] == user_id
            and edge["to_chat_id"] in chat_ids
            and edge["from_context_node_id"] in context_node_ids
        ]
        edges.sort(key=lambda e: e["rank"])
        return edges

    def list_context_messages_for_chat(
        self, user_id: str, workspace_id: str, chat_id: str
    ) -> list[dict[str, Any]]:
        if not self.chat_exists(user_id, workspace_id, chat_id):
            return []
        rows = [
            row
            for row in self._context_messages.values()
            if row["user_id"] == user_id and row["to_chat_id"] == chat_id
        ]
        rows.sort(key=lambda r: r["rank"])
        return rows

    def list_context_nodes_for_chat(
        self, user_id: str, workspace_id: str, chat_id: str
    ) -> list[dict[str, Any]]:
        if not self.chat_exists(user_id, workspace_id, chat_id):
            return []
        nodes_by_id = {
            node["id"]: node
            for node in self._context_nodes.values()
            if node["user_id"] == user_id and node["workspace_id"] == workspace_id
        }
        linked_edges = [
            edge
            for edge in self._context_node_edges.values()
            if edge["user_id"] == user_id and edge["to_chat_id"] == chat_id
        ]
        linked_edges.sort(key=lambda edge: edge["rank"])
        result: list[dict[str, Any]] = []
        for edge in linked_edges:
            node = nodes_by_id.get(edge["from_context_node_id"])
            if node:
                result.append(node)
        return result

    def list_context_node_assets(
        self, user_id: str, workspace_id: str, context_node_id: str
    ) -> list[dict[str, Any]]:
        node = self._context_nodes.get(context_node_id)
        if (
            not node
            or node["user_id"] != user_id
            or node["workspace_id"] != workspace_id
            or not self.workspace_exists(user_id, workspace_id)
        ):
            return []
        assets = [
            asset
            for asset in self._context_node_assets.values()
            if asset["user_id"] == user_id and asset["context_node_id"] == context_node_id
        ]
        assets.sort(key=lambda asset: asset["created_at"])
        return assets

    def create_chat(
        self,
        user_id: str,
        workspace_id: str,
        title: str,
        position_x: float,
        position_y: float,
        model: str | None = None,
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
            "model": model,
            "created_at": now,
            "updated_at": now,
        }
        return {"id": chat_id, "title": title, "workspace_id": workspace_id, "model": model}

    def update_chat_title(self, user_id: str, workspace_id: str, chat_id: str, title: str) -> None:
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
        for snapshot_id, snapshot in list(self._context_messages.items()):
            if snapshot["user_id"] != user_id:
                continue
            if snapshot["to_chat_id"] == chat_id or snapshot["message_id"] in removed_message_ids:
                del self._context_messages[snapshot_id]
        for edge_id, edge in list(self._context_node_edges.items()):
            if edge["user_id"] == user_id and edge["to_chat_id"] == chat_id:
                del self._context_node_edges[edge_id]

    def create_context_node(
        self,
        user_id: str,
        workspace_id: str,
        title: str,
        position_x: float,
        position_y: float,
        backboard_thread_id: str | None,
    ) -> dict[str, Any]:
        if not self.workspace_exists(user_id, workspace_id):
            raise HTTPException(status_code=404, detail="Workspace not found")
        node_id = str(uuid4())
        now = datetime.now(timezone.utc).isoformat()
        row = {
            "id": node_id,
            "user_id": user_id,
            "workspace_id": workspace_id,
            "title": title,
            "position_x": position_x,
            "position_y": position_y,
            "backboard_thread_id": backboard_thread_id,
            "created_at": now,
            "updated_at": now,
        }
        self._context_nodes[node_id] = row
        return row

    def delete_context_node(self, user_id: str, workspace_id: str, context_node_id: str) -> None:
        node = self._context_nodes.get(context_node_id)
        if (
            not node
            or node["user_id"] != user_id
            or node["workspace_id"] != workspace_id
            or not self.workspace_exists(user_id, workspace_id)
        ):
            raise HTTPException(status_code=404, detail="Context node not found")
        del self._context_nodes[context_node_id]
        for edge_id, edge in list(self._context_node_edges.items()):
            if edge["user_id"] == user_id and edge["from_context_node_id"] == context_node_id:
                del self._context_node_edges[edge_id]
        for asset_id, asset in list(self._context_node_assets.items()):
            if asset["user_id"] == user_id and asset["context_node_id"] == context_node_id:
                del self._context_node_assets[asset_id]

    def create_context_node_asset(
        self,
        user_id: str,
        workspace_id: str,
        context_node_id: str,
        file_name: str,
        mime_type: str,
        size_bytes: int,
        backboard_document_id: str | None,
        status: str,
        status_message: str | None,
    ) -> dict[str, Any]:
        node = self._context_nodes.get(context_node_id)
        if (
            not node
            or node["user_id"] != user_id
            or node["workspace_id"] != workspace_id
            or not self.workspace_exists(user_id, workspace_id)
        ):
            raise HTTPException(status_code=404, detail="Context node not found")
        asset_id = str(uuid4())
        now = datetime.now(timezone.utc).isoformat()
        row = {
            "id": asset_id,
            "user_id": user_id,
            "context_node_id": context_node_id,
            "file_name": file_name,
            "mime_type": mime_type,
            "size_bytes": size_bytes,
            "backboard_document_id": backboard_document_id,
            "status": status,
            "status_message": status_message,
            "created_at": now,
            "updated_at": now,
        }
        self._context_node_assets[asset_id] = row
        return row

    def delete_context_node_assets(
        self, user_id: str, workspace_id: str, context_node_id: str
    ) -> None:
        node = self._context_nodes.get(context_node_id)
        if (
            not node
            or node["user_id"] != user_id
            or node["workspace_id"] != workspace_id
            or not self.workspace_exists(user_id, workspace_id)
        ):
            raise HTTPException(status_code=404, detail="Context node not found")
        for asset_id, asset in list(self._context_node_assets.items()):
            if asset["user_id"] == user_id and asset["context_node_id"] == context_node_id:
                del self._context_node_assets[asset_id]

    def update_context_node_thread_id(
        self,
        user_id: str,
        workspace_id: str,
        context_node_id: str,
        backboard_thread_id: str | None,
    ) -> None:
        node = self._context_nodes.get(context_node_id)
        if (
            not node
            or node["user_id"] != user_id
            or node["workspace_id"] != workspace_id
            or not self.workspace_exists(user_id, workspace_id)
        ):
            raise HTTPException(status_code=404, detail="Context node not found")
        node["backboard_thread_id"] = backboard_thread_id
        node["updated_at"] = datetime.now(timezone.utc).isoformat()

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
        for snapshot_id, snapshot in list(self._context_messages.items()):
            if snapshot["user_id"] == user_id and snapshot["message_id"] == message_id:
                del self._context_messages[snapshot_id]

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
            if chat and chat["user_id"] == user_id and chat["workspace_id"] == workspace_id:
                chat["position_x"] = x
                chat["position_y"] = y
                chat["updated_at"] = now

    def update_context_node_positions(
        self,
        user_id: str,
        workspace_id: str,
        positions: dict[str, tuple[float, float]],
    ) -> None:
        if not self.workspace_exists(user_id, workspace_id):
            raise HTTPException(status_code=404, detail="Workspace not found")
        now = datetime.now(timezone.utc).isoformat()
        for context_node_id, (x, y) in positions.items():
            node = self._context_nodes.get(context_node_id)
            if (
                node
                and node["user_id"] == user_id
                and node["workspace_id"] == workspace_id
            ):
                node["position_x"] = x
                node["position_y"] = y
                node["updated_at"] = now

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
            if (
                edge["to_chat_id"] in workspace_chat_ids
                or edge["from_message_id"] in workspace_message_ids
            ):
                del self._edges[edge_id]
        for snapshot_id, snapshot in list(self._context_messages.items()):
            if snapshot["user_id"] != user_id:
                continue
            if snapshot["to_chat_id"] in workspace_chat_ids:
                del self._context_messages[snapshot_id]

        now = datetime.now(timezone.utc).isoformat()
        edges_by_target: dict[str, list[dict[str, Any]]] = {}
        for edge in edges:
            if edge["to_chat_id"] not in workspace_chat_ids:
                continue
            if edge["from_message_id"] not in workspace_message_ids:
                continue
            edge_id = str(uuid4())
            edge_row = {
                "id": edge_id,
                "user_id": user_id,
                "from_message_id": edge["from_message_id"],
                "to_chat_id": edge["to_chat_id"],
                "rank": edge["rank"],
                "created_at": now,
            }
            self._edges[edge_id] = edge_row
            edges_by_target.setdefault(edge_row["to_chat_id"], []).append(edge_row)

        messages_by_chat: dict[str, list[dict[str, Any]]] = {}
        for message in self._messages.values():
            if message["user_id"] != user_id:
                continue
            if message["chat_id"] not in workspace_chat_ids:
                continue
            messages_by_chat.setdefault(message["chat_id"], []).append(message)
        for chat_messages in messages_by_chat.values():
            chat_messages.sort(key=lambda m: m["ordinal"])
        messages_by_id = {
            message["id"]: message
            for message in self._messages.values()
            if message["user_id"] == user_id and message["chat_id"] in workspace_chat_ids
        }

        for to_chat_id, target_edges in edges_by_target.items():
            target_edges.sort(key=lambda edge: edge["rank"])
            seen: set[str] = set()
            rank = 0
            for edge in target_edges:
                source_message = messages_by_id.get(edge["from_message_id"])
                if not source_message:
                    continue
                source_chat_messages = messages_by_chat.get(source_message["chat_id"], [])
                include_until = source_message["ordinal"]
                if source_message["role"] == "user":
                    include_until -= 1
                for message in source_chat_messages:
                    if message["ordinal"] > include_until:
                        break
                    if message["id"] in seen:
                        continue
                    seen.add(message["id"])
                    snapshot_id = str(uuid4())
                    self._context_messages[snapshot_id] = {
                        "id": snapshot_id,
                        "user_id": user_id,
                        "to_chat_id": to_chat_id,
                        "message_id": message["id"],
                        "role": message["role"],
                        "text": message["text"],
                        "rank": rank,
                        "created_at": now,
                    }
                    rank += 1

    def replace_context_node_edges(
        self, user_id: str, workspace_id: str, edges: list[dict[str, Any]]
    ) -> None:
        if not self.workspace_exists(user_id, workspace_id):
            raise HTTPException(status_code=404, detail="Workspace not found")
        chat_ids = {
            chat["id"]
            for chat in self._chats.values()
            if chat["user_id"] == user_id and chat["workspace_id"] == workspace_id
        }
        context_node_ids = {
            node["id"]
            for node in self._context_nodes.values()
            if node["user_id"] == user_id and node["workspace_id"] == workspace_id
        }
        for edge_id, edge in list(self._context_node_edges.items()):
            if edge["user_id"] != user_id:
                continue
            if (
                edge["to_chat_id"] in chat_ids
                or edge["from_context_node_id"] in context_node_ids
            ):
                del self._context_node_edges[edge_id]

        now = datetime.now(timezone.utc).isoformat()
        for edge in edges:
            if edge["to_chat_id"] not in chat_ids:
                continue
            if edge["from_context_node_id"] not in context_node_ids:
                continue
            edge_id = str(uuid4())
            self._context_node_edges[edge_id] = {
                "id": edge_id,
                "user_id": user_id,
                "from_context_node_id": edge["from_context_node_id"],
                "to_chat_id": edge["to_chat_id"],
                "rank": edge["rank"],
                "created_at": now,
            }
