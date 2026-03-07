from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from deps import get_store, get_user_id
from schemas import CreateChatBody, PatchChatBody
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


@router.patch("/api/chats/{chat_id}")
def patch_chat(
    chat_id: str,
    body: PatchChatBody,
    user_id: Annotated[str, Depends(get_user_id)],
    store: Annotated[Store, Depends(get_store)],
) -> None:
    ChatService(store).patch_chat(user_id=user_id, chat_id=chat_id, body=body)


@router.delete("/api/chats/{chat_id}")
def delete_chat(
    chat_id: str,
    user_id: Annotated[str, Depends(get_user_id)],
    store: Annotated[Store, Depends(get_store)],
) -> None:
    ChatService(store).delete_chat(user_id=user_id, chat_id=chat_id)
