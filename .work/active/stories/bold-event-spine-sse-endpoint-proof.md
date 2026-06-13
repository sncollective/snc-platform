---
id: bold-event-spine-sse-endpoint-proof
kind: story
stage: implementing
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

- [ ] Unit test: spied bus receives the event on create/deactivate.
- [ ] Through-Caddy script receives `spine.connected`, heartbeats, and the live-state
      event on stream start/stop, unbuffered (proves Caddy auto-flush of
      `text/event-stream`).
- [ ] Held-open connection survives > 5 minutes through Caddy (empirically confirms
      @hono/node-server defaults don't kill streaming responses).
