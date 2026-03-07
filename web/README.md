# branchLM Web

## Run

```bash
cd /Users/ayaaniqbal/Desktop/code/GraphLM/branchLM/web
cp .env.example .env
npm install
npm run dev
```

Vite serves on `http://127.0.0.1:5173` by default.

## API integration

- The app calls backend endpoints under `/api/*`.
- Dev server proxies `/api` to `http://127.0.0.1:8000`.
- You can override with `VITE_API_BASE_URL` in `.env`.

## Auth in local dev

- Set `VITE_AUTH_DEV_BYPASS=true` to send a synthetic dev token.
- Token email comes from `VITE_DEV_BYPASS_EMAIL` (default `test@example.com`).
