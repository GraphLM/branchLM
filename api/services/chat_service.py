from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from schemas import (
    CreateChatBody,
    CreateMessageBody,
    CreateWorkspaceBody,
    GenerateReplyBody,
    PatchChatBody,
    PatchWorkspaceBody,
)
from services.llm_service import LLMConfigurationError, LLMServiceError, OpenRouterClient
from services.rate_limit import SlidingWindowRateLimiter
from settings import Settings
from store.base import Store


class WorkspaceService:
    def __init__(self, store: Store) -> None:
        self._store = store

    def list_workspaces(self, *, user_id: str) -> list[dict[str, Any]]:
        return [
            {"id": workspace["id"], "title": workspace["title"]}
            for workspace in self._store.list_workspaces(user_id)
        ]

    def create_workspace(self, *, user_id: str, body: CreateWorkspaceBody) -> dict[str, Any]:
        return self._store.create_workspace(user_id, body.title)

    def patch_workspace(
        self, *, user_id: str, workspace_id: str, body: PatchWorkspaceBody
    ) -> None:
        self._store.update_workspace_title(user_id, workspace_id, body.title)

    def delete_workspace(self, *, user_id: str, workspace_id: str) -> None:
        self._store.delete_workspace(user_id, workspace_id)


class ChatService:
    def __init__(self, store: Store) -> None:
        self._store = store

    def create_chat(self, *, user_id: str, workspace_id: str, body: CreateChatBody) -> dict[str, Any]:
        return self._store.create_chat(
            user_id,
            workspace_id,
            body.title,
            body.position.x,
            body.position.y,
        )

    def patch_chat(
        self, *, user_id: str, workspace_id: str, chat_id: str, body: PatchChatBody
    ) -> None:
        self._store.update_chat_title(user_id, workspace_id, chat_id, body.title)

    def delete_chat(self, *, user_id: str, workspace_id: str, chat_id: str) -> None:
        self._store.delete_chat(user_id, workspace_id, chat_id)


class MessageService:
    def __init__(self, store: Store) -> None:
        self._store = store

    def create_message(
        self, *, user_id: str, workspace_id: str, chat_id: str, body: CreateMessageBody
    ) -> dict[str, Any]:
        return self._store.create_message(user_id, workspace_id, chat_id, body.role, body.text)

    def delete_message(self, *, user_id: str, workspace_id: str, message_id: str) -> None:
        self._store.delete_message(user_id, workspace_id, message_id)


class ChatGenerationService:
    def __init__(
        self,
        *,
        store: Store,
        llm_client: OpenRouterClient,
        rate_limiter: SlidingWindowRateLimiter,
        settings: Settings,
    ) -> None:
        self._store = store
        self._llm_client = llm_client
        self._rate_limiter = rate_limiter
        self._settings = settings

    def generate_chat_reply(
        self,
        *,
        user_id: str,
        workspace_id: str,
        chat_id: str,
        body: GenerateReplyBody,
        client_ip: str,
    ) -> dict[str, Any]:
        self._ensure_chat_exists(user_id=user_id, workspace_id=workspace_id, chat_id=chat_id)

        prompt = self._validate_prompt(body.text)
        self._enforce_rate_limit(user_id=user_id, client_ip=client_ip)

        conversation = self._build_conversation(
            user_id=user_id,
            workspace_id=workspace_id,
            chat_id=chat_id,
            prompt=prompt,
        )
        reply_text = self._call_llm(conversation)

        user_message = self._store.create_message(user_id, workspace_id, chat_id, "user", prompt)
        app_message = self._store.create_message(user_id, workspace_id, chat_id, "app", reply_text)

        return {
            "userMessage": {
                "id": user_message["id"],
                "chatId": chat_id,
                "ordinal": user_message["ordinal"],
                "role": "user",
                "text": prompt,
            },
            "appMessage": {
                "id": app_message["id"],
                "chatId": chat_id,
                "ordinal": app_message["ordinal"],
                "role": "app",
                "text": reply_text,
            },
        }

    def _ensure_chat_exists(self, *, user_id: str, workspace_id: str, chat_id: str) -> None:
        if not self._store.chat_exists(user_id, workspace_id, chat_id):
            raise HTTPException(status_code=404, detail="Chat not found")

    def _validate_prompt(self, text: str) -> str:
        prompt = _normalize_prompt(text)
        if not prompt:
            raise HTTPException(status_code=400, detail="Message text is required")
        if len(prompt) > self._settings.max_prompt_chars:
            raise HTTPException(
                status_code=400,
                detail=f"Message text exceeds {self._settings.max_prompt_chars} characters",
            )
        return prompt

    def _enforce_rate_limit(self, *, user_id: str, client_ip: str) -> None:
        decision = self._rate_limiter.allow(f"{user_id}:{client_ip}")
        if decision.allowed:
            return

        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Please retry shortly.",
            headers={"Retry-After": str(decision.retry_after_seconds)},
        )

    def _build_conversation(
        self, *, user_id: str, workspace_id: str, chat_id: str, prompt: str
    ) -> list[dict[str, str]]:
        prior_messages = self._store.list_messages_for_chat(user_id, workspace_id, chat_id)
        if self._settings.max_history_messages > 0:
            prior_messages = prior_messages[-self._settings.max_history_messages :]

        conversation = [
            {
                "role": "assistant" if message["role"] == "app" else "user",
                "content": message["text"],
            }
            for message in prior_messages
        ]
        conversation.append({"role": "user", "content": prompt})
        return conversation

    def _call_llm(self, conversation: list[dict[str, str]]) -> str:
        try:
            return self._llm_client.generate_reply(conversation)
        except LLMConfigurationError as exc:
            raise HTTPException(
                status_code=503,
                detail="The language model is not configured on the server.",
            ) from exc
        except LLMServiceError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail="The language model is temporarily unavailable.",
            ) from exc


def _normalize_prompt(text: str) -> str:
    return text.replace("\x00", "").replace("\r\n", "\n").strip()
