from __future__ import annotations

import logging
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

logger = logging.getLogger(__name__)


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
        source_context, chat_history = self._build_spliced_history(
            user_id=user_id,
            workspace_id=workspace_id,
            chat_id=chat_id,
        )

        input_budget = self._max_input_tokens()
        prompt_tokens = self._estimate_tokens(prompt)
        if prompt_tokens >= input_budget:
            raise HTTPException(
                status_code=400,
                detail="Prompt is too large for the selected model context window.",
            )

        available_for_history = input_budget - prompt_tokens
        max_history_messages = self._settings.max_history_messages
        remaining_message_slots = max_history_messages if max_history_messages > 0 else None

        # Tier A: keep target chat history first (most relevant to immediate continuation).
        selected_chat_history, used_chat_tokens, dropped_chat = self._select_messages_by_budget(
            messages=chat_history,
            available_tokens=available_for_history,
            remaining_slots=remaining_message_slots,
        )
        available_for_history -= used_chat_tokens
        if remaining_message_slots is not None:
            remaining_message_slots -= len(selected_chat_history)

        # Tier B: fill remaining budget with branch-spliced context.
        selected_source_context, used_source_tokens, dropped_source = self._select_messages_by_budget(
            messages=source_context,
            available_tokens=available_for_history,
            remaining_slots=remaining_message_slots,
        )
        available_for_history -= used_source_tokens
        if remaining_message_slots is not None:
            remaining_message_slots -= len(selected_source_context)

        summary_message = self._build_overflow_summary(
            dropped_messages=dropped_source + dropped_chat,
            available_tokens=available_for_history,
            remaining_slots=remaining_message_slots,
        )

        prior_messages = selected_source_context + selected_chat_history
        conversation = [self._to_llm_message(message) for message in prior_messages]
        if summary_message:
            conversation.insert(0, summary_message)
        conversation.append({"role": "user", "content": prompt})

        logger.info(
            "conversation_built chat_id=%s prompt_tokens=%d history_msgs=%d dropped_msgs=%d estimated_input_tokens=%d",
            chat_id,
            prompt_tokens,
            len(prior_messages),
            len(dropped_source) + len(dropped_chat),
            prompt_tokens + sum(self._estimate_tokens(m["content"]) for m in conversation[:-1]),
        )
        return conversation

    def _build_spliced_history(
        self, *, user_id: str, workspace_id: str, chat_id: str
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        workspace_messages = self._store.list_messages(user_id, workspace_id)
        messages_by_id = {message["id"]: message for message in workspace_messages}

        messages_by_chat: dict[str, list[dict[str, Any]]] = {}
        for message in workspace_messages:
            messages_by_chat.setdefault(message["chat_id"], []).append(message)
        for chat_messages in messages_by_chat.values():
            chat_messages.sort(key=lambda message: message["ordinal"])

        context_edges = [
            edge
            for edge in self._store.list_context_edges(user_id, workspace_id)
            if edge["to_chat_id"] == chat_id
        ]
        context_edges.sort(key=lambda edge: edge["rank"])

        spliced_messages: list[dict[str, Any]] = []
        seen_message_ids: set[str] = set()

        for edge in context_edges:
            source_message = messages_by_id.get(edge["from_message_id"])
            if not source_message:
                continue

            source_chat_messages = messages_by_chat.get(source_message["chat_id"], [])
            include_until_ordinal = source_message["ordinal"]
            if source_message["role"] == "user":
                include_until_ordinal -= 1

            for message in source_chat_messages:
                if message["ordinal"] > include_until_ordinal:
                    break
                if message["id"] in seen_message_ids:
                    continue
                seen_message_ids.add(message["id"])
                spliced_messages.append(message)

        chat_history = self._store.list_messages_for_chat(user_id, workspace_id, chat_id)
        deduped_chat_history: list[dict[str, Any]] = []
        for message in chat_history:
            if message["id"] in seen_message_ids:
                continue
            deduped_chat_history.append(message)

        return spliced_messages, deduped_chat_history

    def _call_llm(self, conversation: list[dict[str, str]]) -> str:
        current_conversation = conversation
        for attempt in range(2):
            try:
                return self._llm_client.generate_reply(current_conversation)
            except LLMConfigurationError as exc:
                raise HTTPException(
                    status_code=503,
                    detail="The language model is not configured on the server.",
                ) from exc
            except LLMServiceError as exc:
                if (
                    exc.code == "context_length_exceeded"
                    and attempt == 0
                    and len(current_conversation) > 2
                ):
                    tightened = self._tighten_conversation(current_conversation)
                    if len(tightened) < len(current_conversation):
                        logger.warning(
                            "context_overflow_retry original_messages=%d tightened_messages=%d",
                            len(current_conversation),
                            len(tightened),
                        )
                        current_conversation = tightened
                        continue
                raise HTTPException(status_code=502, detail=str(exc)) from exc
            except Exception as exc:
                raise HTTPException(
                    status_code=502,
                    detail="The language model is temporarily unavailable.",
                ) from exc

        raise HTTPException(
            status_code=502,
            detail="The language model is temporarily unavailable.",
        )

    def _max_input_tokens(self) -> int:
        budget = (
            self._settings.model_context_window_tokens
            - self._settings.max_completion_tokens
            - self._settings.input_token_safety_margin
        )
        return max(32, budget)

    def _estimate_tokens(self, text: str) -> int:
        chars_per_token = max(1, self._settings.estimated_chars_per_token)
        # Adds small fixed overhead per message to better approximate chat-format tokens.
        return max(1, (len(text) + chars_per_token - 1) // chars_per_token) + 4

    def _to_llm_message(self, message: dict[str, Any]) -> dict[str, str]:
        return {
            "role": "assistant" if message["role"] == "app" else "user",
            "content": message["text"],
        }

    def _select_messages_by_budget(
        self,
        *,
        messages: list[dict[str, Any]],
        available_tokens: int,
        remaining_slots: int | None,
    ) -> tuple[list[dict[str, Any]], int, list[dict[str, Any]]]:
        if available_tokens <= 0:
            return [], 0, messages
        if remaining_slots is not None and remaining_slots <= 0:
            return [], 0, messages

        selected_reversed: list[dict[str, Any]] = []
        dropped_reversed: list[dict[str, Any]] = []
        used_tokens = 0

        for message in reversed(messages):
            if remaining_slots is not None and len(selected_reversed) >= remaining_slots:
                dropped_reversed.append(message)
                continue

            message_tokens = self._estimate_tokens(message["text"])
            if used_tokens + message_tokens > available_tokens:
                dropped_reversed.append(message)
                continue
            selected_reversed.append(message)
            used_tokens += message_tokens

        selected = list(reversed(selected_reversed))
        dropped = list(reversed(dropped_reversed))
        return selected, used_tokens, dropped

    def _build_overflow_summary(
        self,
        *,
        dropped_messages: list[dict[str, Any]],
        available_tokens: int,
        remaining_slots: int | None,
    ) -> dict[str, str] | None:
        if not dropped_messages:
            return None
        if self._settings.context_summary_max_chars <= 0:
            return None
        if available_tokens <= 0:
            return None
        if remaining_slots is not None and remaining_slots <= 0:
            return None

        max_chars = self._settings.context_summary_max_chars
        lines = ["Earlier context was truncated. Key snippets:"]
        used_chars = len(lines[0])
        for message in dropped_messages[-8:]:
            role = "assistant" if message["role"] == "app" else "user"
            text = " ".join(message["text"].split())
            snippet = text[:120]
            line = f"- {role}: {snippet}"
            if used_chars + len(line) + 1 > max_chars:
                break
            lines.append(line)
            used_chars += len(line) + 1

        content = "\n".join(lines)
        if self._estimate_tokens(content) > available_tokens:
            return None
        return {"role": "assistant", "content": content}

    def _tighten_conversation(self, conversation: list[dict[str, str]]) -> list[dict[str, str]]:
        if len(conversation) <= 2:
            return conversation

        prompt = conversation[-1]
        history = conversation[:-1]
        keep = max(1, len(history) // 2)
        return history[-keep:] + [prompt]


def _normalize_prompt(text: str) -> str:
    return text.replace("\x00", "").replace("\r\n", "\n").strip()
