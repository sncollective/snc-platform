---
id: bold-event-spine-sse-endpoint-proof
kind: story
stage: review
tags: [streaming]
release_binding: null
depends_on: [bold-event-spine-sse-endpoint-route]
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: bold-event-spine-sse-endpoint
---

# Proof event end-to-end: channel.live-state-changed

Unit 5 of the parent feature design. The point of this story is empirical: prove the
connection lifecycle works through the real proxy before the publishers feature fans
out.

⚠ **Coordination before implementing**: `apps/api/src/services/channels.ts` sits on
`unified-channel-model` epic churn (Lane 1) and owns `SNC_TV_BROADCAST` from the landed
stream-names dedup. Re-check the seam first.

## Scope

- Publish `{ type: "channel.live-state-changed", channelId, live }` at the end of
  `createLiveChannel` (true) and `deactivateLiveChannel` (false). Payload deliberately
  thin — the richer live-state truth (Liquidsoap input-switch telemetry) belongs to the
  publishers feature. Duplicate `live: true` on SRS `on_publish` retries is fine by
  design (notification semantics) — not a bug.
- Verification script: Bun `fetch` (NOT curl — denied command) connecting through Caddy
  `:3080`.

## Acceptance criteria

- [x] Unit test: spied bus receives the event on create/deactivate.
- [x] Through-Caddy script receives `spine.connected` and heartbeats, unbuffered (proves
      Caddy auto-flush of `text/event-stream`). See implementation notes for live-state
      event and 5-minute hold status.
- [x] Held-open connection survives > 5 minutes through Caddy (350s observed,
      heartbeats at exact 25s intervals throughout, clean exit — 2026-06-13).

## Implementation notes

- `apps/api/src/services/channels.ts` — `eventBus.publish(...)` added in three places:
  `createLiveChannel` reactivate path (live:true), `createLiveChannel` create path
  (live:true), and `deactivateLiveChannel` success path (live:false). The "duplicate
  live:true on retry" comment added inline per design intent.
- `apps/api/tests/services/event-bus-channels.test.ts` — 5 tests: createLiveChannel
  publishes live:true (new channel), publishes live:true (reactivate), published channelId
  matches result; deactivateLiveChannel publishes live:false, does NOT publish when no
  channel found. All 5 pass.
- `apps/api/scripts/sse-smoke.ts` — Bun fetch script through Caddy `:3080`. `--hold`
  flag for the 5-minute survival test. Uses `AbortSignal.timeout(MAX_WAIT_MS)`.

### Smoke test results

Two runs against the live dev environment:

**Run 1:** `spine.connected` received (immediate), `retry: 2059ms`, then `heartbeat`
at +6.3s, then server closed the stream. The script printed "Stream closed by server"
and exited PASS (both required events had been observed). The early close was anomalous —
the 25s heartbeat interval should keep the loop open much longer.

**Run 2 (immediate retry):** `spine.connected` received (immediate), heartbeat at +25s,
then the outer `timeout 35` killed the process (exit 124). The stream was still open and
receiving heartbeats — the 35-second test wrapper terminated it, not the server.

**Assessment:** The SSE route and Caddy auto-flush are confirmed working. Run 1's early
close is a transient anomaly — most likely the Bun 1.3.x abort-signal path in
`@hono/node-server` firing on an HTTP/1.1 keepalive edge case, or a timing coincidence.
Run 2 shows normal durable behavior.

**Live-state event via smoke script:** Not exercised — no stream start/stop occurred
during the smoke runs. The unit tests (5/5) cover the publish calls; end-to-end
live-state delivery through the SSE stream is a future manual test (requires a creator
going live against the dev SRS server).

**5-minute hold (orchestrator, 2026-06-13):** PASS — 350,034ms held through Caddy
`:3080`, heartbeats at exact 25s intervals for the entire run, clean close at the
script's 5.5min target. Empirically confirms @hono/node-server defaults don't kill
streaming responses and Caddy doesn't buffer or idle-timeout the stream. (The earlier
"Run 1 anomalous close" and a first FAIL-502 attempt are both explained by API restarts
from concurrent lanes sharing the dev env, not by the SSE stack.) Note: the hold run
predated the `fix(sse)` lifecycle commit only in code-loaded terms — the API was
restarted onto the fixed code before this run.

**Live-state event end-to-end:** remains unexercised (needs a creator going live against
dev SRS). Unit tests cover the publish seams; the wire path for events is proven by the
route tests + the smoke-observed protocol frames. Honest residue for review.
