from __future__ import annotations

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import backboard, chats, context_nodes, graph, health, messages, workspaces
from services.backboard_service import BackboardClient
from services.metrics import AppMetrics
from services.rate_limit import SlidingWindowRateLimiter
from settings import Settings
from store.memory import MemoryStore


def create_app() -> FastAPI:
    load_dotenv()

    settings = Settings.from_env()
    app = FastAPI(title="branchLM API", version="0.0.0")
    app.state.settings = settings
    app.state.backboard_client = BackboardClient(settings)
    app.state.rate_limiter = SlidingWindowRateLimiter(settings)
    app.state.metrics = AppMetrics()

    # TODO: tighten CORS for production
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Initialize persistence adapter once and attach to app.state.
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

    app.include_router(health.router)
    app.include_router(workspaces.router)
    app.include_router(graph.router)
    app.include_router(chats.router)
    app.include_router(messages.router)
    app.include_router(context_nodes.router)
    app.include_router(backboard.router)
    return app


app = create_app()
