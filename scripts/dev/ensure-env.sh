#!/usr/bin/env bash
# Ensure .env exists and carries every KEY=... line from .env.example.
#
# First run: copy .env.example → .env and mint a fresh BETTER_AUTH_SECRET.
# Rebuild:   append any KEY=... lines from .env.example whose KEY is absent
#            from the existing .env. Existing values are preserved.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$(openssl rand -base64 32)|" .env
  echo "ensure-env: created .env from .env.example with fresh BETTER_AUTH_SECRET"
  exit 0
fi

added=0
while IFS= read -r line; do
  key="${line%%=*}"
  [[ "$key" =~ ^[A-Z_][A-Z0-9_]*$ ]] || continue
  if ! grep -qE "^${key}=" .env; then
    printf '%s\n' "$line" >> .env
    added=$((added + 1))
  fi
done < <(grep -E '^[A-Z_][A-Z0-9_]*=' .env.example)

if [ "$added" -gt 0 ]; then
  echo "ensure-env: appended $added missing key(s) to .env from .env.example"
else
  echo "ensure-env: .env already current"
fi
