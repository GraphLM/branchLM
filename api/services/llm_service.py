from __future__ import annotations

import json
import time
from collections.abc import Sequence
from typing import Any
from urllib import error, parse, request

from settings import Settings


class LLMConfigurationError(RuntimeError):
    pass


class LLMServiceError(RuntimeError):
    def __init__(self, message: str, *, code: str | None = None) -> None:
        super().__init__(message)
        self.code = code


class OpenRouterClient:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def generate_reply(
        self, messages: Sequence[dict[str, str]], *, model: str | None = None
    ) -> str:
        if not self._settings.llm_enabled:
            raise LLMConfigurationError("OpenRouter is not configured.")

        url = f"{self._settings.openrouter_base_url.rstrip('/')}/chat/completions"
        self._validate_url(url)
        headers = {
            "Authorization": f"Bearer {self._settings.openrouter_api_key}",
            "Content-Type": "application/json",
            "X-Title": self._settings.openrouter_app_name,
        }
        if self._settings.openrouter_site_url:
            headers["HTTP-Referer"] = self._settings.openrouter_site_url

        payload = json.dumps(
            {
                "model": model or self._settings.openrouter_model,
                "messages": list(messages),
                "max_tokens": self._settings.max_completion_tokens,
            }
        ).encode("utf-8")

        for attempt in range(3):
            req = request.Request(  # noqa: S310
                url,
                data=payload,
                headers=headers,
                method="POST",
            )
            try:
                with request.urlopen(  # noqa: S310  # nosec B310
                    req, timeout=self._settings.openrouter_timeout_seconds
                ) as response:
                    data = json.loads(response.read().decode("utf-8"))
                return self._extract_text(data)
            except error.HTTPError as exc:
                status_code = exc.code
                raw_body = ""
                try:
                    raw_body = exc.read().decode("utf-8", errors="ignore")
                except Exception:
                    raw_body = ""
                should_retry = status_code == 429 or 500 <= status_code < 600
                if should_retry and attempt < 2:
                    time.sleep(0.4 * (attempt + 1))
                    continue
                message, code = self._message_for_status(status_code, raw_body)
                raise LLMServiceError(message, code=code) from exc
            except (error.URLError, TimeoutError) as exc:
                if attempt < 2:
                    time.sleep(0.4 * (attempt + 1))
                    continue
                raise LLMServiceError("The language model is temporarily unavailable.") from exc
            except (KeyError, TypeError, ValueError) as exc:
                raise LLMServiceError("The language model returned an invalid response.") from exc

        raise LLMServiceError("The language model is temporarily unavailable.")

    @staticmethod
    def _extract_text(payload: dict[str, Any]) -> str:
        choices = payload.get("choices")
        if not isinstance(choices, list) or not choices:
            raise ValueError("Missing choices")

        message = choices[0].get("message")
        if not isinstance(message, dict):
            raise ValueError("Missing message")

        content = message.get("content")
        if isinstance(content, str):
            text = content.strip()
        elif isinstance(content, list):
            text_parts = [
                part.get("text", "")
                for part in content
                if isinstance(part, dict) and part.get("type") == "text"
            ]
            text = "".join(text_parts).strip()
        else:
            raise ValueError("Missing content")

        if not text:
            raise ValueError("Empty content")
        return text

    @staticmethod
    def _validate_url(url: str) -> None:
        parsed = parse.urlparse(url)
        if parsed.scheme != "https":
            raise LLMConfigurationError("OpenRouter base URL must use https.")
        if not parsed.netloc:
            raise LLMConfigurationError("OpenRouter base URL is invalid.")

    @staticmethod
    def _message_for_status(status_code: int, raw_body: str) -> tuple[str, str | None]:
        body = raw_body.lower()
        context_overflow_markers = (
            "context length",
            "context window",
            "too many tokens",
            "maximum context",
            "prompt is too long",
        )
        if any(marker in body for marker in context_overflow_markers):
            return ("The prompt exceeded the model context window.", "context_length_exceeded")
        if status_code == 429:
            return ("The language model is rate limited right now. Please retry shortly.", None)
        if 400 <= status_code < 500:
            return ("The language model request was rejected.", None)
        return ("The language model is temporarily unavailable.", None)
