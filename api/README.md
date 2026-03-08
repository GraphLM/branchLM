## branchLM API

This FastAPI service backs the graph canvas.

### Setup (using `uv`)

```bash
cd api
cp .env.example .env
# Fill in SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from your Supabase project settings
# Fill in OPENROUTER_API_KEY to enable chat generation
uv sync
```

### Supabase schema

This repo uses migrations under `supabase/migrations/`.

- Manual setup option: run `api/supabase_schema.sql` in Supabase SQL editor.
- Recommended: use Supabase CLI and run `supabase db push`.

### Run dev server

```bash
cd api
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Endpoints

- `GET /api/health` health check
- `GET /api/workspaces` list workspaces
- `POST /api/workspaces` create workspace
- `PATCH /api/workspaces/{workspaceId}` rename workspace
- `DELETE /api/workspaces/{workspaceId}` delete workspace (cascades)
- `GET /api/workspaces/{workspaceId}/graph` load graph
- `PUT /api/workspaces/{workspaceId}/graph/layout` persist layout + context edges
- `POST /api/workspaces/{workspaceId}/chats` create a chat
- `PATCH /api/workspaces/{workspaceId}/chats/{chatId}` rename chat
- `DELETE /api/workspaces/{workspaceId}/chats/{chatId}` delete chat (cascades)
- `POST /api/workspaces/{workspaceId}/chats/{chatId}/messages` add message
- `POST /api/workspaces/{workspaceId}/chats/{chatId}/generate` create user message + LLM reply
- `POST /api/workspaces/{workspaceId}/chats/{chatId}/context-preview` preview included/excluded context without generating
- `DELETE /api/workspaces/{workspaceId}/messages/{messageId}` delete message

All workspace/graph/chat/message endpoints require:

```http
Authorization: Bearer <supabase_access_token>
```

Dev bypass option:

- Set `AUTH_DEV_BYPASS=true` to accept synthetic dev tokens shaped like `dev-bypass:<base64url_email>`.
- Intended only for local development.

### LLM safeguards

- OpenRouter credentials are server-only and read from `.env`
- Prompt/history/completion sizes are capped with env-configurable limits
- Chat generation is rate-limited per user and client IP
- Provider failures return sanitized errors without exposing internals
