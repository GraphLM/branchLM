from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from deps import get_store, get_user_id
from schemas import CreateChatBody
from services.chat_service import ChatService
from store.base import Store

router = APIRouter()


@router.post("/api/chats")
def create_chat(
    body: CreateChatBody,
    user_id: Annotated[str, Depends(get_user_id)],
    store: Annotated[Store, Depends(get_store)],
) -> dict:
    return ChatService(store).create_chat(user_id=user_id, body=body)
