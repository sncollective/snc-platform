#!/usr/bin/env bash
set -euo pipefail

PLATFORM_DIR="/workspaces/SNC/platform"

# 1. Start Caddy reverse proxy
caddy start --config "$PLATFORM_DIR/Caddyfile.dev" 2>/dev/null || true

# 2. Start Postgres — use claude-net overlay if network exists, plain otherwise
cd "$PLATFORM_DIR"
if docker network inspect claude-net >/dev/null 2>&1; then
  echo "claude-net detected — starting Postgres with overlay"
  docker compose -f docker-compose.yml -f docker-compose.claude.yml up -d --wait
else
  echo "claude-net not found — starting Postgres standalone"
  docker compose up -d --wait
fi

# 3. Start PM2 (Postgres is healthy thanks to --wait + healthcheck)
echo "Postgres ready — starting dev servers"
pm2 start "$PLATFORM_DIR/ecosystem.config.cjs"
