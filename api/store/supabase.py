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

    def _wrap_postgrest(self, op: str, fn: Callable[[], Any]) -> Any:
        try:
            return fn()
        except PostgrestAPIError as e:
            code = (e.json or {}).get("code")
            if code == "PGRST205":
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Supabase tables not found. Run `api/supabase_schema.sql` in your Supabase "
                        "SQL editor, then retry (you may need to reload the API schema cache)."
                    ),
                ) from e
            raise HTTPException(
                status_code=500,
                detail=f"Supabase error during {op}: {e.json}",
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

    def list_chats(self, user_id: str) -> list[dict[str, Any]]:
        return (
            self._wrap_postgrest(
                "select chats",
                lambda: (
                    self._client.table("chats")
                    .select("id,title,position_x,position_y")
                    .eq("user_id", user_id)
                    .order("created_at")
                    .execute()
                    .data
                    or []
                ),
            )
            or []
        )

    def list_messages(self, user_id: str) -> list[dict[str, Any]]:
        return (
            self._wrap_postgrest(
                "select messages",
                lambda: (
                    self._client.table("messages")
                    .select("id,chat_id,ordinal,role,text")
                    .eq("user_id", user_id)
                    .order("chat_id")
                    .order("ordinal")
                    .execute()
                    .data
                    or []
                ),
            )
            or []
        )

    def list_messages_for_chat(self, user_id: str, chat_id: str) -> list[dict[str, Any]]:
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

    def list_context_edges(self, user_id: str) -> list[dict[str, Any]]:
        return (
            self._wrap_postgrest(
                "select context_edges",
                lambda: (
                    self._client.table("context_edges")
                    .select("from_message_id,to_chat_id,rank")
                    .eq("user_id", user_id)
                    .order("rank")
                    .execute()
                    .data
                    or []
                ),
            )
            or []
        )

    def create_chat(
        self, user_id: str, title: str, position_x: float, position_y: float
    ) -> dict[str, Any]:
        created = self._wrap_postgrest(
            "insert chat",
            lambda: (
                self._client.table("chats")
                .insert(
                    {
                        "user_id": user_id,
                        "title": title,
                        "position_x": position_x,
                        "position_y": position_y,
                    }
                )
                .execute()
                .data
            ),
        )
        if not created:
            raise HTTPException(status_code=500, detail="Failed to create chat")
        row = created[0]
        return {"id": row["id"], "title": row["title"]}

    def update_chat_title(self, user_id: str, chat_id: str, title: str) -> None:
        now = datetime.now(timezone.utc).isoformat()
        self._wrap_postgrest(
            "update chat title",
            lambda: (
                self._client.table("chats")
                .update({"title": title, "updated_at": now})
                .eq("id", chat_id)
                .eq("user_id", user_id)
                .execute()
            ),
        )

    def delete_chat(self, user_id: str, chat_id: str) -> None:
        self._wrap_postgrest(
            "delete chat",
            lambda: (
                self._client.table("chats")
                .delete()
                .eq("id", chat_id)
                .eq("user_id", user_id)
                .execute()
            ),
        )

    def create_message(self, user_id: str, chat_id: str, role: str, text: str) -> dict[str, Any]:
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

    def delete_message(self, user_id: str, message_id: str) -> None:
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

    def update_chat_positions(
        self, user_id: str, positions: dict[str, tuple[float, float]]
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        for chat_id, (x, y) in positions.items():
            self._wrap_postgrest(
                "update chat layout",
                lambda chat_id=chat_id, x=x, y=y: (
                    self._client.table("chats")
                    .update({"position_x": x, "position_y": y, "updated_at": now})
                    .eq("id", chat_id)
                    .eq("user_id", user_id)
                    .execute()
                ),
            )

    def replace_context_edges(self, user_id: str, edges: list[dict[str, Any]]) -> None:
        self._wrap_postgrest(
            "delete context_edges",
            lambda: self._client.table("context_edges").delete().eq("user_id", user_id).execute(),
        )
        if not edges:
            return
        rows = [
            {
                "user_id": user_id,
                "from_message_id": e["from_message_id"],
                "to_chat_id": e["to_chat_id"],
                "rank": e["rank"],
            }
            for e in edges
        ]
        self._wrap_postgrest(
            "insert context_edges",
            lambda: self._client.table("context_edges").insert(rows).execute(),
        )
