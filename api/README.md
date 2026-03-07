## graphLM API (temporary)

This FastAPI service backs the graph canvas in `web/src/flow/FlowCanvas.tsx`.

### Setup (using `uv`)

```bash
cd api
cp .env.example .env
# Fill in SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from your Supabase project settings
# Fill in OPENROUTER_API_KEY to enable chat generation
uv sync
```

### Supabase schema

This repo now uses **Supabase migrations** under `supabase/migrations/`.

- For a one-off manual setup, you can still run `api/supabase_schema.sql` in the Supabase SQL editor.
- Recommended: use the Supabase CLI and run `supabase db push` (see repo root README / commands below).

### Run dev server

```bash
cd api
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Endpoints

- `GET /api/health` health check
- `GET /api/graph` load graph
- `PUT /api/graph/layout` persist layout + context edges
- `POST /api/chats` create a chat
- `PATCH /api/chats/{chatId}` rename chat
- `DELETE /api/chats/{chatId}` delete chat (cascades)
- `POST /api/chats/{chatId}/messages` add message
- `POST /api/chats/{chatId}/generate` create a user message and an LLM reply
- `DELETE /api/messages/{messageId}` delete message

All graph/chats/messages endpoints require:

```http
Authorization: Bearer <supabase_access_token>
```

Dev bypass option:

- Set `AUTH_DEV_BYPASS=true` to accept synthetic dev tokens shaped like `dev-bypass:<base64url_email>`.
- Intended only for local development.

### LLM safeguards

- OpenRouter credentials are server-only and read from `.env`
- Prompt size, history size, and completion size are capped with env-configurable limits
- Chat generation is rate-limited per user and client IP
- When provider calls fail, the API returns sanitized error messages without exposing provider details
- `GET /api/graph` load graph
- `PUT /api/graph/layout` persist layout + context edges
- `POST /api/chats` create a chat
- `PATCH /api/chats/{chatId}` rename chat
- `DELETE /api/chats/{chatId}` delete chat (cascades)
- `POST /api/chats/{chatId}/messages` add message
- `DELETE /api/messages/{messageId}` delete message

All graph/chats/messages endpoints require:

```http
Authorization: Bearer <supabase_access_token>
```

Dev bypass option:

- Set `AUTH_DEV_BYPASS=true` to accept synthetic dev tokens shaped like `dev-bypass:<base64url_email>`.
- Intended only for local development.
