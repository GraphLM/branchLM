from __future__ import annotations

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from settings import Settings


def create_app() -> FastAPI:
    load_dotenv()

    settings = Settings.from_env()
    app = FastAPI(title="branchLM API", version="0.1.0")
    app.state.settings = settings

    # Placeholders for upcoming commits that introduce concrete implementations.
    app.state.store = None
    app.state.llm_client = None
    app.state.rate_limiter = None
    app.state.supabase_admin = None

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
