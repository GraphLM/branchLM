# branchLM API

## Setup with uv

```bash
cd /Users/raiyanaaijaz/Documents/github/branchLM/api
uv venv
source .venv/bin/activate
uv pip install -e .
```

## Install additional packages

```bash
uv pip install <package-name>
```

## Run the API

```bash
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Test endpoint

- `GET /health` (also `/api/health`)
- `POST /api/chats` (create a chat node)
- `GET /api/graph` (load chats, messages, context edges)
- `PUT /api/graph/layout` (persist chat positions + context edges)

## Auth for `/api/chats`

Send `Authorization: Bearer <token>`.

- Normal mode: use a real Supabase access token from your signed-in user.
- Dev mode: set `AUTH_DEV_BYPASS=true`, then use a token like:
  `dev-bypass:dGVzdEBleGFtcGxlLmNvbQ` (base64url for `test@example.com`).

## Quick test for node creation

```bash
curl -X POST http://127.0.0.1:8000/api/chats \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-bypass:dGVzdEBleGFtcGxlLmNvbQ" \
  -d '{"title":"Node A","position":{"x":120,"y":240}}'
```

## What this stage includes

- App factory (`create_app`) and centralized env settings loading
- CORS middleware configured from env (`API_CORS_ORIGINS`)
- Supabase runtime store + memory fallback
- Token-based user resolution (Supabase auth + dev bypass)
- API to create chat nodes in persistence
