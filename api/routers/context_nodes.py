from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, UploadFile

from deps import get_backboard_client, get_store, get_user_id
from schemas import CreateContextNodeBody, CreateContextNodeTextAssetBody
from services.backboard_service import BackboardClient
from services.context_node_service import ContextNodeService
from store.base import Store

router = APIRouter()


@router.post("/api/workspaces/{workspace_id}/context-nodes")
def create_context_node(
    workspace_id: str,
    body: CreateContextNodeBody,
    user_id: Annotated[str, Depends(get_user_id)],
    store: Annotated[Store, Depends(get_store)],
    backboard: Annotated[BackboardClient, Depends(get_backboard_client)],
) -> dict:
    return ContextNodeService(store=store, backboard=backboard).create_context_node(
        user_id=user_id,
        workspace_id=workspace_id,
        title=body.title,
        position_x=body.position.x,
        position_y=body.position.y,
    )


@router.delete("/api/workspaces/{workspace_id}/context-nodes/{context_node_id}")
def delete_context_node(
    workspace_id: str,
    context_node_id: str,
    user_id: Annotated[str, Depends(get_user_id)],
    store: Annotated[Store, Depends(get_store)],
    backboard: Annotated[BackboardClient, Depends(get_backboard_client)],
) -> None:
    ContextNodeService(store=store, backboard=backboard).delete_context_node(
        user_id=user_id,
        workspace_id=workspace_id,
        context_node_id=context_node_id,
    )


@router.get("/api/workspaces/{workspace_id}/context-nodes/{context_node_id}/assets")
def list_context_node_assets(
    workspace_id: str,
    context_node_id: str,
    user_id: Annotated[str, Depends(get_user_id)],
    store: Annotated[Store, Depends(get_store)],
    backboard: Annotated[BackboardClient, Depends(get_backboard_client)],
) -> list[dict]:
    return ContextNodeService(store=store, backboard=backboard).list_assets(
        user_id=user_id,
        workspace_id=workspace_id,
        context_node_id=context_node_id,
    )


@router.post("/api/workspaces/{workspace_id}/context-nodes/{context_node_id}/assets")
async def upload_context_node_asset(
    workspace_id: str,
    context_node_id: str,
    file: Annotated[UploadFile, File(...)],
    user_id: Annotated[str, Depends(get_user_id)],
    store: Annotated[Store, Depends(get_store)],
    backboard: Annotated[BackboardClient, Depends(get_backboard_client)],
    replace: Annotated[bool, Query()] = False,
) -> dict:
    return await ContextNodeService(store=store, backboard=backboard).upload_asset(
        user_id=user_id,
        workspace_id=workspace_id,
        context_node_id=context_node_id,
        file=file,
        replace_existing=replace,
    )


@router.post("/api/workspaces/{workspace_id}/context-nodes/{context_node_id}/text")
async def upload_context_node_text_asset(
    workspace_id: str,
    context_node_id: str,
    body: CreateContextNodeTextAssetBody,
    user_id: Annotated[str, Depends(get_user_id)],
    store: Annotated[Store, Depends(get_store)],
    backboard: Annotated[BackboardClient, Depends(get_backboard_client)],
    replace: Annotated[bool, Query()] = False,
) -> dict:
    return await ContextNodeService(store=store, backboard=backboard).upload_text_asset(
        user_id=user_id,
        workspace_id=workspace_id,
        context_node_id=context_node_id,
        text=body.text,
        replace_existing=replace,
    )
