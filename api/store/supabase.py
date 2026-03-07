from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Callable

import httpx
from fastapi import HTTPException
from postgrest.exceptions import APIError as PostgrestAPIError
from supabase import Client, create_client

from settings import Settings


class SupabaseStore:
    def __init__(self, client: Client) -> None:
        self._client = client

    @property
    def mode(self) -> str:
        return "supabase"

    @classmethod
    def from_client(cls, client: Client) -> SupabaseStore:
        return cls(client)

    @classmethod
    def from_settings(cls, settings: Settings) -> SupabaseStore:
        assert settings.supabase_url and settings.supabase_service_role_key
        client = create_client(settings.supabase_url, settings.supabase_service_role_key)
        return cls.from_client(client)

    @staticmethod
    def _postgrest_error_payload(error: PostgrestAPIError) -> dict[str, Any]:
        payload: Any = getattr(error, "json", None)
        if callable(payload):
            try:
                payload = payload()
            except Exception:
                payload = None
        if isinstance(payload, dict):
            return payload

        if error.args:
            arg0 = error.args[0]
            if isinstance(arg0, dict):
                return arg0
            if isinstance(arg0, str):
                return {"message": arg0}

        return {}

    def _wrap_postgrest(self, op: str, fn: Callable[[], Any]) -> Any:
        try:
            return fn()
        except PostgrestAPIError as e:
            payload = self._postgrest_error_payload(e)
            code = payload.get("code")
            message = str(payload.get("message") or "")
            if code == "PGRST205":
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Supabase tables not found. Run latest migrations, then retry "
                        "(you may need to reload the API schema cache)."
                    ),
                ) from e
            if code == 401 or code == "401" or "invalid api key" in message.lower():
                raise HTTPException(
                    status_code=503,
                    detail=(
                        "Supabase credentials are invalid. Ensure `SUPABASE_URL` and "
                        "`SUPABASE_SERVICE_ROLE_KEY` come from the same Supabase project."
                    ),
                ) from e
            raise HTTPException(
                status_code=500,
                detail=f"Supabase error during {op}: {payload or str(e)}",
            ) from e
        except httpx.TimeoutException as e:
            raise HTTPException(
                status_code=504,
                detail=f"Supabase timed out during {op}. Please retry.",
            ) from e
        except httpx.HTTPError as e:
            raise HTTPException(
                status_code=503,
                detail=f"Supabase is temporarily unavailable during {op}. Please retry.",
            ) from e

    def _workspace_chat_ids(self, user_id: str, workspace_id: str) -> list[str]:
        rows = (
            self._wrap_postgrest(
                "select workspace chats",
                lambda: (
                    self._client.table("chats")
                    .select("id")
                    .eq("user_id", user_id)
                    .eq("workspace_id", workspace_id)
                    .execute()
                    .data
                    or []
                ),
            )
            or []
        )
        return [row["id"] for row in rows]

    @staticmethod
    def _is_missing_chat_model_column_error(exc: HTTPException) -> bool:
        detail = str(exc.detail).lower()
        return (
            (("pgrst204" in detail) and ("'model' column" in detail) and ("chats" in detail))
            or ("42703" in detail and "chats.model" in detail)
            or ("column chats.model does not exist" in detail)
        )

    @staticmethod
    def _is_missing_chat_size_columns_error(exc: HTTPException) -> bool:
        detail = str(exc.detail).lower()
        return (
            (("pgrst204" in detail) and ("'width' column" in detail or "'height' column" in detail))
            or ("42703" in detail and ("chats.width" in detail or "chats.height" in detail))
            or ("column chats.width does not exist" in detail)
            or ("column chats.height does not exist" in detail)
        )

    @staticmethod
    def _is_missing_context_snapshot_table_error(exc: HTTPException) -> bool:
        detail = str(exc.detail).lower()
        return (
            "chat_context_messages" in detail and ("pgrst205" in detail or "not found" in detail)
        ) or ("supabase tables not found" in detail)

    def workspace_exists(self, user_id: str, workspace_id: str) -> bool:
        rows = (
            self._wrap_postgrest(
                "select workspace",
                lambda: (
                    self._client.table("workspaces")
                    .select("id")
                    .eq("id", workspace_id)
                    .eq("user_id", user_id)
                    .limit(1)
                    .execute()
                    .data
                    or []
                ),
            )
            or []
        )
        return len(rows) == 1

    def chat_exists(self, user_id: str, workspace_id: str, chat_id: str) -> bool:
        rows = (
            self._wrap_postgrest(
                "select chat",
                lambda: (
                    self._client.table("chats")
                    .select("id")
                    .eq("id", chat_id)
                    .eq("user_id", user_id)
                    .eq("workspace_id", workspace_id)
                    .limit(1)
                    .execute()
                    .data
                    or []
                ),
            )
            or []
        )
        return len(rows) == 1

    def get_chat(self, user_id: str, workspace_id: str, chat_id: str) -> dict[str, Any] | None:
        select_with_model_and_size = "id,workspace_id,title,position_x,position_y,model,width,height"
        select_with_model = "id,workspace_id,title,position_x,position_y,model"
        select_with_size = "id,workspace_id,title,position_x,position_y,width,height"
        select_minimal = "id,workspace_id,title,position_x,position_y"

        def _fetch(select_fields: str) -> list[dict[str, Any]]:
            return (
                self._wrap_postgrest(
                    "select chat row",
                    lambda: (
                        self._client.table("chats")
                        .select(select_fields)
                        .eq("id", chat_id)
                        .eq("user_id", user_id)
                        .eq("workspace_id", workspace_id)
                        .limit(1)
                        .execute()
                        .data
                        or []
                    ),
                )
                or []
            )

        try:
            rows = _fetch(select_with_model_and_size)
        except HTTPException as exc:
            missing_model = self._is_missing_chat_model_column_error(exc)
            missing_size = self._is_missing_chat_size_columns_error(exc)
            if not missing_model and not missing_size:
                raise
            select_fields = (
                select_with_size if missing_model else select_with_model if missing_size else select_minimal
            )
            try:
                rows = _fetch(select_fields)
            except HTTPException as fallback_exc:
                if not self._is_missing_chat_model_column_error(fallback_exc) and not self._is_missing_chat_size_columns_error(fallback_exc):
                    raise
                rows = _fetch(select_minimal)
        return rows[0] if rows else None

    def list_workspaces(self, user_id: str) -> list[dict[str, Any]]:
        return (
            self._wrap_postgrest(
                "select workspaces",
                lambda: (
                    self._client.table("workspaces")
                    .select("id,title")
                    .eq("user_id", user_id)
                    .order("created_at")
                    .execute()
                    .data
                    or []
                ),
            )
            or []
        )

    def create_workspace(self, user_id: str, title: str) -> dict[str, Any]:
        created = self._wrap_postgrest(
            "insert workspace",
            lambda: (
                self._client.table("workspaces")
                .insert(
                    {
                        "user_id": user_id,
                        "title": title,
                    }
                )
                .execute()
                .data
            ),
        )
        if not created:
            raise HTTPException(status_code=500, detail="Failed to create workspace")
        row = created[0]
        return {"id": row["id"], "title": row["title"]}

    def update_workspace_title(self, user_id: str, workspace_id: str, title: str) -> None:
        if not self.workspace_exists(user_id, workspace_id):
            raise HTTPException(status_code=404, detail="Workspace not found")

        now = datetime.now(timezone.utc).isoformat()
        self._wrap_postgrest(
            "update workspace title",
            lambda: (
                self._client.table("workspaces")
                .update({"title": title, "updated_at": now})
                .eq("id", workspace_id)
                .eq("user_id", user_id)
                .execute()
            ),
        )

    def delete_workspace(self, user_id: str, workspace_id: str) -> None:
        if not self.workspace_exists(user_id, workspace_id):
            raise HTTPException(status_code=404, detail="Workspace not found")

        self._wrap_postgrest(
            "delete workspace",
            lambda: (
                self._client.table("workspaces")
                .delete()
                .eq("id", workspace_id)
                .eq("user_id", user_id)
                .execute()
            ),
        )

    def list_chats(self, user_id: str, workspace_id: str) -> list[dict[str, Any]]:
        if not self.workspace_exists(user_id, workspace_id):
            raise HTTPException(status_code=404, detail="Workspace not found")

        select_with_model_and_size = "id,title,position_x,position_y,width,height,workspace_id,model"
        select_with_model = "id,title,position_x,position_y,workspace_id,model"
        select_with_size = "id,title,position_x,position_y,width,height,workspace_id"
        select_minimal = "id,title,position_x,position_y,workspace_id"

        def _fetch(select_fields: str) -> list[dict[str, Any]]:
            return (
                self._wrap_postgrest(
                    "select chats",
                    lambda: (
                        self._client.table("chats")
                        .select(select_fields)
                        .eq("user_id", user_id)
                        .eq("workspace_id", workspace_id)
                        .order("created_at")
                        .execute()
                        .data
                        or []
                    ),
                )
                or []
            )

        try:
            return _fetch(select_with_model_and_size)
        except HTTPException as exc:
            missing_model = self._is_missing_chat_model_column_error(exc)
            missing_size = self._is_missing_chat_size_columns_error(exc)
            if not missing_model and not missing_size:
                raise
            select_fields = (
                select_with_size if missing_model else select_with_model if missing_size else select_minimal
            )
            try:
                return _fetch(select_fields)
            except HTTPException as fallback_exc:
                if not self._is_missing_chat_model_column_error(fallback_exc) and not self._is_missing_chat_size_columns_error(fallback_exc):
                    raise
                return _fetch(select_minimal)

    def list_messages(self, user_id: str, workspace_id: str) -> list[dict[str, Any]]:
        chat_ids = self._workspace_chat_ids(user_id, workspace_id)
        if not chat_ids:
            return []

        return (
            self._wrap_postgrest(
                "select messages",
                lambda: (
                    self._client.table("messages")
                    .select("id,chat_id,ordinal,role,text")
                    .eq("user_id", user_id)
                    .in_("chat_id", chat_ids)
                    .order("chat_id")
                    .order("ordinal")
                    .execute()
                    .data
                    or []
                ),
            )
            or []
        )

    def list_messages_for_chat(
        self, user_id: str, workspace_id: str, chat_id: str
    ) -> list[dict[str, Any]]:
        if not self.chat_exists(user_id, workspace_id, chat_id):
            return []

        return (
            self._wrap_postgrest(
                "select chat messages",
                lambda: (
                    self._client.table("messages")
                    .select("id,chat_id,ordinal,role,text")
                    .eq("user_id", user_id)
                    .eq("chat_id", chat_id)
                    .order("ordinal")
                    .execute()
                    .data
                    or []
                ),
            )
            or []
        )

    def list_context_edges(self, user_id: str, workspace_id: str) -> list[dict[str, Any]]:
        chat_ids = self._workspace_chat_ids(user_id, workspace_id)
        if not chat_ids:
            return []

        return (
            self._wrap_postgrest(
                "select context_edges",
                lambda: (
                    self._client.table("context_edges")
                    .select("from_message_id,to_chat_id,rank")
                    .eq("user_id", user_id)
                    .in_("to_chat_id", chat_ids)
                    .order("rank")
                    .execute()
                    .data
                    or []
                ),
            )
            or []
        )

    def list_context_messages_for_chat(
        self, user_id: str, workspace_id: str, chat_id: str
    ) -> list[dict[str, Any]]:
        if not self.chat_exists(user_id, workspace_id, chat_id):
            return []
        try:
            return (
                self._wrap_postgrest(
                    "select context message snapshots",
                    lambda: (
                        self._client.table("chat_context_messages")
                        .select("message_id,role,text,rank")
                        .eq("user_id", user_id)
                        .eq("to_chat_id", chat_id)
                        .order("rank")
                        .execute()
                        .data
                        or []
                    ),
                )
                or []
            )
        except HTTPException as exc:
            if self._is_missing_context_snapshot_table_error(exc):
                return []
            raise

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

        payload = {
            "user_id": user_id,
            "workspace_id": workspace_id,
            "title": title,
            "position_x": position_x,
            "position_y": position_y,
            "width": 440.0,
            "height": 360.0,
        }
        if model:
            payload["model"] = model

        try:
            created = self._wrap_postgrest(
                "insert chat",
                lambda: self._client.table("chats").insert(payload).execute().data,
            )
        except HTTPException as exc:
            missing_model = model and self._is_missing_chat_model_column_error(exc)
            missing_size = self._is_missing_chat_size_columns_error(exc)
            if not missing_model and not missing_size:
                raise
            if missing_model:
                payload.pop("model", None)
            if missing_size:
                payload.pop("width", None)
                payload.pop("height", None)
            created = self._wrap_postgrest(
                "insert chat",
                lambda: self._client.table("chats").insert(payload).execute().data,
            )
        if not created:
            raise HTTPException(status_code=500, detail="Failed to create chat")
        row = created[0]
        return {
            "id": row["id"],
            "title": row["title"],
            "workspace_id": row["workspace_id"],
            "model": row.get("model"),
        }

    def update_chat_title(self, user_id: str, workspace_id: str, chat_id: str, title: str) -> None:
        if not self.chat_exists(user_id, workspace_id, chat_id):
            raise HTTPException(status_code=404, detail="Chat not found")

        now = datetime.now(timezone.utc).isoformat()
        self._wrap_postgrest(
            "update chat title",
            lambda: (
                self._client.table("chats")
                .update({"title": title, "updated_at": now})
                .eq("id", chat_id)
                .eq("user_id", user_id)
                .eq("workspace_id", workspace_id)
                .execute()
            ),
        )

    def delete_chat(self, user_id: str, workspace_id: str, chat_id: str) -> None:
        if not self.chat_exists(user_id, workspace_id, chat_id):
            raise HTTPException(status_code=404, detail="Chat not found")

        self._wrap_postgrest(
            "delete chat",
            lambda: (
                self._client.table("chats")
                .delete()
                .eq("id", chat_id)
                .eq("user_id", user_id)
                .eq("workspace_id", workspace_id)
                .execute()
            ),
        )

    def create_message(
        self, user_id: str, workspace_id: str, chat_id: str, role: str, text: str
    ) -> dict[str, Any]:
        if not self.chat_exists(user_id, workspace_id, chat_id):
            raise HTTPException(status_code=404, detail="Chat not found")

        latest = self._wrap_postgrest(
            "select latest message ordinal",
            lambda: (
                self._client.table("messages")
                .select("ordinal")
                .eq("user_id", user_id)
                .eq("chat_id", chat_id)
                .order("ordinal", desc=True)
                .limit(1)
                .execute()
                .data
                or []
            ),
        )
        next_ordinal = (latest[0]["ordinal"] + 1) if latest else 0

        created = self._wrap_postgrest(
            "insert message",
            lambda: (
                self._client.table("messages")
                .insert(
                    {
                        "user_id": user_id,
                        "chat_id": chat_id,
                        "ordinal": next_ordinal,
                        "role": role,
                        "text": text,
                    }
                )
                .execute()
                .data
            ),
        )
        if not created:
            raise HTTPException(status_code=500, detail="Failed to create message")
        row = created[0]
        return {"id": row["id"], "ordinal": row["ordinal"]}

    def delete_message(self, user_id: str, workspace_id: str, message_id: str) -> None:
        message_rows = (
            self._wrap_postgrest(
                "select message",
                lambda: (
                    self._client.table("messages")
                    .select("id,chat_id")
                    .eq("id", message_id)
                    .eq("user_id", user_id)
                    .limit(1)
                    .execute()
                    .data
                    or []
                ),
            )
            or []
        )
        if not message_rows:
            raise HTTPException(status_code=404, detail="Message not found")

        if not self.chat_exists(user_id, workspace_id, message_rows[0]["chat_id"]):
            raise HTTPException(status_code=404, detail="Message not found")

        self._wrap_postgrest(
            "delete message",
            lambda: (
                self._client.table("messages")
                .delete()
                .eq("id", message_id)
                .eq("user_id", user_id)
                .execute()
            ),
        )

    def update_chat_layout(
        self,
        user_id: str,
        workspace_id: str,
        positions: dict[str, tuple[float, float]],
        sizes: dict[str, tuple[float, float]],
    ) -> None:
        if not self.workspace_exists(user_id, workspace_id):
            raise HTTPException(status_code=404, detail="Workspace not found")

        now = datetime.now(timezone.utc).isoformat()
        target_chat_ids = set(positions) | set(sizes)
        for chat_id in target_chat_ids:
            if not self.chat_exists(user_id, workspace_id, chat_id):
                continue
            payload: dict[str, Any] = {"updated_at": now}
            if chat_id in positions:
                x, y = positions[chat_id]
                payload["position_x"] = x
                payload["position_y"] = y
            if chat_id in sizes:
                width, height = sizes[chat_id]
                payload["width"] = width
                payload["height"] = height

            try:
                self._wrap_postgrest(
                    "update chat layout",
                    lambda chat_id=chat_id, payload=payload: (
                        self._client.table("chats")
                        .update(payload)
                        .eq("id", chat_id)
                        .eq("user_id", user_id)
                        .eq("workspace_id", workspace_id)
                        .execute()
                    ),
                )
            except HTTPException as exc:
                if "width" not in payload and "height" not in payload:
                    raise
                if not self._is_missing_chat_size_columns_error(exc):
                    raise
                payload_without_size = {
                    key: value for key, value in payload.items() if key not in {"width", "height"}
                }
                self._wrap_postgrest(
                    "update chat layout",
                    lambda chat_id=chat_id, payload_without_size=payload_without_size: (
                        self._client.table("chats")
                        .update(payload_without_size)
                        .eq("id", chat_id)
                        .eq("user_id", user_id)
                        .eq("workspace_id", workspace_id)
                        .execute()
                    ),
                )

    def replace_context_edges(
        self, user_id: str, workspace_id: str, edges: list[dict[str, Any]]
    ) -> None:
        chat_ids = self._workspace_chat_ids(user_id, workspace_id)

        if chat_ids:
            self._wrap_postgrest(
                "delete context_edges",
                lambda: (
                    self._client.table("context_edges")
                    .delete()
                    .eq("user_id", user_id)
                    .in_("to_chat_id", chat_ids)
                    .execute()
                ),
            )
            try:
                self._wrap_postgrest(
                    "delete context snapshots",
                    lambda: (
                        self._client.table("chat_context_messages")
                        .delete()
                        .eq("user_id", user_id)
                        .in_("to_chat_id", chat_ids)
                        .execute()
                    ),
                )
            except HTTPException as exc:
                if not self._is_missing_context_snapshot_table_error(exc):
                    raise

        if not edges:
            return

        rows = []
        grouped_edges: dict[str, list[dict[str, Any]]] = {}
        for edge in edges:
            if edge["to_chat_id"] not in chat_ids:
                continue
            row = {
                "user_id": user_id,
                "from_message_id": edge["from_message_id"],
                "to_chat_id": edge["to_chat_id"],
                "rank": edge["rank"],
            }
            rows.append(row)
            grouped_edges.setdefault(edge["to_chat_id"], []).append(row)

        if rows:
            self._wrap_postgrest(
                "insert context_edges",
                lambda: self._client.table("context_edges").insert(rows).execute(),
            )

        messages = self.list_messages(user_id, workspace_id)
        messages_by_id = {message["id"]: message for message in messages}
        messages_by_chat: dict[str, list[dict[str, Any]]] = {}
        for message in messages:
            messages_by_chat.setdefault(message["chat_id"], []).append(message)
        for chat_messages in messages_by_chat.values():
            chat_messages.sort(key=lambda message: message["ordinal"])

        snapshot_rows: list[dict[str, Any]] = []
        for to_chat_id, target_edges in grouped_edges.items():
            target_edges.sort(key=lambda edge: edge["rank"])
            seen_message_ids: set[str] = set()
            rank = 0
            for edge in target_edges:
                source_message = messages_by_id.get(edge["from_message_id"])
                if not source_message:
                    continue
                source_chat_messages = messages_by_chat.get(source_message["chat_id"], [])
                include_until_ordinal = source_message["ordinal"]
                if source_message["role"] == "user":
                    include_until_ordinal -= 1

                for message in source_chat_messages:
                    if message["ordinal"] > include_until_ordinal:
                        break
                    if message["id"] in seen_message_ids:
                        continue
                    seen_message_ids.add(message["id"])
                    snapshot_rows.append(
                        {
                            "user_id": user_id,
                            "to_chat_id": to_chat_id,
                            "message_id": message["id"],
                            "role": message["role"],
                            "text": message["text"],
                            "rank": rank,
                        }
                    )
                    rank += 1

        if snapshot_rows:
            try:
                self._wrap_postgrest(
                    "insert context snapshots",
                    lambda: (
                        self._client.table("chat_context_messages").insert(snapshot_rows).execute()
                    ),
                )
            except HTTPException as exc:
                if not self._is_missing_context_snapshot_table_error(exc):
                    raise
