---
id: bold-event-spine
kind: epic
stage: drafting
tags: [bold, streaming]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: null
---

# The server knows first — delete the polling

## Thesis
Every piece of state the web polls for, the server learns about at the moment it changes
(SRS on_publish/on_unpublish, Liquidsoap track events, pg-boss job completion) — then
throws that knowledge away and waits to be asked.

## Lens
Inversion

## Impact
One SSE event spine (Hono `streamSSE`). The handlers that already receive each change
publish to it; client polling hooks become subscriptions. Admin playout stops polling
queue status every 3s; the global player stops having every user poll live status every
10s against an endpoint that fans out to both the SRS and Liquidsoap APIs (~10 req/s at
100 users to learn "nothing changed"). Update latency drops from poll-interval to
instant; external-service fan-out drops to once per actual change.

## Cost
Not behavior-preserving — this adds API surface and changes client networking, so all
children are untagged and route through /agile-workflow:feature-design (epic carries
`bold` without `refactor` deliberately; tag rubric is load-bearing). The hard part is
connection lifecycle: reconnect, missed-event catch-up (SSE `Last-Event-ID` or
state-snapshot-on-connect), and auth on the stream. Chat's WebSocket stays untouched —
folding it into the spine is exactly the speculative generalization to avoid. Polling
survives as the degraded fallback path (the in-flight `usePolling` extraction is the
fallback layer, not waste).

## Inputs from the UX review (2026-06-12)
The streaming-playout UX review produced a concrete event-needs list (see that
feature's `## Synthesis`): `channel.live-state-changed`, `playout.queue-changed`,
`playout.now-playing-changed`, `playout.engine-restarted` / `playout.config-drift`,
`content.processing-status-changed`, `channel.viewer-count`. Both polling consumers
went redesign-GO (`live-experience-redesign`, `playout-admin-redesign`), so the
client-subscriptions child is absorbed into those epics — this epic's deliverable
narrows to the endpoint + publishers, with the redesign epics as the consumers.

Update (2026-06-12, live-experience-redesign epic design): the live-state truth
decision adds Liquidsoap **input-switch telemetry** to the publishers feature's
scope — `channel.live-state-changed` must reflect the actually-airing source, not
only SRS sessions (see the note on `bold-event-spine-publishers`).

## Child features (riskiest first)
- **bold-event-spine-sse-endpoint** *(riskiest — design this first)* — the SSE endpoint:
  auth, connection lifecycle, catch-up semantics.
- bold-event-spine-publishers — emit events from SRS callbacks, track-event handler, and
  media job completion (attaches to the named transitions from
  `bold-lifecycle-transitions-playout-queue`).
- bold-event-spine-client-subscriptions — convert the two polling consumers to
  subscriptions with polling fallback.
