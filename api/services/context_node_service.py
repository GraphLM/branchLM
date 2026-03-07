from __future__ import annotations

from fastapi import HTTPException, UploadFile

from services.backboard_service import BackboardClient, BackboardServiceError
from store.base import Store


class ContextNodeService:
    def __init__(self, *, store: Store, backboard: BackboardClient) -> None:
        self._store = store
        self._backboard = backboard

    def create_context_node(
        self,
        *,
        user_id: str,
        workspace_id: str,
        title: str,
        position_x: float,
        position_y: float,
    ) -> dict:
        thread_id: str | None = None
        if self._backboard.enabled:
            try:
                assistant_id = self._backboard.ensure_assistant()
                thread_id = self._backboard.create_thread(assistant_id)
            except BackboardServiceError as exc:
                raise HTTPException(
                    status_code=502,
                    detail=f"Backboard is unavailable while creating context node: {exc}",
                ) from exc

        created = self._store.create_context_node(
            user_id,
            workspace_id,
            title,
            position_x,
            position_y,
            thread_id,
        )
        return {
            "id": created["id"],
            "workspaceId": created["workspace_id"],
            "title": created["title"],
            "position": {"x": created["position_x"], "y": created["position_y"]},
        }

    def delete_context_node(
        self, *, user_id: str, workspace_id: str, context_node_id: str
    ) -> None:
        self._store.delete_context_node(user_id, workspace_id, context_node_id)

    def list_assets(
        self, *, user_id: str, workspace_id: str, context_node_id: str
    ) -> list[dict]:
        rows = self._store.list_context_node_assets(user_id, workspace_id, context_node_id)
        return [
            {
                "id": row["id"],
                "fileName": row["file_name"],
                "mimeType": row["mime_type"],
                "sizeBytes": row["size_bytes"],
                "status": row["status"],
                "statusMessage": row.get("status_message"),
            }
            for row in rows
        ]

    async def upload_asset(
        self,
        *,
        user_id: str,
        workspace_id: str,
        context_node_id: str,
        file: UploadFile,
    ) -> dict:
        self._ensure_single_asset_slot(
            user_id=user_id, workspace_id=workspace_id, context_node_id=context_node_id
        )
        file_name = file.filename or "upload.bin"
        mime_type = file.content_type or "application/octet-stream"
        content = await file.read()
        size_bytes = len(content)
        if size_bytes == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")

        node = self._get_context_node(
            user_id=user_id,
            workspace_id=workspace_id,
            context_node_id=context_node_id,
        )

        if not self._backboard.enabled:
            raise HTTPException(status_code=503, detail="Backboard is not configured on the server")

        status = "stored"
        status_message: str | None = None
        backboard_document_id: str | None = None

        thread_id = node.get("backboard_thread_id")
        if not thread_id:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Context node is missing Backboard thread linkage; "
                    "recreate this context node."
                ),
            )
        try:
            result = self._backboard.upload_document_to_thread(
                thread_id=thread_id,
                filename=file_name,
                content=content,
                mime_type=mime_type,
            )
            backboard_document_id = result.id
            status = result.status or "processing"
        except BackboardServiceError as exc:
            status = "failed"
            status_message = str(exc)

        created = self._store.create_context_node_asset(
            user_id,
            workspace_id,
            context_node_id,
            file_name,
            mime_type,
            size_bytes,
            backboard_document_id,
            status,
            status_message,
        )
        return {
            "id": created["id"],
            "fileName": created["file_name"],
            "mimeType": created["mime_type"],
            "sizeBytes": created["size_bytes"],
            "status": created["status"],
            "statusMessage": created.get("status_message"),
        }

    async def upload_text_asset(
        self,
        *,
        user_id: str,
        workspace_id: str,
        context_node_id: str,
        text: str,
    ) -> dict:
        self._ensure_single_asset_slot(
            user_id=user_id, workspace_id=workspace_id, context_node_id=context_node_id
        )
        normalized = text.strip()
        if not normalized:
            raise HTTPException(status_code=400, detail="Pasted text is empty")

        node = self._get_context_node(
            user_id=user_id, workspace_id=workspace_id, context_node_id=context_node_id
        )
        if not self._backboard.enabled:
            raise HTTPException(status_code=503, detail="Backboard is not configured on the server")

        thread_id = node.get("backboard_thread_id")
        if not thread_id:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Context node is missing Backboard thread linkage; "
                    "recreate this context node."
                ),
            )

        status = "stored"
        status_message: str | None = None
        backboard_document_id: str | None = None
        content = normalized.encode("utf-8")
        file_name = "context.txt"
        mime_type = "text/plain"

        try:
            result = self._backboard.upload_document_to_thread(
                thread_id=thread_id,
                filename=file_name,
                content=content,
                mime_type=mime_type,
            )
            backboard_document_id = result.id
            status = result.status or "processing"
        except BackboardServiceError as exc:
            status = "failed"
            status_message = str(exc)

        created = self._store.create_context_node_asset(
            user_id,
            workspace_id,
            context_node_id,
            file_name,
            mime_type,
            len(content),
            backboard_document_id,
            status,
            status_message,
        )
        return {
            "id": created["id"],
            "fileName": created["file_name"],
            "mimeType": created["mime_type"],
            "sizeBytes": created["size_bytes"],
            "status": created["status"],
            "statusMessage": created.get("status_message"),
        }

    def _get_context_node(self, *, user_id: str, workspace_id: str, context_node_id: str) -> dict:
        context_nodes = self._store.list_context_nodes(user_id, workspace_id)
        node = next((n for n in context_nodes if n["id"] == context_node_id), None)
        if not node:
            raise HTTPException(status_code=404, detail="Context node not found")
        return node

    def _ensure_single_asset_slot(
        self, *, user_id: str, workspace_id: str, context_node_id: str
    ) -> None:
        existing = self._store.list_context_node_assets(user_id, workspace_id, context_node_id)
        if existing:
            raise HTTPException(
                status_code=409,
                detail="This context node already has content. Use one file/text source per node.",
            )
