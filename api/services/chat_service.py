from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from schemas import CreateChatBody, CreateMessageBody, GenerateReplyBody, PatchChatBody
from services.llm_service import LLMConfigurationError, LLMServiceError, OpenRouterClient
from settings import Settings
from store.base import Store


class ChatService:
    def __init__(self, store: Store) -> None:
        self._store = store

    def create_chat(self, *, user_id: str, body: CreateChatBody) -> dict[str, Any]:
        return self._store.create_chat(user_id, body.title, body.position.x, body.position.y)

    def patch_chat(self, *, user_id: str, chat_id: str, body: PatchChatBody) -> None:
        self._store.update_chat_title(user_id, chat_id, body.title)

    def delete_chat(self, *, user_id: str, chat_id: str) -> None:
        self._store.delete_chat(user_id, chat_id)


class MessageService:
    def __init__(self, store: Store) -> None:
        self._store = store

    def create_message(
        self, *, user_id: str, chat_id: str, body: CreateMessageBody
    ) -> dict[str, Any]:
        return self._store.create_message(user_id, chat_id, body.role, body.text)

    def delete_message(self, *, user_id: str, message_id: str) -> None:
        self._store.delete_message(user_id, message_id)


class ChatGenerationService:
    def __init__(self, *, store: Store, llm_client: OpenRouterClient, settings: Settings) -> None:
        self._store = store
        self._llm_client = llm_client
        self._settings = settings

    def generate_chat_reply(self, *, user_id: str, chat_id: str, body: GenerateReplyBody) -> dict[str, Any]:
        self._ensure_chat_exists(user_id=user_id, chat_id=chat_id)
        prompt = self._validate_prompt(body.text)
        conversation = self._build_conversation(user_id=user_id, chat_id=chat_id, prompt=prompt)
        reply_text = self._call_llm(conversation)

        user_message = self._store.create_message(user_id, chat_id, "user", prompt)
        app_message = self._store.create_message(user_id, chat_id, "app", reply_text)

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

    def _ensure_chat_exists(self, *, user_id: str, chat_id: str) -> None:
        if not any(chat["id"] == chat_id for chat in self._store.list_chats(user_id)):
            raise HTTPException(status_code=404, detail="Chat not found")

    def _validate_prompt(self, text: str) -> str:
        prompt = text.replace("\x00", "").replace("\r\n", "\n").strip()
        if not prompt:
            raise HTTPException(status_code=400, detail="Message text is required")
        if len(prompt) > self._settings.max_prompt_chars:
            raise HTTPException(
                status_code=400,
                detail=f"Message text exceeds {self._settings.max_prompt_chars} characters",
            )
        return prompt

    def _build_conversation(self, *, user_id: str, chat_id: str, prompt: str) -> list[dict[str, str]]:
        prior_messages = self._store.list_messages_for_chat(user_id, chat_id)
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
