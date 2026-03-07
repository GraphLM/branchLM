from __future__ import annotations

import logging
import re
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
from services.backboard_service import BackboardClient, BackboardServiceError
from services.llm_service import LLMConfigurationError, LLMServiceError, OpenRouterClient
from services.metrics import AppMetrics
from services.rate_limit import SlidingWindowRateLimiter
from settings import Settings
from store.base import Store

logger = logging.getLogger(__name__)

try:  # pragma: no cover - optional dependency
    import tiktoken  # type: ignore[import-not-found]
except Exception:  # pragma: no cover - optional dependency
    tiktoken = None


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

    def patch_workspace(self, *, user_id: str, workspace_id: str, body: PatchWorkspaceBody) -> None:
        self._store.update_workspace_title(user_id, workspace_id, body.title)

    def delete_workspace(self, *, user_id: str, workspace_id: str) -> None:
        self._store.delete_workspace(user_id, workspace_id)


class ChatService:
    def __init__(self, store: Store, settings: Settings) -> None:
        self._store = store
        self._settings = settings

    def create_chat(
        self, *, user_id: str, workspace_id: str, body: CreateChatBody
    ) -> dict[str, Any]:
        selected_model = body.model or self._settings.openrouter_model
        return self._store.create_chat(
            user_id,
            workspace_id,
            body.title,
            body.position.x,
            body.position.y,
            selected_model,
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
        metrics: AppMetrics,
        backboard: BackboardClient,
    ) -> None:
        self._store = store
        self._llm_client = llm_client
        self._rate_limiter = rate_limiter
        self._settings = settings
        self._metrics = metrics
        self._backboard = backboard
        self._encoder_cache: dict[str, Any] = {}

    def generate_chat_reply(
        self,
        *,
        user_id: str,
        workspace_id: str,
        chat_id: str,
        body: GenerateReplyBody,
        client_ip: str,
    ) -> dict[str, Any]:
        chat = self._require_chat(user_id=user_id, workspace_id=workspace_id, chat_id=chat_id)

        prompt = self._validate_prompt(body.text)
        self._enforce_rate_limit(user_id=user_id, client_ip=client_ip)

        model = body.model or chat.get("model") or self._settings.openrouter_model
        conversation = self._build_conversation(
            user_id=user_id,
            workspace_id=workspace_id,
            chat_id=chat_id,
            prompt=prompt,
            model=model,
        )
        reply_text = self._call_llm(conversation, model=model)

        user_message = self._store.create_message(user_id, workspace_id, chat_id, "user", prompt)
        app_message = self._store.create_message(user_id, workspace_id, chat_id, "app", reply_text)

        self._metrics.incr("generate.requests")
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

    def _require_chat(self, *, user_id: str, workspace_id: str, chat_id: str) -> dict[str, Any]:
        chat = self._store.get_chat(user_id, workspace_id, chat_id)
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        return chat

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
        self,
        *,
        user_id: str,
        workspace_id: str,
        chat_id: str,
        prompt: str,
        model: str,
    ) -> list[dict[str, str]]:
        source_context, chat_history = self._build_spliced_history(
            user_id=user_id,
            workspace_id=workspace_id,
            chat_id=chat_id,
        )
        external_context = self._build_external_context(
            user_id=user_id,
            workspace_id=workspace_id,
            chat_id=chat_id,
            prompt=prompt,
        )

        input_budget = self._max_input_tokens(model)
        prompt_tokens = self._estimate_tokens(prompt, model=model)
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
            model=model,
        )
        available_for_history -= used_chat_tokens
        if remaining_message_slots is not None:
            remaining_message_slots -= len(selected_chat_history)

        # Tier B: fill remaining budget with branch-spliced context.
        selected_source_context, used_source_tokens, dropped_source = (
            self._select_messages_by_budget(
                messages=source_context,
                available_tokens=available_for_history,
                remaining_slots=remaining_message_slots,
                model=model,
            )
        )
        available_for_history -= used_source_tokens
        if remaining_message_slots is not None:
            remaining_message_slots -= len(selected_source_context)

        summary_message = self._build_overflow_summary(
            prompt=prompt,
            dropped_messages=dropped_source + dropped_chat,
            available_tokens=available_for_history,
            remaining_slots=remaining_message_slots,
            model=model,
        )

        prior_messages = selected_source_context + selected_chat_history
        conversation = [self._to_llm_message(message) for message in prior_messages]
        if external_context:
            conversation.insert(0, {"role": "system", "content": external_context})
        if summary_message:
            conversation.insert(0, summary_message)
        conversation.append({"role": "user", "content": prompt})

        dropped_count = len(dropped_source) + len(dropped_chat)
        self._metrics.incr("context.history_selected", len(prior_messages))
        self._metrics.incr("context.history_dropped", dropped_count)
        self._metrics.incr("context.prompt_tokens_est", prompt_tokens)

        logger.info(
            (
                "conversation_built chat_id=%s model=%s prompt_tokens=%d "
                "history_msgs=%d dropped_msgs=%d estimated_input_tokens=%d"
            ),
            chat_id,
            model,
            prompt_tokens,
            len(prior_messages),
            dropped_count,
            prompt_tokens
            + sum(self._estimate_tokens(m["content"], model=model) for m in conversation[:-1]),
        )
        return conversation

    def _build_external_context(
        self, *, user_id: str, workspace_id: str, chat_id: str, prompt: str
    ) -> str:
        if not self._backboard.enabled:
            return ""
        context_nodes = self._store.list_context_nodes_for_chat(user_id, workspace_id, chat_id)
        if not context_nodes:
            return ""
        snippets: list[str] = []
        for node in context_nodes[:4]:
            assets = self._store.list_context_node_assets(user_id, workspace_id, node["id"])
            if not assets:
                continue
            thread_id = str(node.get("backboard_thread_id") or "")
            if not thread_id:
                continue
            try:
                answer = self._backboard.query_thread(
                    thread_id=thread_id,
                    prompt=(
                        "Using only the uploaded files in this thread, extract the most relevant "
                        "facts for the query below. Keep it concise. "
                        "If nothing relevant, say NONE.\n"
                        f"Query: {prompt}"
                    ),
                )
            except BackboardServiceError as exc:
                logger.warning("backboard_query_failed node_id=%s error=%s", node.get("id"), exc)
                continue
            answer = answer.strip()
            if not answer or answer.upper() == "NONE":
                continue
            snippets.append(f"[Context Node: {node.get('title', 'Untitled')}] {answer}")
        if not snippets:
            return ""
        return "External context retrieved from context nodes:\n" + "\n".join(
            f"- {snippet}" for snippet in snippets
        )

    def _build_spliced_history(
        self, *, user_id: str, workspace_id: str, chat_id: str
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        # Source context snapshot is precomputed and persisted when graph edges are saved.
        source_context_rows = self._store.list_context_messages_for_chat(
            user_id, workspace_id, chat_id
        )
        source_context = [
            {"role": row["role"], "text": row["text"], "id": row.get("message_id", "")}
            for row in source_context_rows
        ]

        chat_history_rows = self._store.list_messages_for_chat(user_id, workspace_id, chat_id)
        source_ids = {m.get("id") for m in source_context if m.get("id")}
        chat_history = [
            message for message in chat_history_rows if message.get("id") not in source_ids
        ]
        return source_context, chat_history

    def _call_llm(self, conversation: list[dict[str, str]], *, model: str) -> str:
        current_conversation = conversation
        for attempt in range(2):
            try:
                return self._llm_client.generate_reply(current_conversation, model=model)
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
                        self._metrics.incr("context.overflow_retries")
                        logger.warning(
                            (
                                "context_overflow_retry model=%s "
                                "original_messages=%d tightened_messages=%d"
                            ),
                            model,
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

    def _max_input_tokens(self, model: str) -> int:
        context_window = self._settings.model_context_window_overrides.get(
            model,
            self._settings.model_context_window_tokens,
        )
        budget = (
            context_window
            - self._settings.max_completion_tokens
            - self._settings.input_token_safety_margin
        )
        return max(32, budget)

    def _estimate_tokens(self, text: str, *, model: str) -> int:
        if not text:
            return 1

        if tiktoken is not None:
            encoder = self._encoder_for_model(model)
            if encoder is not None:
                try:
                    return len(encoder.encode(text)) + 4
                except Exception as exc:  # pragma: no cover - tokenizer-dependent
                    logger.debug("tokenizer_encode_failed model=%s error=%s", model, exc)

        chars_per_token = max(1, self._settings.estimated_chars_per_token)
        return max(1, (len(text) + chars_per_token - 1) // chars_per_token) + 4

    def _encoder_for_model(self, model: str) -> Any | None:
        if tiktoken is None:
            return None
        cached = self._encoder_cache.get(model)
        if cached is not None:
            return cached

        candidate_names = [model]
        if "/" in model:
            candidate_names.append(model.split("/", 1)[1])

        encoder = None
        for name in candidate_names:
            try:
                encoder = tiktoken.encoding_for_model(name)
                break
            except Exception as exc:  # pragma: no cover - tokenizer-dependent
                logger.debug("tokenizer_model_lookup_failed model=%s error=%s", name, exc)
                continue
        if encoder is None:
            try:
                encoder = tiktoken.get_encoding("cl100k_base")
            except Exception:
                encoder = None

        self._encoder_cache[model] = encoder
        return encoder

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
        model: str,
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

            message_tokens = self._estimate_tokens(message["text"], model=model)
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
        prompt: str,
        dropped_messages: list[dict[str, Any]],
        available_tokens: int,
        remaining_slots: int | None,
        model: str,
    ) -> dict[str, str] | None:
        if not dropped_messages:
            return None
        if self._settings.context_summary_max_chars <= 0:
            return None
        if available_tokens <= 0:
            return None
        if remaining_slots is not None and remaining_slots <= 0:
            return None

        ranked = self._retrieve_relevant_messages(prompt=prompt, messages=dropped_messages)

        max_chars = self._settings.context_summary_max_chars
        lines = ["Earlier context was truncated. Relevant snippets:"]
        used_chars = len(lines[0])
        for message in ranked[:8]:
            role = "assistant" if message["role"] == "app" else "user"
            text = " ".join(message["text"].split())
            snippet = text[:120]
            line = f"- {role}: {snippet}"
            if used_chars + len(line) + 1 > max_chars:
                break
            lines.append(line)
            used_chars += len(line) + 1

        content = "\n".join(lines)
        if self._estimate_tokens(content, model=model) > available_tokens:
            return None
        return {"role": "assistant", "content": content}

    def _retrieve_relevant_messages(
        self, *, prompt: str, messages: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        query_terms = set(_tokenize_for_retrieval(prompt))
        if not query_terms:
            return messages

        scored: list[tuple[int, int, dict[str, Any]]] = []
        for idx, message in enumerate(messages):
            terms = _tokenize_for_retrieval(message["text"])
            overlap = len(query_terms.intersection(terms))
            scored.append((overlap, idx, message))

        scored.sort(key=lambda item: (item[0], item[1]), reverse=True)
        best = [item[2] for item in scored if item[0] > 0]
        if not best:
            return messages

        # Preserve original order for readability after selecting relevant chunks.
        selected_ids = {id(message) for message in best[:8]}
        return [m for m in messages if id(m) in selected_ids]

    def _tighten_conversation(self, conversation: list[dict[str, str]]) -> list[dict[str, str]]:
        if len(conversation) <= 2:
            return conversation

        prompt = conversation[-1]
        history = conversation[:-1]
        keep = max(1, len(history) // 2)
        return history[-keep:] + [prompt]


def _normalize_prompt(text: str) -> str:
    return text.replace("\x00", "").replace("\r\n", "\n").strip()


def _tokenize_for_retrieval(text: str) -> set[str]:
    return {token for token in re.findall(r"[a-z0-9]+", text.lower()) if len(token) >= 3}
