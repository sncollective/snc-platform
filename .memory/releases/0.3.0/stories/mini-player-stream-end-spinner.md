---
id: story-mini-player-stream-end-spinner
kind: story
stage: done
tags: [streaming, ux-polish]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-22
related_decisions: []
related_designs: []
parent: null
---

# Mini Player Stream End Spinner

When a live stream ended while the user had navigated away from `/live` (so the player was collapsed to mini-player mode), the player spun indefinitely. hls.js retries live manifests forever by default, so Vidstack never surfaced an error state the UI could react to.

`GlobalPlayer` now polls `/api/streaming/status` every 10s while a live creator stream is loaded. When the channel is absent from the active list for `LIVE_STATUS_MISS_THRESHOLD` consecutive polls (3 × 10s = 30s grace), the player dismisses itself via `actions.clear()`. `is_active` flips to false on the SRS `on_unpublish` callback, so the channel disappears from the status response within a couple seconds of stream end — the grace window absorbs brief unpublish/republish flaps without kicking viewers out.

Polling is scoped to `media.contentType === "live"` (not `streamType`, which is `"live"` for both live creator streams and scheduled playout channels). Playout channels are always-on schedules, not creator-initiated broadcasts, so they don't "end" the same way and shouldn't be subject to the dismiss logic. (`/live` sets `streamType: "live"` on all channels because both use HLS live streaming semantics client-side; `contentType` is the right differentiator here.)

Chose server-authoritative polling over Vidstack/hls.js error events because the error signal never fires for live HLS 404 — hls.js keeps retrying. The `/api/streaming/status` endpoint is already the source of truth for which channels are live and is polled by `/live` itself on a 15s cadence; reusing it here is the cheapest reliable signal.

Reviewed 2026-04-22 with a live Maya test stream: on first pass the initial fix (no grace, no `contentType` scope) dismissed playout mini-players too eagerly — regression surfaced mid-review. Grace window + `contentType` scope added, re-verified: stream ended → mini-player dismissed after ~30s; playout mini-players survive the playout channel's periodic flash-reload behavior (parked as [playout-channels-flash-reload-cycle](../../backlog/playout-channels-flash-reload-cycle.md)).
