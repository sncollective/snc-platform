#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# 1. Start Caddy reverse proxy
caddy start --config "$REPO_ROOT/Caddyfile.dev" 2>/dev/null || true

# 2. Wait for Docker daemon (docker-in-docker takes a moment on container rebuild)
for i in {1..30}; do
  docker info >/dev/null 2>&1 && break
  sleep 1
done
if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon not ready after 30s — skipping service startup. Re-run this script once docker is up." >&2
  exit 0
fi

# 2b. Liquidsoap cold-boot stub.
# The real playout.liq is generated at runtime by the API
# (apps/api/src/services/liquidsoap-config.ts). On a cold boot the file doesn't
# exist yet, liquidsoap crash-loops on an empty file, and `docker compose --wait`
# below never returns — blocking pm2 from ever starting the API that would write
# the real config. Write a minimal stub that serves /health so the container
# reaches a healthy state; the API overwrites on first run and signals a restart.
LIQUID_CONFIG="$REPO_ROOT/liquidsoap/playout.liq"
if [ ! -f "$LIQUID_CONFIG" ]; then
  cat > "$LIQUID_CONFIG" <<'LIQ_STUB'
# Bootstrap stub written by start-dev.sh — overwritten by the API on first run.
log.stdout := true
log.level := 3
settings.harbor.bind_addrs := ["0.0.0.0"]

harbor.http.register(port=8888, method="GET", "/health", fun(_req, res) -> begin
  res.data("ok")
end)

output.dummy(fallible=true, blank())
LIQ_STUB
  echo "Wrote liquidsoap cold-boot stub — API will replace it"
fi

# 3. Start Docker services (Postgres, SRS, Garage, Liquidsoap)
cd "$REPO_ROOT"
if docker network inspect claude-net >/dev/null 2>&1; then
  echo "claude-net detected — starting services with overlay"
  docker compose -f docker-compose.yml -f docker-compose.claude.yml up -d --wait
else
  echo "claude-net not found — starting services standalone"
  docker compose up -d --wait
fi

# 4. Initialize Garage S3 (layout, bucket, API key — idempotent)
bash "$SCRIPT_DIR/init-garage.sh"

# 5. Generate playout playlist (if test content exists in S3)
if docker exec snc-garage /garage key info snc-dev-key >/dev/null 2>&1; then
  echo "Generating playout playlist..."
  bash "$SCRIPT_DIR/generate-playout-playlist.sh" 2>/dev/null || echo "Playout playlist generation skipped (run seed-playout-content.sh first)"
fi

# 6. Start PM2 (API, Web — Liquidsoap runs via Docker, Postgres + SRS healthy thanks to --wait)
echo "Services ready — starting dev servers"
pm2 start "$REPO_ROOT/ecosystem.config.cjs"
