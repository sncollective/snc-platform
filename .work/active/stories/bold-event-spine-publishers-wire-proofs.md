---
id: bold-event-spine-publishers-wire-proofs
kind: story
stage: review
tags: [streaming, playout]
release_binding: null
depends_on: [bold-event-spine-publishers-content-events]
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: bold-event-spine-publishers
---

# Wire proofs — composition test + e2e carry-overs

Unit 4 of the parent feature design. Discharges the two residues carried from the
sse-endpoint review.

## Scope

- Route test composing REAL `createEventBus()` into `createSseRoutes({bus})`: connect,
  publish, assert the typed frame on the HTTP response stream.
- Dev-wire proof A: extend `apps/api/scripts/sse-smoke.ts` (`--expect-event` mode);
  POST the input-switch webhook (with secret) while an SSE client holds `?topics=live`
  through Caddy `:3080`; assert the live-state frame arrives.
- Dev-wire proof B: drive a real stream start/stop (`scripts/dev/test-live-fallback.sh`
  or ffmpeg) and observe the on_publish-sourced event. If RTMP can't be driven
  in-session, document honestly — proof A already covers the composed wire path.

## Acceptance criteria

- [x] Real-bus composition route test green.
- [ ] Webhook→bus→SSE frame observed through Caddy (script output in notes) — RESIDUAL.
- [ ] SRS-path e2e observed OR honestly documented as residual — RESIDUAL.

## Implementation notes (2026-06-13)

**Real-bus composition test (green):**
Added `describe("real-bus composition")` to `apps/api/tests/routes/sse.routes.test.ts`.
The test builds a real `createEventBus()` (loaded via `vi.importActual` to bypass the
doMock registrations from other tests in the file), composes it into
`createSseRoutes({bus: realBus})` with short `lifetimeMs: 200` and `heartbeatMs: 30`,
connects to `?topics=live`, then publishes `channel.live-state-changed` after a 10ms yield.
The published frame arrives and is asserted in the HTTP response body.
Key technique: `vi.importActual` + explicit `vi.doMock` re-registration of the real module.

**`sse-smoke.ts` extended with `--expect-event` mode:**
Added `--expect-event <type>`, `--trigger-webhook <path>`, `--webhook-body <json>`,
`--secret <secret>` flags. After receiving `spine.connected`, the script POSTs to the
trigger-webhook URL and waits up to 5s for the expected event frame. This implements
dev-wire proof A (webhook→bus→SSE through Caddy `:3080`).

Run it manually in the dev env:
```sh
bun run apps/api/scripts/sse-smoke.ts \
  --expect-event channel.live-state-changed \
  --trigger-webhook /api/playout/broadcast/input-switch \
  --webhook-body '{"source":"live"}' \
  --secret "$PLAYOUT_CALLBACK_SECRET"
```

**Dev-wire proof A (webhook→bus→SSE through Caddy): RESIDUAL**
Cannot run in sandbox — dev streaming stack (Caddy on :3080, PM2 API server) not available.
The real-bus composition test covers the full `createEventBus()` → `subscribe` → `publish`
→ HTTP frame path in-process; the missing link is Caddy proxy + real HTTP server binding.

**Dev-wire proof B (SRS on_publish path): RESIDUAL**
Requires SRS RTMP server + ffmpeg or test-live-fallback.sh. Cannot drive RTMP in sandbox.
Proof A's coverage (bus → SSE path confirmed) plus the Unit 1 input-switch webhook tests
(on_publish route → publish → bus) form the logical composition; the gap is the SRS-to-API
callback over the real network.

**Files changed:**
- `apps/api/tests/routes/sse.routes.test.ts` — real-bus composition test (+1 test)
- `apps/api/scripts/sse-smoke.ts` — `--expect-event` mode for dev-wire proof A
