from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from deps import get_settings, get_store, get_user_id
from schemas import CreateChatBody, PatchChatBody
from services.chat_service import ChatService
from settings import Settings
from store.base import Store

router = APIRouter()


@router.post("/api/workspaces/{workspace_id}/chats")
def create_chat(
    workspace_id: str,
    body: CreateChatBody,
    user_id: Annotated[str, Depends(get_user_id)],
    store: Annotated[Store, Depends(get_store)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict:
    return ChatService(store, settings).create_chat(
        user_id=user_id, workspace_id=workspace_id, body=body
    )


@router.patch("/api/workspaces/{workspace_id}/chats/{chat_id}")
def patch_chat(
    workspace_id: str,
    chat_id: str,
    body: PatchChatBody,
    user_id: Annotated[str, Depends(get_user_id)],
    store: Annotated[Store, Depends(get_store)],
) -> None:
    ChatService(store).patch_chat(
        user_id=user_id,
        workspace_id=workspace_id,
        chat_id=chat_id,
        body=body,
    )


@router.delete("/api/workspaces/{workspace_id}/chats/{chat_id}")
def delete_chat(
    workspace_id: str,
    chat_id: str,
    user_id: Annotated[str, Depends(get_user_id)],
    store: Annotated[Store, Depends(get_store)],
) -> None:
    ChatService(store).delete_chat(user_id=user_id, workspace_id=workspace_id, chat_id=chat_id)
