---
id: feature-dynamic-liquidsoap-config
kind: feature
stage: done
tags: [streaming]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# Dynamic Liquidsoap Config Generation

## Overview

Generate `playout.liq` from database channel rows when playout channels are created or deleted. The API writes the config to the mounted volume and signals Liquidsoap to restart via a harbor shutdown endpoint. The S/NC TV broadcast block stays static (hardcoded classics fallback for now — decoupling is parked on the streaming board).

Admin gets feedback: toast notification on channel create/delete ("Playout engine restarting..."), plus an inline status indicator on the channel tab until the Liquidsoap health check passes.

## Implementation Units

### Unit 1: Liquidsoap Shutdown Harbor Endpoint

**File:** `platform/liquidsoap/playout.liq` (modify)

Add after the health check, before the channel blocks:

```liquidsoap
harbor.http.register(port=8888, method="POST", "/admin/shutdown", fun(req, res) -> begin
  secret = environment.get("PLAYOUT_CALLBACK_SECRET", default="")
  q = req.query
  if q["secret"] == secret and secret != "" then
    res.data("shutting down")
    shutdown()
  else
    res.status_code(401)
    res.data("unauthorized")
  end
end)
```

Authenticated via the same `PLAYOUT_CALLBACK_SECRET` used for track-event webhooks. `shutdown()` exits the process with code 0 — Docker's `restart: unless-stopped` policy restarts the container, picking up the regenerated `playout.liq` from the volume mount.

**Acceptance Criteria:**
- [ ] `POST /admin/shutdown?secret=<valid>` returns "shutting down" and exits
- [ ] `POST /admin/shutdown?secret=<invalid>` returns 401
- [ ] Container restarts automatically after shutdown

---

### Unit 2: Config Generator Service

**File:** `platform/apps/api/src/services/liquidsoap-config.ts` (new)

`generateLiquidsoapConfig()` queries all active playout channels from DB and renders the full `playout.liq` content.

Per-channel block includes: `request.queue`, `fallback`, `on_metadata` (with `http.post` webhook — uses `http.post` rather than `curl` for purity), `output.url`, harbor endpoints for queue/skip/now-playing.

Variable names use channel UUID directly (hyphens replaced with underscores if Liquidsoap rejects hyphens in identifiers).

S/NC TV block is static — references the first playout channel source as its fallback.

**Acceptance Criteria:**
- [ ] `generateLiquidsoapConfig()` returns valid Liquidsoap script
- [ ] Generated config includes a block for each active playout channel
- [ ] Each channel block has: request.queue, fallback, output.url, on_metadata, harbor endpoints
- [ ] S/NC TV block references the first playout channel source as fallback
- [ ] Config includes health check and admin shutdown endpoints
- [ ] No hardcoded channel IDs — all derived from database

---

### Unit 3: Config Writer + Restart Signal

**File:** `platform/apps/api/src/services/liquidsoap-config.ts` (extend Unit 2)

`regenerateAndRestart()` — writes config to disk and POSTs to `/admin/shutdown` to signal Liquidsoap restart. Connection reset from shutdown is treated as success.

`waitForHealth(maxAttempts, intervalMs)` — polls `/health` endpoint after restart. Returns true when Liquidsoap is back up.

`LIQUIDSOAP_CONFIG_PATH` defaults to the volume mount path. Override via `LIQUIDSOAP_CONFIG_DIR` config value.

**Acceptance Criteria:**
- [ ] `regenerateAndRestart()` writes config and signals shutdown
- [ ] Connection reset from shutdown treated as success
- [ ] `waitForHealth()` returns true when Liquidsoap is back up

---

### Unit 4: API Config Values

**File:** `platform/apps/api/src/config.ts` (modify)

Add optional config values:
- `LIQUIDSOAP_CONFIG_DIR: z.string().optional()`
- `LIQUIDSOAP_CALLBACK_HOST: z.string().optional()`
- `LIQUIDSOAP_CALLBACK_PORT: z.string().optional()`
- `SRS_RTMP_HOST: z.string().optional()`

---

### Unit 5: Wire Config Generation into Channel CRUD

**File:** `platform/apps/api/src/routes/playout-channels.routes.ts` (modify)

After channel creation succeeds: call `regenerateAndRestart()`, then `waitForHealth()`. Response includes `engineRestarting` and `engineReady` flags.

Add `DELETE /channels/:channelId` endpoint for channel deletion (soft deactivation: `isActive: false`) with same config regeneration + health polling.

`waitForHealth` blocks the response for up to 20 seconds (10 attempts × 2 seconds). If it times out, response returns with `engineReady: false` and the UI shows the pending indicator.

**Acceptance Criteria:**
- [ ] Channel creation triggers config regeneration + restart
- [ ] Channel deletion (deactivation) triggers config regeneration + restart
- [ ] Response includes engine status flags
- [ ] Health check polling waits for Liquidsoap to recover

---

### Unit 6: Admin UI — Toast + Status Indicator

**File:** `platform/apps/web/src/routes/admin/playout.tsx` (modify)

On channel create: toast "Playout engine restarting...", show pulsing amber dot on channel tab. Poll until engine is ready, then toast "Playout engine ready".

**File:** `platform/apps/web/src/routes/admin/playout.module.css` (modify)

Add `.channelTabRestarting` with pulsing amber dot indicator using `--color-warning`.

**Acceptance Criteria:**
- [ ] Toast shows "Playout engine restarting..." on channel create
- [ ] Toast shows "Playout engine ready" when health check passes
- [ ] Toast shows warning if engine doesn't come back within 30 seconds
- [ ] Pulsing amber dot on channel tab during restart
- [ ] Indicator clears when engine is ready

---

### Unit 7: Remove Hardcoded Channel Env Vars from Docker Compose

Remove from `snc-liquidsoap` service environment:
- `CHANNEL_CLASSICS_ID`
- `CHANNEL_CLASSICS_STREAM`
- `DEFAULT_PLAYOUT_STREAM`

These are now embedded in the generated channel blocks directly from the database.

Keep: `PLAYOUT_STREAM_KEY`, `AWS_*`, `SRS_RTMP_HOST`, `API_CALLBACK_HOST`, `API_CALLBACK_PORT`, `PLAYOUT_CALLBACK_SECRET`, `CHANNEL_SNCTV_STREAM`.

---

### Unit 8: Initial Config Generation on API Startup

On API startup: write current config to disk (no restart signal — Liquidsoap may not be running yet). Orchestrator initialization runs after config write.

---

## Implementation Order

1. **Unit 4** — API config values (no deps)
2. **Unit 2** — Config generator service
3. **Unit 3** — Config writer + restart signal (extends Unit 2)
4. **Unit 1** — Liquidsoap shutdown endpoint (Liquidsoap-side, independent)
5. **Unit 8** — Startup config generation
6. **Unit 5** — Wire into channel CRUD routes
7. **Unit 7** — Remove hardcoded env vars from docker-compose
8. **Unit 6** — Admin UI toast + status indicator

## Verification Checklist

```bash
bun --cwd=./platform run --filter @snc/api test
bun --cwd=./platform run --filter @snc/web test
bun --cwd=./platform run --filter @snc/web build
pm2 restart all
# Check: "Liquidsoap config written" in API startup logs
# Check: cat platform/liquidsoap/playout.liq | head -5
# Should show "Auto-generated by S/NC Platform"

# Test channel creation triggers regeneration
# Create a channel via admin UI → toast shows "Playout engine restarting..."
# After restart → toast shows "Playout engine ready"
```
