# branchLM

branchLM is a graph-first interface for interacting with LLMs.

Instead of forcing everything into one linear chat transcript, branchLM lets users:

- Keep multiple chat branches on a canvas
- Explicitly connect relevant messages from one branch into another
- Link document/text context nodes to specific chats
- Preview exactly what context will be included or excluded before generation

The core idea is simple: better LLM outcomes come from better context structure, not just larger context windows.

## Why This Exists

Traditional chat UIs mix together:

- Foundational objective-setting context
- Side explorations and ideation branches
- One-off clarifications

As the conversation grows, models must infer what matters most from a single stream. branchLM shifts this from model inference to user curation by making context relationships explicit in a graph.

## How It Works

At a high level:

1. Users create chat nodes on a canvas.
2. Users connect message nodes to other chat nodes to create branch context edges.
3. Users attach context nodes (uploaded file or text) to chats for external grounding.
4. Before generation, branchLM computes a context plan under token/message limits:
   - Included chat history
   - Included branch context
   - Excluded overflow (with reasons)
   - Optional overflow summary snippet
5. The API generates a reply and stores both user + assistant messages.

## Tech Stack

- Frontend: React, TypeScript, Vite, React Flow
- Backend: FastAPI (Python)
- Database/Auth: Supabase (Postgres + Supabase Auth JWTs)
- LLM access: OpenRouter-compatible generation path (via backend services)
- Retrieval/context documents: Backboard integration for context-node indexing/querying

## Repository Structure

- `web/`: React canvas app (nodes, edges, workspace panel, context preview)
- `api/`: FastAPI app (workspaces, graph, chats, messages, generation)
- `supabase/migrations/`: SQL migrations for schema changes
- `api/supabase_schema.sql`: optional manual schema setup

## Main Capabilities

- Multi-workspace graph organization
- Chat creation/rename/delete
- Message creation/delete and model generation
- Branch context edges between messages and chats
- Context nodes with file/text assets
- Persisted graph layout + context links
- Context preview endpoint showing inclusion/exclusion decisions
- Per-user/IP generation rate limiting
- Prompt/history/completion budget controls

## Local Development

### Prerequisites

- Node.js 20+ and npm
- Python 3.9+
- `uv` for Python dependency management
- Supabase project (hosted)

### 1) Backend setup

```bash
cd api
cp .env.example .env
```

Required backend env vars:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTER_API_KEY` (for generation)

Install dependencies and run API:

```bash
uv sync
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2) Frontend setup

```bash
cd web
cp .env.example .env
npm install
npm run dev
```

Default frontend dev URL is Vite's local URL (usually `http://localhost:5173`).

### 3) Database migrations (recommended)

This repo keeps schema changes in `supabase/migrations/`.

One-time Supabase CLI setup:

```bash
# Install CLI (macOS)
brew install supabase/tap/supabase

# Authenticate
supabase login

# Initialize local supabase/ folder (safe if it already exists)
supabase init

# Link this repo to your hosted Supabase project
supabase link --project-ref PROJECT_REF
```

Push migrations:

```bash
supabase db push
```

Create a new migration:

```bash
supabase migration new add_some_table
# edit the generated SQL file under supabase/migrations/
supabase db push
```

## Deploy (Netlify + Google Cloud Run)

This repo is configured for:

- `web/` on Netlify (via `netlify.toml`)
- `api/` on Google Cloud Run (via `api/Dockerfile`)

### 1) Deploy FastAPI to Cloud Run

Set your project and region:

```bash
gcloud config set project branchlm
gcloud config set run/region us-central1
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

Deploy backend from source:

```bash
gcloud run deploy branchlm-api \
  --source ./api \
  --allow-unauthenticated \
  --region us-central1 \
  --set-env-vars SUPABASE_URL=YOUR_SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY,OPENROUTER_API_KEY=YOUR_OPENROUTER_API_KEY,AUTH_DEV_BYPASS=false
```

Get the deployed backend URL:

```bash
gcloud run services describe branchlm-api --region us-central1 --format='value(status.url)'
```

### 2) Deploy frontend to Netlify

Netlify build settings for this repo are already in `netlify.toml`.

Set these environment variables in Netlify:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL` = your Cloud Run service URL from step 1
- `VITE_AUTH_DEV_BYPASS` = `false`

Then deploy from this repository (Netlify UI or CLI).

### 3) Update backend CORS after Netlify URL is known

After first Netlify deploy, update Cloud Run CORS to include the Netlify site origin:

```bash
gcloud run services update branchlm-api \
  --region us-central1 \
  --update-env-vars "^##^API_CORS_ORIGINS=https://YOUR_SITE.netlify.app,http://localhost:5173,http://127.0.0.1:5173"
```

### 4) Verify

- Backend health: `GET <cloud-run-url>/api/health`
- Frontend loads and can list/create workspaces
- Supabase OTP login works in deployed frontend

## API Summary

See `api/README.md` for endpoint details. Key routes include:

- `GET /api/workspaces`
- `GET /api/workspaces/{workspaceId}/graph`
- `PUT /api/workspaces/{workspaceId}/graph/layout`
- `POST /api/workspaces/{workspaceId}/chats/{chatId}/generate`
- `POST /api/workspaces/{workspaceId}/chats/{chatId}/context-preview`

## Notes

- All workspace/graph/chat/message routes require `Authorization: Bearer <supabase_access_token>`.
- Dev bypass auth exists for local development (`AUTH_DEV_BYPASS` and `VITE_AUTH_DEV_BYPASS`).
- If Backboard is not configured, document-based external context retrieval is disabled.
