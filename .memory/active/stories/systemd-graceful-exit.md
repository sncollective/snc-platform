---
id: story-systemd-graceful-exit
kind: story
stage: review
tags: [deploy, user-station]
release_binding: null
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# systemd Graceful Exit

**Fix landed.** Shutdown lifecycle rewritten with a 30s timeout, re-entry guard, per-stage logging, pg-boss stop timeout, and PM2 `kill_timeout`. `systemctl restart snc-api` no longer hangs.

## Original problem

`systemctl restart snc-api` hung. SIGTERM handling was incomplete — the API process did not drain in-flight requests, stop pg-boss cleanly, or signal PM2 to release the process before the systemd `TimeoutStopSec` expired. This caused forced kills (`SIGKILL`) and occasionally left pg-boss job locks held, requiring manual intervention.

## Fix

Shutdown lifecycle rewritten:
- **30s timeout** — the entire shutdown sequence is bounded; if it exceeds 30s, the process forcibly exits to avoid hanging systemd.
- **Re-entry guard** — multiple SIGTERM signals (e.g., from PM2 + systemd) do not trigger concurrent shutdown paths.
- **Per-stage logging** — each shutdown phase (in-flight drain, pg-boss stop, server close) logs entry and completion, making hang diagnosis straightforward.
- **pg-boss stop timeout** — `pgBoss.stop({ timeout: 15000 })` prevents pg-boss from blocking indefinitely waiting for running jobs.
- **PM2 `kill_timeout`** — ecosystem config sets `kill_timeout: 35000` so PM2 waits for the graceful shutdown to complete before sending SIGKILL.

`user-station` tag: requires systemctl access on the production user-station host to verify.

## Verification

- [ ] `systemctl restart snc-api` completes within ~35s without hanging.
- [ ] Shutdown log shows per-stage completion messages.
- [ ] No pg-boss lock leftovers after restart (verify via `SELECT * FROM pgboss.job WHERE state = 'active'` immediately after restart).
- [ ] PM2 `ecosystem.config.js` has `kill_timeout: 35000`.
- [ ] `systemctl status snc-api` shows clean start after restart.
