#!/usr/bin/env bash
# Install Playwright browsers for the e2e suite (apps/e2e).
#
# Deliberately outside the devcontainer lifecycle: the ~170 MB CDN download is
# the slowest and flakiest cold-boot step, and only e2e runs need it. Run once
# before `bun run --filter @snc/e2e test`. Idempotent — Playwright skips
# browsers already present in ~/.cache/ms-playwright.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT/apps/e2e"
# Requires @playwright/test >= 1.60: playwright 1.55.1-1.59.1 deadlocks during
# archive extraction on Node 24.16+ (upstream microsoft/playwright#40998) — the
# install downloads to 100% then hangs forever at ~18 MB extracted.
bunx playwright install --with-deps chromium
