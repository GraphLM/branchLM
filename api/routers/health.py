from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from deps import get_store
from store.base import Store

router = APIRouter()


@router.get("/health")
@router.get("/api/health")
def health(store: Annotated[Store, Depends(get_store)]) -> dict[str, str]:
    return {"status": "ok", "mode": store.mode}
