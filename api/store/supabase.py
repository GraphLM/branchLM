from __future__ import annotations

from typing import Any

import httpx
from fastapi import HTTPException
from postgrest.exceptions import APIError as PostgrestAPIError
from supabase import Client


class SupabaseStore:
    def __init__(self, client: Client) -> None:
        self._client = client

    @property
    def mode(self) -> str:
        return "supabase"

    @classmethod
    def from_client(cls, client: Client) -> "SupabaseStore":
        return cls(client)

    def list_chats(self, user_id: str) -> list[dict[str, Any]]:
        try:
            return (
                self._client.table("chats")
                .select("id,title,position_x,position_y")
                .eq("user_id", user_id)
                .order("created_at")
                .execute()
                .data
                or []
            )
        except PostgrestAPIError as exc:
            raise HTTPException(status_code=500, detail=f"Supabase error: {exc.json}") from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=503, detail="Supabase is temporarily unavailable") from exc

    def list_messages(self, user_id: str) -> list[dict[str, Any]]:
        try:
            return (
                self._client.table("messages")
                .select("id,chat_id,ordinal,role,text")
                .eq("user_id", user_id)
                .order("chat_id")
                .order("ordinal")
                .execute()
                .data
                or []
            )
        except PostgrestAPIError as exc:
            raise HTTPException(status_code=500, detail=f"Supabase error: {exc.json}") from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=503, detail="Supabase is temporarily unavailable") from exc

    def list_messages_for_chat(self, user_id: str, chat_id: str) -> list[dict[str, Any]]:
        try:
            return (
                self._client.table("messages")
                .select("id,chat_id,ordinal,role,text")
                .eq("user_id", user_id)
                .eq("chat_id", chat_id)
                .order("ordinal")
                .execute()
                .data
                or []
            )
        except PostgrestAPIError as exc:
            raise HTTPException(status_code=500, detail=f"Supabase error: {exc.json}") from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=503, detail="Supabase is temporarily unavailable") from exc

    def list_context_edges(self, user_id: str) -> list[dict[str, Any]]:
        try:
            return (
                self._client.table("context_edges")
                .select("from_message_id,to_chat_id,rank")
                .eq("user_id", user_id)
                .order("rank")
                .execute()
                .data
                or []
            )
        except PostgrestAPIError as exc:
            raise HTTPException(status_code=500, detail=f"Supabase error: {exc.json}") from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=503, detail="Supabase is temporarily unavailable") from exc

    def create_chat(
        self, user_id: str, title: str, position_x: float, position_y: float
    ) -> dict[str, Any]:
        try:
            created = (
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
            )
        except PostgrestAPIError as exc:
            raise HTTPException(status_code=500, detail=f"Supabase error: {exc.json}") from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=503, detail="Supabase is temporarily unavailable") from exc

        if not created:
            raise HTTPException(status_code=500, detail="Failed to create node")
        row = created[0]
        return {"id": row["id"], "title": row["title"]}

    def update_chat_title(self, user_id: str, chat_id: str, title: str) -> None:
        try:
            (
                self._client.table("chats")
                .update({"title": title})
                .eq("id", chat_id)
                .eq("user_id", user_id)
                .execute()
            )
        except PostgrestAPIError as exc:
            raise HTTPException(status_code=500, detail=f"Supabase error: {exc.json}") from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=503, detail="Supabase is temporarily unavailable") from exc

    def delete_chat(self, user_id: str, chat_id: str) -> None:
        try:
            (
                self._client.table("chats")
                .delete()
                .eq("id", chat_id)
                .eq("user_id", user_id)
                .execute()
            )
        except PostgrestAPIError as exc:
            raise HTTPException(status_code=500, detail=f"Supabase error: {exc.json}") from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=503, detail="Supabase is temporarily unavailable") from exc

    def create_message(self, user_id: str, chat_id: str, role: str, text: str) -> dict[str, Any]:
        try:
            latest = (
                self._client.table("messages")
                .select("ordinal")
                .eq("user_id", user_id)
                .eq("chat_id", chat_id)
                .order("ordinal", desc=True)
                .limit(1)
                .execute()
                .data
                or []
            )
            next_ordinal = (latest[0]["ordinal"] + 1) if latest else 0
            created = (
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
            )
        except PostgrestAPIError as exc:
            raise HTTPException(status_code=500, detail=f"Supabase error: {exc.json}") from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=503, detail="Supabase is temporarily unavailable") from exc

        if not created:
            raise HTTPException(status_code=500, detail="Failed to create message")
        row = created[0]
        return {"id": row["id"], "ordinal": row["ordinal"]}

    def delete_message(self, user_id: str, message_id: str) -> None:
        try:
            (
                self._client.table("messages")
                .delete()
                .eq("id", message_id)
                .eq("user_id", user_id)
                .execute()
            )
        except PostgrestAPIError as exc:
            raise HTTPException(status_code=500, detail=f"Supabase error: {exc.json}") from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=503, detail="Supabase is temporarily unavailable") from exc

    def update_chat_positions(
        self, user_id: str, positions: dict[str, tuple[float, float]]
    ) -> None:
        for chat_id, (x, y) in positions.items():
            try:
                (
                    self._client.table("chats")
                    .update({"position_x": x, "position_y": y})
                    .eq("id", chat_id)
                    .eq("user_id", user_id)
                    .execute()
                )
            except PostgrestAPIError as exc:
                raise HTTPException(status_code=500, detail=f"Supabase error: {exc.json}") from exc
            except httpx.HTTPError as exc:
                raise HTTPException(
                    status_code=503, detail="Supabase is temporarily unavailable"
                ) from exc

    def replace_context_edges(self, user_id: str, edges: list[dict[str, Any]]) -> None:
        try:
            self._client.table("context_edges").delete().eq("user_id", user_id).execute()
            if edges:
                rows = [
                    {
                        "user_id": user_id,
                        "from_message_id": edge["from_message_id"],
                        "to_chat_id": edge["to_chat_id"],
                        "rank": edge["rank"],
                    }
                    for edge in edges
                ]
                self._client.table("context_edges").insert(rows).execute()
        except PostgrestAPIError as exc:
            raise HTTPException(status_code=500, detail=f"Supabase error: {exc.json}") from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=503, detail="Supabase is temporarily unavailable") from exc
