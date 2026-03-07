from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import chats, graph, health, messages
from services.llm_service import OpenRouterClient
from services.rate_limit import SlidingWindowRateLimiter
from settings import Settings
from store.memory import MemoryStore


def create_app() -> FastAPI:
    env_path = Path(__file__).resolve().with_name(".env")
    load_dotenv(dotenv_path=env_path)

    settings = Settings.from_env()
    app = FastAPI(title="branchLM API", version="0.1.0")
    app.state.settings = settings

    # Store selection: Supabase when configured, otherwise in-memory fallback.
    if settings.supabase_enabled:
        try:
            from supabase import create_client

            from store.supabase import SupabaseStore
        except ModuleNotFoundError:
            app.state.supabase_admin = None
            app.state.store = MemoryStore()
        else:
            assert settings.supabase_url and settings.supabase_service_role_key
            supabase_admin = create_client(
                settings.supabase_url, settings.supabase_service_role_key
            )
            app.state.supabase_admin = supabase_admin
            app.state.store = SupabaseStore.from_client(supabase_admin)
    else:
        app.state.supabase_admin = None
        app.state.store = MemoryStore()

    app.state.llm_client = OpenRouterClient(settings)
    app.state.rate_limiter = SlidingWindowRateLimiter(settings)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(graph.router)
    app.include_router(chats.router)
    app.include_router(messages.router)

    return app


app = create_app()
