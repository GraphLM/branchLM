from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request

from deps import get_store, get_user_id
from schemas import CreateMessageBody, GenerateReplyBody
from services.chat_service import ChatGenerationService, MessageService
from store.base import Store

router = APIRouter()


@router.post("/api/workspaces/{workspace_id}/chats/{chat_id}/messages")
def create_message(
    workspace_id: str,
    chat_id: str,
    body: CreateMessageBody,
    user_id: Annotated[str, Depends(get_user_id)],
    store: Annotated[Store, Depends(get_store)],
) -> dict:
    return MessageService(store).create_message(
        user_id=user_id,
        workspace_id=workspace_id,
        chat_id=chat_id,
        body=body,
    )


@router.post("/api/workspaces/{workspace_id}/chats/{chat_id}/generate")
def generate_chat_reply(
    workspace_id: str,
    chat_id: str,
    body: GenerateReplyBody,
    request: Request,
    user_id: Annotated[str, Depends(get_user_id)],
    store: Annotated[Store, Depends(get_store)],
) -> dict:
    service = ChatGenerationService(
        store=store,
        llm_client=request.app.state.llm_client,
        rate_limiter=request.app.state.rate_limiter,
        settings=request.app.state.settings,
        metrics=request.app.state.metrics,
    )
    client_host = request.client.host if request.client else "unknown"
    return service.generate_chat_reply(
        user_id=user_id,
        workspace_id=workspace_id,
        chat_id=chat_id,
        body=body,
        client_ip=client_host,
    )


@router.delete("/api/workspaces/{workspace_id}/messages/{message_id}")
def delete_message(
    workspace_id: str,
    message_id: str,
    user_id: Annotated[str, Depends(get_user_id)],
    store: Annotated[Store, Depends(get_store)],
) -> None:
    MessageService(store).delete_message(
        user_id=user_id,
        workspace_id=workspace_id,
        message_id=message_id,
    )
