from __future__ import annotations

import time
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from deps import get_store, get_user_id
from schemas import GraphLayoutPutBody
from services.graph_service import get_graph as svc_get_graph
from services.graph_service import put_graph_layout as svc_put_graph_layout
from store.base import Store

router = APIRouter()


@router.get("/api/workspaces/{workspace_id}/graph")
def get_graph(
    workspace_id: str,
    user_id: Annotated[str, Depends(get_user_id)],
    store: Annotated[Store, Depends(get_store)],
) -> dict:
    return svc_get_graph(user_id=user_id, workspace_id=workspace_id, store=store)


@router.put("/api/workspaces/{workspace_id}/graph/layout")
def put_graph_layout(
    workspace_id: str,
    body: GraphLayoutPutBody,
    user_id: Annotated[str, Depends(get_user_id)],
    store: Annotated[Store, Depends(get_store)],
) -> None:
    last_error: HTTPException | None = None
    for attempt in range(3):
        try:
            svc_put_graph_layout(user_id=user_id, workspace_id=workspace_id, body=body, store=store)
            return
        except HTTPException as exc:
            if exc.status_code not in {503, 504}:
                raise
            last_error = exc
            if attempt < 2:
                time.sleep(0.2 * (attempt + 1))
                continue
            raise
    if last_error:
        raise last_error
