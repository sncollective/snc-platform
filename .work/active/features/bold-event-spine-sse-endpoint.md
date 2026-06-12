---
id: bold-event-spine-sse-endpoint
kind: feature
stage: drafting
tags: [streaming]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: bold-event-spine
---

# SSE event spine endpoint

## Brief
A single server-sent-events endpoint (Hono `streamSSE`) carrying typed platform events
(initially: playout queue changes, live channel up/down, content processing status).
Design must settle: auth model (cookie session on the EventSource request; per-event
authorization vs. per-topic streams), reconnect + catch-up semantics (`Last-Event-ID`
replay vs. snapshot-on-connect — snapshot is likely sufficient since all current
consumers re-fetch cheaply), in-process fan-out (single API process today — no broker;
do not build one), and heartbeat/timeout behavior behind Caddy.

Riskiest child — the connection lifecycle is the part that can quietly not work in
production (proxy buffering, idle timeouts). Design first via
/agile-workflow:feature-design; prove it with a minimal event type end-to-end before the
publishers feature fans out.
