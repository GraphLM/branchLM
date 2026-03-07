# branchLM API

## Setup (using `uv`)

```bash
cd /Users/ayaaniqbal/Desktop/code/GraphLM/branchLM/api
cp .env.example .env
uv sync
```

## Run the API

```bash
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Current endpoints

- `GET /health`

## What this stage includes

- App factory (`create_app`) and centralized env settings loading
- CORS middleware configured from env (`API_CORS_ORIGINS`)
- Runtime state placeholders for upcoming store/auth/LLM commits
