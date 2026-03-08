from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from deps import get_backboard_client
from services.backboard_service import BackboardClient, BackboardServiceError

router = APIRouter()


@router.get("/api/backboard/health")
def backboard_health(
    backboard: Annotated[BackboardClient, Depends(get_backboard_client)],
) -> dict:
    try:
        result = backboard.probe_health()
    except BackboardServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {
        "status": result.status,
        "detail": result.detail,
        "runStatus": result.run_status,
        "modelProvider": result.model_provider,
        "modelName": result.model_name,
    }
