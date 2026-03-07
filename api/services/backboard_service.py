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

    def query_thread(self, *, thread_id: str, prompt: str) -> str:
        payload = {"content": prompt, "stream": "false"}
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(
                self._url(f"/threads/{thread_id}/messages"),
                headers=self._headers(),
                data=payload,
            )
        if resp.status_code >= 400:
            raise BackboardServiceError(
                f"Backboard thread query failed ({resp.status_code}): {resp.text}"
            )
        data: Any = resp.json()

        # Backboard responses may vary; extract the most common text fields.
        if isinstance(data, dict):
            for key in ("response", "text", "content"):
                value = data.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()
            message = data.get("message")
            if isinstance(message, dict):
                for key in ("content", "text"):
                    value = message.get(key)
                    if isinstance(value, str) and value.strip():
                        return value.strip()
                    if isinstance(value, list):
                        extracted = self._extract_text_from_blocks(value)
                        if extracted:
                            return extracted
            choices = data.get("choices")
            if isinstance(choices, list) and choices:
                first = choices[0]
                if isinstance(first, dict):
                    msg = first.get("message")
                    if isinstance(msg, dict):
                        content = msg.get("content")
                        if isinstance(content, str) and content.strip():
                            return content.strip()
                        if isinstance(content, list):
                            extracted = self._extract_text_from_blocks(content)
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
