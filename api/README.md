# branchLM API

## Setup with uv

```bash
cd /Users/ayaaniqbal/Desktop/code/GraphLM/branchLM/api
cp .env.example .env
uv sync
```

## Run the API

```bash
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Endpoints

- `GET /health` (also `/api/health`)
- `POST /api/chats` (create a chat node)
- `PATCH /api/chats/{chat_id}` (rename chat)
- `DELETE /api/chats/{chat_id}` (delete chat)
- `POST /api/chats/{chat_id}/messages` (add message)
- `POST /api/chats/{chat_id}/generate` (LLM reply; adds user + app messages)
- `DELETE /api/messages/{message_id}` (delete message)
- `GET /api/graph` (load chats, messages, context edges)
- `PUT /api/graph/layout` (persist chat positions + context edges)

## Auth for protected routes

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

## LLM and rate limiting behavior

- `/api/chats/{chat_id}/generate` requires `OPENROUTER_API_KEY`.
- Empty prompts and oversized prompts are rejected with `400`.
- Generate calls are rate-limited per `user_id + client_ip`.
- When limited, API returns `429` with `Retry-After` header.
- Provider/network failures are sanitized to safe `502/503` messages.

## Frontend run (`branchLM/web`)

```bash
cd /Users/ayaaniqbal/Desktop/code/GraphLM/branchLM/web
npm install
npm run dev
```

- Open the URL printed by Vite (typically `http://localhost:5173`).
- Ensure web is configured to send bearer tokens expected by this API.

## What this stage includes

- App factory (`create_app`) and centralized env settings loading
- CORS middleware configured from env (`API_CORS_ORIGINS`)
- Supabase runtime store + memory fallback
- Token-based user resolution (Supabase auth + dev bypass)
- Chat/message CRUD endpoints
- LLM generate endpoint via OpenRouter with rate limiting
