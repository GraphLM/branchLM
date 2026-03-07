from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from deps import get_metrics, get_store
from services.metrics import AppMetrics
from store.base import Store

router = APIRouter()


@router.get("/api/health")
def health(
    store: Annotated[Store, Depends(get_store)],
    metrics: Annotated[AppMetrics, Depends(get_metrics)],
) -> dict:
    return {"status": "ok", "mode": store.mode, "metrics": metrics.snapshot()}
