# branchLM

## Supabase migrations (recommended)

This repo keeps database schema changes in `supabase/migrations/`.

### One-time setup

```bash
# Install CLI (macOS)
brew install supabase/tap/supabase

# Authenticate
supabase login

# Initialize local supabase/ folder (safe if it already exists)
supabase init

# Link this repo to your hosted Supabase project
# (PROJECT_REF is the "Project reference" shown in Supabase Dashboard URL / settings)
supabase link --project-ref PROJECT_REF
```

### Push migrations to hosted Supabase

```bash
supabase db push
```

## Vultr deployment

Production deployment files are included for a single-VM setup with Docker Compose + Caddy:

- `docker-compose.yml`
- `api/Dockerfile`
- `web/Dockerfile`
- `deploy/Caddyfile`
- `deploy/deploy.sh`
- `.github/workflows/deploy.yml`
- `.env.production.example`

See deployment runbook: `deploy/README.md`.

### Create a new migration

```bash
supabase migration new add_some_table
# edit the generated SQL file under supabase/migrations/
supabase db push
```
