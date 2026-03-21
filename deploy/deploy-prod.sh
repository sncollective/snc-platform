#!/usr/bin/env bash
# S/NC Production Deploy Script
# Run as the snc user on the snc-app LXC container.
set -euo pipefail

APP_DIR="/opt/snc/platform"
cd "$APP_DIR"

echo "==> Creating backup tag..."
BACKUP_TAG="pre-deploy-$(date +%Y%m%d-%H%M%S)"
git tag "$BACKUP_TAG"

echo "==> Pulling latest from main..."
git pull origin main

echo "==> Installing dependencies..."
corepack enable
pnpm install --frozen-lockfile

echo "==> Building..."
NODE_OPTIONS="--max-old-space-size=2048" pnpm build

echo "==> Running database migrations..."
pnpm --filter @snc/api db:migrate

echo "==> Restarting services..."
sudo systemctl restart snc-api
sudo systemctl restart snc-web

echo "==> Waiting for API to start..."
sleep 3

echo "==> Health check..."
if curl -sf http://localhost:3000/health > /dev/null; then
  echo "==> Deploy successful!"
else
  echo "==> Health check failed! Rolling back..."
  git checkout "$BACKUP_TAG"
  pnpm install --frozen-lockfile
  NODE_OPTIONS="--max-old-space-size=2048" pnpm build
  sudo systemctl restart snc-api
  sudo systemctl restart snc-web
  echo "==> Rolled back to $BACKUP_TAG"
  exit 1
fi
