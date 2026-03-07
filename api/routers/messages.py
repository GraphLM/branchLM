from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request

from deps import get_store, get_user_id
from schemas import CreateMessageBody, GenerateReplyBody
from services.chat_service import ChatGenerationService, MessageService
from store.base import Store

router = APIRouter()


@router.post("/api/chats/{chat_id}/messages")
def create_message(
    chat_id: str,
    body: CreateMessageBody,
    user_id: Annotated[str, Depends(get_user_id)],
    store: Annotated[Store, Depends(get_store)],
) -> dict:
    return MessageService(store).create_message(user_id=user_id, chat_id=chat_id, body=body)


@router.post("/api/chats/{chat_id}/generate")
def generate_chat_reply(
    chat_id: str,
    body: GenerateReplyBody,
    request: Request,
    user_id: Annotated[str, Depends(get_user_id)],
    store: Annotated[Store, Depends(get_store)],
) -> dict:
    service = ChatGenerationService(
        store=store,
        llm_client=request.app.state.llm_client,
        settings=request.app.state.settings,
    )
    return service.generate_chat_reply(user_id=user_id, chat_id=chat_id, body=body)


@router.delete("/api/messages/{message_id}")
def delete_message(
    message_id: str,
    user_id: Annotated[str, Depends(get_user_id)],
    store: Annotated[Store, Depends(get_store)],
) -> None:
    MessageService(store).delete_message(user_id=user_id, message_id=message_id)
