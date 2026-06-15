#!/usr/bin/env bash
# Run the @snc/api integration suite from inside the Claude Code agent sandbox.
#
# The agent's Bash sandbox is network-isolated (its own netns; only the egress
# proxies are reachable) and read-restricted (.env is denied to the agent). Two
# pieces make `bun run --filter @snc/api test:integration` work from in here,
# with NO docker-socket access and NO privilege escalation:
#
#   1. NETWORK  — scripts/dev/sandbox-forward.py relays the backing dev services
#                 (Postgres/Garage/Mailpit/SRS/Liquidsoap/imgproxy) onto this
#                 netns's localhost via the SOCKS egress proxy.
#   2. SECRETS  — a `sandbox.filesystem.allowRead` carve-out in
#                 .claude/settings.local.json lets the test subprocess read
#                 platform/.env (DATABASE_URL + BETTER_AUTH_SECRET) directly.
#                 The agent's own Read tool stays blocked — only subprocess reads
#                 are re-allowed. See AGENTS.md "Running tests from the agent
#                 sandbox".
#
# A human developer does NOT need this script — their shell is in the base netns
# where the services and .env are directly reachable; they run the plain
# `bun run --filter @snc/api test:integration`.
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# Backing services the integration suite touches (real Postgres + Garage, plus
# the rest of the stack so nothing 503s mid-run). Harmless to forward extras.
PORTS="5432 3900 3903 1025 8025 1985 8080 8888 8081 1935 1936"

python3 "$SCRIPT_DIR/sandbox-forward.py" $PORTS >/tmp/sandbox-forward.log 2>&1 &
FWD=$!
trap 'kill $FWD 2>/dev/null' EXIT
sleep 2
echo "--- forwarder ---"
grep -c '^forward ' /tmp/sandbox-forward.log | xargs -I{} echo "{} ports forwarded"

# Preflight the secrets carve-out (read 1 byte, content discarded) so a missing
# allowRead fails loud instead of as a confusing ZodError on DATABASE_URL.
if ! head -c1 "$REPO_ROOT/.env" >/dev/null 2>&1; then
  echo "ERROR: cannot read $REPO_ROOT/.env — the sandbox.filesystem.allowRead carve-out" >&2
  echo "       is not active. Apply it in .claude/settings.local.json (see AGENTS.md)." >&2
  exit 3
fi

echo "--- bun run --filter @snc/api test:integration ---"
timeout 400 bun run --filter @snc/api test:integration 2>&1 | tail -80
echo "=== integration exit: ${PIPESTATUS[0]} ==="
