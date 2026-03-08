from __future__ import annotations

import os
from dataclasses import dataclass


def _env(name: str, default: str | None = None) -> str | None:
    val = os.getenv(name)
    if val is None or val.strip() == "":
        return default
    return val


def _env_bool(name: str, default: bool = False) -> bool:
    raw = _env(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _cors_origins_from_env() -> list[str]:
    raw = _env("API_CORS_ORIGINS")
    if not raw:
        # Vite default dev origins
        return ["http://localhost:5173", "http://127.0.0.1:5173"]
    return [o.strip() for o in raw.split(",") if o.strip()]


def _env_int(name: str, default: int) -> int:
    raw = _env(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    raw = _env(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _env_model_windows(name: str) -> dict[str, int]:
    raw = _env(name)
    if not raw:
        return {}

    pairs: dict[str, int] = {}
    for item in raw.split(","):
        entry = item.strip()
        if not entry or ":" not in entry:
            continue
        model, size_raw = entry.split(":", 1)
        model_name = model.strip()
        if not model_name:
            continue
        try:
            size = int(size_raw.strip())
        except ValueError:
            continue
        if size > 0:
            pairs[model_name] = size
    return pairs


@dataclass(frozen=True)
class Settings:
    cors_origins: list[str]
    supabase_url: str | None
    supabase_service_role_key: str | None
    openrouter_api_key: str | None
    openrouter_model: str
    openrouter_base_url: str
    openrouter_site_url: str | None
    openrouter_app_name: str
    openrouter_timeout_seconds: float
    backboard_api_key: str | None
    backboard_base_url: str
    backboard_assistant_id: str | None
    max_prompt_chars: int
    max_history_messages: int
    max_completion_tokens: int
    model_context_window_tokens: int
    input_token_safety_margin: int
    estimated_chars_per_token: int
    context_summary_max_chars: int
    model_context_window_overrides: dict[str, int]
    rate_limit_per_minute: int
    rate_limit_burst: int
    rate_limit_burst_window_seconds: int
    auth_dev_bypass: bool

    @property
    def supabase_enabled(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)

    @property
    def llm_enabled(self) -> bool:
        return bool(self.openrouter_api_key)

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            cors_origins=_cors_origins_from_env(),
            supabase_url=_env("SUPABASE_URL"),
            supabase_service_role_key=_env("SUPABASE_SERVICE_ROLE_KEY"),
            openrouter_api_key=_env("OPENROUTER_API_KEY"),
            openrouter_model=(
                _env("OPENROUTER_MODEL", "openai/gpt-4o-mini") or "openai/gpt-4o-mini"
            ),
            openrouter_base_url=(
                _env("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
                or "https://openrouter.ai/api/v1"
            ),
            openrouter_site_url=_env("OPENROUTER_SITE_URL"),
            openrouter_app_name=_env("OPENROUTER_APP_NAME", "branchLM") or "branchLM",
            openrouter_timeout_seconds=_env_float("OPENROUTER_TIMEOUT_SECONDS", 20.0),
            backboard_api_key=_env("BACKBOARD_API_KEY"),
            backboard_base_url=(
                _env("BACKBOARD_BASE_URL", "https://app.backboard.io/api")
                or "https://app.backboard.io/api"
            ),
            backboard_assistant_id=_env("BACKBOARD_ASSISTANT_ID"),
            max_prompt_chars=_env_int("MAX_PROMPT_CHARS", 4000),
            max_history_messages=_env_int("MAX_HISTORY_MESSAGES", 12),
            max_completion_tokens=_env_int("MAX_COMPLETION_TOKENS", 600),
            model_context_window_tokens=_env_int("MODEL_CONTEXT_WINDOW_TOKENS", 8192),
            input_token_safety_margin=_env_int("INPUT_TOKEN_SAFETY_MARGIN", 256),
            estimated_chars_per_token=_env_int("ESTIMATED_CHARS_PER_TOKEN", 4),
            context_summary_max_chars=_env_int("CONTEXT_SUMMARY_MAX_CHARS", 600),
            model_context_window_overrides=_env_model_windows("MODEL_CONTEXT_WINDOW_OVERRIDES"),
            rate_limit_per_minute=_env_int("RATE_LIMIT_PER_MINUTE", 20),
            rate_limit_burst=_env_int("RATE_LIMIT_BURST", 4),
            rate_limit_burst_window_seconds=_env_int("RATE_LIMIT_BURST_WINDOW_SECONDS", 10),
            auth_dev_bypass=_env_bool("AUTH_DEV_BYPASS", default=False),
        )
