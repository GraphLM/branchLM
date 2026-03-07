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
