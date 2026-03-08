from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from typing import Any

import httpx

from settings import Settings


class BackboardServiceError(RuntimeError):
    pass


@dataclass(frozen=True)
class BackboardDocumentResult:
    id: str
    status: str


@dataclass(frozen=True)
class BackboardDocumentStatus:
    document_id: str
    status: str
    status_message: str | None


@dataclass(frozen=True)
class BackboardHealthResult:
    status: str
    detail: str
    run_status: str | None
    model_provider: str | None
    model_name: str | None


class BackboardClient:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    @property
    def enabled(self) -> bool:
        return bool(self._settings.backboard_api_key)

    def _headers(self) -> dict[str, str]:
        if not self._settings.backboard_api_key:
            raise BackboardServiceError("Backboard API key is not configured.")
        return {
            "X-API-Key": self._settings.backboard_api_key,
            "Accept": "application/json",
        }

    def _url(self, path: str) -> str:
        return f"{self._settings.backboard_base_url.rstrip('/')}/{path.lstrip('/')}"

    def ensure_assistant(self) -> str:
        if self._settings.backboard_assistant_id:
            return self._settings.backboard_assistant_id

        name = f"branchlm-context-{uuid.uuid4().hex[:8]}"
        payload = {
            "name": name,
            "system_prompt": "You help retrieve concise context from uploaded documents.",
            "model": "openai/gpt-4o-mini",
        }
        with httpx.Client(timeout=20.0) as client:
            resp = client.post(
                self._url("/assistants"),
                headers={**self._headers(), "Content-Type": "application/json"},
                content=json.dumps(payload),
            )
        if resp.status_code >= 400:
            raise BackboardServiceError(
                f"Failed to create Backboard assistant ({resp.status_code}): {resp.text}"
            )
        data = resp.json()
        assistant_id = str(data.get("assistant_id") or data.get("id") or "")
        if not assistant_id:
            raise BackboardServiceError("Backboard assistant response missing `assistant_id`.")
        return assistant_id

    def create_thread(self, assistant_id: str) -> str:
        with httpx.Client(timeout=20.0) as client:
            resp = client.post(
                self._url(f"/assistants/{assistant_id}/threads"),
                headers={**self._headers(), "Content-Type": "application/json"},
                content=json.dumps({}),
            )
        if resp.status_code >= 400:
            raise BackboardServiceError(
                f"Failed to create Backboard thread ({resp.status_code}): {resp.text}"
            )
        data = resp.json()
        thread_id = str(data.get("thread_id") or data.get("id") or "")
        if not thread_id:
            raise BackboardServiceError("Backboard thread response missing `thread_id`.")
        return thread_id

    def upload_document_to_thread(
        self, *, thread_id: str, filename: str, content: bytes, mime_type: str
    ) -> BackboardDocumentResult:
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(
                self._url(f"/threads/{thread_id}/documents"),
                headers=self._headers(),
                files={"file": (filename, content, mime_type)},
            )
        if resp.status_code >= 400:
            raise BackboardServiceError(
                f"Failed to upload Backboard document ({resp.status_code}): {resp.text}"
            )
        data = resp.json()
        document_id = str(data.get("document_id") or data.get("id") or "")
        status = str(data.get("status") or "processing")
        if not document_id:
            raise BackboardServiceError("Backboard document response missing `document_id`.")
        return BackboardDocumentResult(id=document_id, status=status)

    def get_document_status(self, *, document_id: str) -> BackboardDocumentStatus:
        with httpx.Client(timeout=20.0) as client:
            resp = client.get(
                self._url(f"/documents/{document_id}/status"),
                headers=self._headers(),
            )
        if resp.status_code >= 400:
            raise BackboardServiceError(
                f"Failed to fetch Backboard document status ({resp.status_code}): {resp.text}"
            )
        data = resp.json()
        returned_id = str(data.get("document_id") or document_id)
        status = str(data.get("status") or "unknown")
        status_message_raw = data.get("status_message")
        status_message = str(status_message_raw) if isinstance(status_message_raw, str) else None
        return BackboardDocumentStatus(
            document_id=returned_id,
            status=status,
            status_message=status_message,
        )

    def query_thread(self, *, thread_id: str, prompt: str) -> str:
        attempts: list[tuple[str, dict[str, Any]]] = [
            ("form", {"content": prompt, "stream": "false"}),
            ("json", {"content": prompt, "stream": False}),
            ("json", {"role": "user", "content": prompt, "stream": False}),
        ]
        last_error: str | None = None
        with httpx.Client(timeout=30.0) as client:
            for mode, payload in attempts:
                if mode == "form":
                    resp = client.post(
                        self._url(f"/threads/{thread_id}/messages"),
                        headers=self._headers(),
                        data=payload,
                    )
                else:
                    resp = client.post(
                        self._url(f"/threads/{thread_id}/messages"),
                        headers={**self._headers(), "Content-Type": "application/json"},
                        content=json.dumps(payload),
                    )

                if resp.status_code >= 400:
                    last_error = f"{resp.status_code}: {resp.text}"
                    continue

                data: Any = resp.json()
                extracted = self._extract_query_text(data)
                if extracted:
                    return extracted

        if last_error:
            raise BackboardServiceError(f"Backboard thread query failed ({last_error})")
        return ""

    def probe_health(self) -> BackboardHealthResult:
        if not self.enabled:
            return BackboardHealthResult(
                status="disabled",
                detail="Backboard API key not configured",
                run_status=None,
                model_provider=None,
                model_name=None,
            )
        assistant_id = self.ensure_assistant()
        thread_id = self.create_thread(assistant_id)
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(
                self._url(f"/threads/{thread_id}/messages"),
                headers={**self._headers(), "Content-Type": "application/json"},
                content=json.dumps({"content": "healthcheck", "stream": False}),
            )
        if resp.status_code >= 400:
            raise BackboardServiceError(
                f"Backboard health probe failed ({resp.status_code}): {resp.text}"
            )
        data = resp.json()
        run_status = str(data.get("status") or "").upper() or None
        content = str(data.get("content") or "")
        model_provider = data.get("model_provider")
        model_name = data.get("model_name")
        if "No credits available" in content:
            return BackboardHealthResult(
                status="no_credits",
                detail="Backboard run failed due missing credits/subscription.",
                run_status=run_status,
                model_provider=str(model_provider) if model_provider else None,
                model_name=str(model_name) if model_name else None,
            )
        if run_status == "FAILED":
            return BackboardHealthResult(
                status="run_failed",
                detail="Backboard run failed for provider/model configuration reasons.",
                run_status=run_status,
                model_provider=str(model_provider) if model_provider else None,
                model_name=str(model_name) if model_name else None,
            )
        return BackboardHealthResult(
            status="ok",
            detail="Backboard run/write path is healthy.",
            run_status=run_status,
            model_provider=str(model_provider) if model_provider else None,
            model_name=str(model_name) if model_name else None,
        )

    def _extract_query_text(self, payload: Any) -> str:
        if isinstance(payload, str):
            return payload.strip()
        if isinstance(payload, list):
            return self._extract_text_from_blocks(payload)
        if not isinstance(payload, dict):
            return ""

        for key in ("response", "answer", "output_text", "text", "content"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
            if isinstance(value, list):
                extracted = self._extract_text_from_blocks(value)
                if extracted:
                    return extracted
            if isinstance(value, dict):
                extracted = self._extract_query_text(value)
                if extracted:
                    return extracted

        for key in ("message", "result", "data", "output"):
            value = payload.get(key)
            extracted = self._extract_query_text(value)
            if extracted:
                return extracted

        choices = payload.get("choices")
        if isinstance(choices, list) and choices:
            for item in choices:
                extracted = self._extract_query_text(item)
                if extracted:
                    return extracted
        return ""

    @staticmethod
    def _extract_text_from_blocks(blocks: list[Any]) -> str:
        parts: list[str] = []
        for block in blocks:
            if not isinstance(block, dict):
                continue
            value = block.get("text")
            if isinstance(value, str) and value.strip():
                parts.append(value.strip())
                continue
            nested = block.get("content")
            if isinstance(nested, str) and nested.strip():
                parts.append(nested.strip())
        return "\n".join(parts).strip()
