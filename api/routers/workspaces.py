from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from deps import get_store, get_user_id
from schemas import CreateWorkspaceBody, PatchWorkspaceBody
from services.chat_service import WorkspaceService
from store.base import Store

router = APIRouter()


@router.get("/api/workspaces")
def list_workspaces(
    user_id: Annotated[str, Depends(get_user_id)],
    store: Annotated[Store, Depends(get_store)],
) -> list[dict]:
    return WorkspaceService(store).list_workspaces(user_id=user_id)


@router.post("/api/workspaces")
def create_workspace(
    body: CreateWorkspaceBody,
    user_id: Annotated[str, Depends(get_user_id)],
    store: Annotated[Store, Depends(get_store)],
) -> dict:
    return WorkspaceService(store).create_workspace(user_id=user_id, body=body)


@router.patch("/api/workspaces/{workspace_id}")
def patch_workspace(
    workspace_id: str,
    body: PatchWorkspaceBody,
    user_id: Annotated[str, Depends(get_user_id)],
    store: Annotated[Store, Depends(get_store)],
) -> None:
    WorkspaceService(store).patch_workspace(user_id=user_id, workspace_id=workspace_id, body=body)


@router.delete("/api/workspaces/{workspace_id}")
def delete_workspace(
    workspace_id: str,
    user_id: Annotated[str, Depends(get_user_id)],
    store: Annotated[Store, Depends(get_store)],
) -> None:
    WorkspaceService(store).delete_workspace(user_id=user_id, workspace_id=workspace_id)
