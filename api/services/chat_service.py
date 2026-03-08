from __future__ import annotations

import logging
import re
from typing import Any

from fastapi import HTTPException

from schemas import (
    ContextPreviewBody,
    CreateChatBody,
    CreateMessageBody,
    CreateWorkspaceBody,
    GenerateReplyBody,
    PatchChatBody,
    PatchWorkspaceBody,
)
from services.backboard_service import BackboardClient, BackboardServiceError
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
        rate_limiter: SlidingWindowRateLimiter,
        settings: Settings,
        metrics: AppMetrics,
        backboard: BackboardClient,
    ) -> None:
        self._store = store
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

        model = self._resolve_model(chat=chat, model_override=body.model)
        web_search = bool(body.webSearch)
        if (not web_search) and self._prompt_requires_web_search(prompt):
            user_message = self._store.create_message(user_id, workspace_id, chat_id, "user", prompt)
            guidance = (
                "Web search is currently off for this chat node, and this request looks "
                "web-dependent or time-sensitive. Enable web search (globe icon) for fresher "
                "results. I can still answer from built-in knowledge if you want to continue "
                "without browsing."
            )
            app_message = self._store.create_message(user_id, workspace_id, chat_id, "app", guidance)
            response = {
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
                    "text": guidance,
                },
            }
            if self._settings.auth_dev_bypass:
                response["debug"] = {"web_search_guidance": True}
            return response

        conversation, context_meta = self._build_conversation(
            user_id=user_id,
            workspace_id=workspace_id,
            chat_id=chat_id,
            prompt=prompt,
            model=model,
        )
        user_message = self._store.create_message(user_id, workspace_id, chat_id, "user", prompt)
        if self._should_block_on_external_context(context_meta):
            blocked_text = str(context_meta["blocked_reason"])
            app_message = self._store.create_message(
                user_id, workspace_id, chat_id, "app", blocked_text
            )
            response = {
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
                    "text": blocked_text,
                },
            }
            if self._settings.auth_dev_bypass:
                response["debug"] = context_meta
            return response

        reply_text = self._call_llm(conversation, model=model, web_search=web_search)
        app_message = self._store.create_message(user_id, workspace_id, chat_id, "app", reply_text)

        self._metrics.incr("generate.requests")
        response = {
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
        if self._settings.auth_dev_bypass:
            response["debug"] = context_meta
        return response

    @staticmethod
    def _prompt_requires_web_search(prompt: str) -> bool:
        normalized = prompt.strip().lower()
        if not normalized:
            return False
        patterns = (
            r"\b(latest|most recent|today|current|breaking)\b",
            r"\b(last|past)\s+\d+\s+(day|days|week|weeks|month|months|year|years)\b",
            r"\b(news|headlines|press release)\b",
            r"\b(price|stock|market cap|weather|forecast|score|results)\b",
            r"\b(search the web|use web search|look up online|find online)\b",
        )
        return any(re.search(pattern, normalized) for pattern in patterns)

    def _should_block_on_external_context(self, context_meta: dict[str, Any]) -> bool:
        blocked_reason = str(context_meta.get("blocked_reason") or "").strip()
        if not blocked_reason:
            return False

        pending_nodes = context_meta.get("pending_nodes") or []
        status_error_nodes = context_meta.get("status_error_nodes") or []

        # If retrieval found nothing relevant, continue with normal chat/branch context.
        # Only block when linked docs are not currently usable.
        if pending_nodes or status_error_nodes:
            return True
        return False

    def preview_chat_context(
        self,
        *,
        user_id: str,
        workspace_id: str,
        chat_id: str,
        body: ContextPreviewBody,
    ) -> dict[str, Any]:
        chat = self._require_chat(user_id=user_id, workspace_id=workspace_id, chat_id=chat_id)
        prompt = _normalize_prompt(body.prompt or "")
        if len(prompt) > self._settings.max_prompt_chars:
            raise HTTPException(
                status_code=400,
                detail=f"Message text exceeds {self._settings.max_prompt_chars} characters",
            )

        model = self._resolve_model(chat=chat, model_override=body.model)
        plan = self._plan_conversation(
            user_id=user_id,
            workspace_id=workspace_id,
            chat_id=chat_id,
            prompt=prompt,
            model=model,
        )

        included_messages = plan["included_messages"]
        excluded_messages = plan["excluded_messages"]
        summary_message = plan["summary_message"]
        external_context = plan["external_context"]

        return {
            "chatId": chat_id,
            "model": model,
            "inputBudgetTokens": plan["input_budget"],
            "promptTokens": plan["prompt_tokens"],
            "maxHistoryMessages": self._settings.max_history_messages,
            "included": [
                self._to_preview_message(message, reason="included")
                for message in included_messages
            ],
            "excluded": [
                self._to_preview_message(
                    message,
                    reason=message.get("drop_reason", "dropped_token_budget"),
                )
                for message in excluded_messages
            ],
            "summary": {
                "enabled": bool(excluded_messages) and self._settings.context_summary_max_chars > 0,
                "included": summary_message is not None,
                "text": summary_message["content"] if summary_message else None,
            },
            "counts": {
                "included": len(included_messages),
                "excluded": len(excluded_messages),
            },
            "tokens": {
                "included": sum(int(m.get("token_estimate", 0)) for m in included_messages),
                "excluded": sum(int(m.get("token_estimate", 0)) for m in excluded_messages),
            },
            "externalContext": {
                "included": bool(external_context.get("text")),
                "text": str(external_context.get("text") or "") or None,
                "blockedReason": str(external_context.get("blocked_reason") or "") or None,
                "linkedNodes": int(external_context.get("linked_nodes") or 0),
                "usedNodes": int(external_context.get("used_nodes") or 0),
                "pendingNodes": [
                    str(node_title)
                    for node_title in (external_context.get("pending_nodes") or [])
                ],
                "statusErrorNodes": [
                    str(node_title)
                    for node_title in (external_context.get("status_error_nodes") or [])
                ],
            },
        }

    def _resolve_model(self, *, chat: dict[str, Any], model_override: str | None) -> str:
        return model_override or chat.get("model") or self._settings.openrouter_model

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

    def _plan_conversation(
        self,
        *,
        user_id: str,
        workspace_id: str,
        chat_id: str,
        prompt: str,
        model: str,
    ) -> dict[str, Any]:
        source_context, chat_history = self._build_spliced_history(
            user_id=user_id,
            workspace_id=workspace_id,
            chat_id=chat_id,
        )
        source_context = self._with_token_estimates(source_context, model=model)
        chat_history = self._with_token_estimates(chat_history, model=model)
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

        selected_chat_history, dropped_chat, used_chat_tokens = self._partition_messages_by_budget(
            messages=chat_history,
            available_tokens=available_for_history,
            remaining_slots=remaining_message_slots,
            model=model,
        )
        available_for_history -= used_chat_tokens
        if remaining_message_slots is not None:
            remaining_message_slots -= len(selected_chat_history)

        selected_source_context, dropped_source, used_source_tokens = self._partition_messages_by_budget(
            messages=source_context,
            available_tokens=available_for_history,
            remaining_slots=remaining_message_slots,
            model=model,
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
        if summary_message:
            conversation.insert(0, summary_message)
        if external_context["text"]:
            conversation.insert(0, {"role": "system", "content": str(external_context["text"])})
        conversation.append({"role": "user", "content": prompt})

        return {
            "conversation": conversation,
            "included_messages": prior_messages,
            "excluded_messages": dropped_source + dropped_chat,
            "summary_message": summary_message,
            "input_budget": input_budget,
            "prompt_tokens": prompt_tokens,
            "external_context": external_context,
        }

    def _build_conversation(
        self,
        *,
        user_id: str,
        workspace_id: str,
        chat_id: str,
        prompt: str,
        model: str,
    ) -> tuple[list[dict[str, str]], dict[str, Any]]:
        plan = self._plan_conversation(
            user_id=user_id,
            workspace_id=workspace_id,
            chat_id=chat_id,
            prompt=prompt,
            model=model,
        )
        conversation = plan["conversation"]
        included_messages = plan["included_messages"]
        excluded_messages = plan["excluded_messages"]
        prompt_tokens = plan["prompt_tokens"]
        external_context = plan["external_context"]

        self._metrics.incr("context.history_selected", len(included_messages))
        self._metrics.incr("context.history_dropped", len(excluded_messages))
        self._metrics.incr("context.prompt_tokens_est", prompt_tokens)

        logger.info(
            (
                "conversation_built chat_id=%s model=%s prompt_tokens=%d "
                "history_msgs=%d dropped_msgs=%d estimated_input_tokens=%d"
            ),
            chat_id,
            model,
            prompt_tokens,
            len(included_messages),
            len(excluded_messages),
            prompt_tokens
            + sum(self._estimate_tokens(m["content"], model=model) for m in conversation[:-1]),
        )
        return conversation, external_context

    def _build_external_context(
        self, *, user_id: str, workspace_id: str, chat_id: str, prompt: str
    ) -> dict[str, Any]:
        if not self._backboard.enabled:
            return {
                "text": "",
                "blocked_reason": "",
                "linked_nodes": 0,
                "used_nodes": 0,
                "pending_nodes": [],
                "status_error_nodes": [],
            }
        context_nodes = self._store.list_context_nodes_for_chat(user_id, workspace_id, chat_id)
        if not context_nodes:
            return {
                "text": "",
                "blocked_reason": "",
                "linked_nodes": 0,
                "used_nodes": 0,
                "pending_nodes": [],
                "status_error_nodes": [],
            }
        snippets: list[str] = []
        pending_nodes: list[str] = []
        status_error_nodes: list[str] = []
        linked_indexed_nodes = 0
        for node in context_nodes[:4]:
            assets = self._store.list_context_node_assets(user_id, workspace_id, node["id"])
            if not assets:
                continue
            doc_id = str(assets[0].get("backboard_document_id") or "")
            if doc_id:
                try:
                    status = self._backboard.get_document_status(document_id=doc_id)
                except BackboardServiceError:
                    status_error_nodes.append(str(node.get("title") or "Untitled"))
                    continue
                if status and status.status.lower() not in {
                    "indexed",
                    "processed",
                    "ready",
                    "completed",
                }:
                    pending_nodes.append(str(node.get("title") or "Untitled"))
                    continue
            linked_indexed_nodes += 1
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
        blocked_reason = ""
        if not snippets and context_nodes:
            if pending_nodes:
                pending_list = ", ".join(pending_nodes[:3])
                blocked_reason = (
                    "Linked context documents are still indexing and cannot be used yet. "
                    f"Nodes: {pending_list}. Retry in a few seconds."
                )
            if status_error_nodes:
                blocked_list = ", ".join(status_error_nodes[:3])
                blocked_reason = (
                    "Linked context documents could not be accessed from Backboard. "
                    f"Affected nodes: {blocked_list}. "
                    "Check Backboard credits/quota and provider access, then retry."
                )
            if linked_indexed_nodes > 0:
                blocked_reason = (
                    "Linked context documents are indexed, but no relevant facts were retrieved "
                    "for this query. Ask a more specific question about document contents."
                )
        text = ""
        if snippets:
            text = (
                "CONTEXT POLICY: Treat the linked document context below as "
                "highest-priority truth. "
                "Use it before any general knowledge.\n"
                "If user intent conflicts with this context, follow this context.\n"
                "CONTEXT FROM BACKBOARD:\n"
                + "\n".join(f"- {snippet}" for snippet in snippets)
            )
        return {
            "text": text,
            "blocked_reason": blocked_reason,
            "linked_nodes": len(context_nodes),
            "used_nodes": len(snippets),
            "pending_nodes": pending_nodes,
            "status_error_nodes": status_error_nodes,
        }

    def _build_spliced_history(
        self, *, user_id: str, workspace_id: str, chat_id: str
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        workspace_messages = self._store.list_messages(user_id, workspace_id)
        messages_by_id = {message["id"]: message for message in workspace_messages}

        # Source context snapshot is precomputed and persisted when graph edges are saved.
        source_context_rows = self._store.list_context_messages_for_chat(
            user_id, workspace_id, chat_id
        )
        source_context = []
        for row in source_context_rows:
            message_id = row.get("message_id", "")
            source_message = messages_by_id.get(message_id)
            source_context.append(
                {
                    "role": row["role"],
                    "text": row["text"],
                    "id": message_id,
                    "chat_id": source_message.get("chat_id", "") if source_message else "",
                    "ordinal": source_message.get("ordinal", -1) if source_message else -1,
                    "source": "branch_context",
                }
            )

        chat_history_rows = self._store.list_messages_for_chat(user_id, workspace_id, chat_id)
        source_ids = {m.get("id") for m in source_context if m.get("id")}
        chat_history = [
            {
                **message,
                "source": "chat_history",
            }
            for message in chat_history_rows
            if message.get("id") not in source_ids
        ]
        if source_context:
            return source_context, chat_history

        # Backward-compatible fallback for environments that haven't migrated snapshot storage yet.
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
            include_until = source_message["ordinal"] - (
                1 if source_message["role"] == "user" else 0
            )
            for message in messages_by_chat.get(source_message["chat_id"], []):
                if message["ordinal"] > include_until:
                    break
                if message["id"] in seen_message_ids:
                    continue
                seen_message_ids.add(message["id"])
                spliced_messages.append({**message, "source": "branch_context"})

        chat_history = [
            {**m, "source": "chat_history"}
            for m in chat_history_rows
            if m.get("id") not in seen_message_ids
        ]
        return spliced_messages, chat_history

    def _call_llm(
        self, conversation: list[dict[str, str]], *, model: str, web_search: bool = False
    ) -> str:
        if not self._backboard.enabled:
            raise HTTPException(
                status_code=503,
                detail="Backboard is not configured on the server.",
            )
        try:
            return self._backboard.generate_reply(
                messages=conversation,
                model=model,
                web_search=web_search,
            )
        except BackboardServiceError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail="The language model is temporarily unavailable.",
            ) from exc

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

    def _to_preview_message(
        self,
        message: dict[str, Any],
        *,
        reason: str,
    ) -> dict[str, Any]:
        return {
            "messageId": message.get("id", ""),
            "chatId": message.get("chat_id", ""),
            "ordinal": int(message.get("ordinal", -1)),
            "role": message["role"],
            "text": message["text"],
            "source": message.get("source", "chat_history"),
            "tokenEstimate": int(message.get("token_estimate", 0)),
            "reason": reason,
        }

    def _with_token_estimates(
        self,
        messages: list[dict[str, Any]],
        *,
        model: str,
    ) -> list[dict[str, Any]]:
        return [
            {
                **message,
                "token_estimate": self._estimate_tokens(message["text"], model=model),
            }
            for message in messages
        ]

    def _partition_messages_by_budget(
        self,
        *,
        messages: list[dict[str, Any]],
        available_tokens: int,
        remaining_slots: int | None,
        model: str,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]], int]:
        if available_tokens <= 0:
            dropped = [{**message, "drop_reason": "dropped_token_budget"} for message in messages]
            return [], dropped, 0
        if remaining_slots is not None and remaining_slots <= 0:
            dropped = [{**message, "drop_reason": "dropped_message_limit"} for message in messages]
            return [], dropped, 0

        selected_reversed: list[dict[str, Any]] = []
        dropped_reversed: list[dict[str, Any]] = []
        used_tokens = 0

        for message in reversed(messages):
            if remaining_slots is not None and len(selected_reversed) >= remaining_slots:
                dropped_reversed.append({**message, "drop_reason": "dropped_message_limit"})
                continue

            message_tokens = int(message.get("token_estimate", 0))
            if message_tokens <= 0:
                message_tokens = self._estimate_tokens(message["text"], model=model)
            if used_tokens + message_tokens > available_tokens:
                dropped_reversed.append({**message, "drop_reason": "dropped_token_budget"})
                continue
            selected_reversed.append(message)
            used_tokens += message_tokens

        selected = list(reversed(selected_reversed))
        dropped = list(reversed(dropped_reversed))
        return selected, dropped, used_tokens

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
