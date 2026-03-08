#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env.production}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing env file: ${ENV_FILE}" >&2
  exit 1
fi

cd "${ROOT_DIR}"

echo "[deploy] building api + web assets"
docker compose --env-file "${ENV_FILE}" build --pull api web-build

echo "[deploy] refreshing frontend static assets"
docker compose --env-file "${ENV_FILE}" run --rm web-build

echo "[deploy] starting services"
docker compose --env-file "${ENV_FILE}" up -d api caddy

echo "[deploy] waiting for API health"
for i in {1..20}; do
  if curl -fsS "http://127.0.0.1:8000/api/health" >/dev/null; then
    echo "[deploy] API is healthy"
    exit 0
  fi
  sleep 3
done

echo "[deploy] API health check failed" >&2
docker compose --env-file "${ENV_FILE}" ps
exit 1
