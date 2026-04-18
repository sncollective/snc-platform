---
id: platform-0009
title: Liquidsoap as TV channel playout engine
status: active
created: 2026-03-25
updated: 2026-04-18
supersedes: []
superseded_by: null
revisit_if:
  - "Liquidsoap upstream slows (Savonet team churn, issue-response regressions, release gaps)"
  - "Playout needs grow beyond what `fallback()` + S3 reads can express (multi-region, live ad insertion, dynamic graphics overlays)"
  - "OCaml runtime footprint or performance becomes operationally problematic"
  - "Fallback to custom Node.js + FFmpeg service activates — update this record with the trigger"
---

## Context

The TV model ([platform-0008](platform-0008-srs-vs-mediamtx-tv-model.md)) requires an always-on channel playing pre-recorded content continuously, yielding to live creators when they come online. The playout engine must: read content from Garage S3, push RTMP to SRS for HLS delivery, live-switch seamlessly when a creator goes live, hot-reload playlist changes without restarting, and run in a Docker container alongside the rest of the stack.

## Decision

**Liquidsoap** (Savonet, v2.4.x, OCaml). Production-tested streaming framework — 20+ years, Radio France (77 stations), AzuraCast. GPL-2.0; self-hosting has no license implications.

Core pattern: `fallback([live, playlist])` with `track_sensitive=false` for mid-track switching. Live input on port 1936; playlist from S3 via `playlist()`; RTMP push to SRS on `/live/channel-main`.

```liquidsoap
live = input.rtmp(port=1936)
playlist = playlist("/path/to/playlist.m3u", mode="normal", reload_mode="watch")
radio = fallback(track_sensitive=false, [live, playlist])
output.url(url="rtmp://snc-srs:1935/live/channel-main", radio)
```

## Alternatives considered

| Option | Reason for rejection |
|---|---|
| **ErsatzTV** | Archived; no RTMP push in maintained versions |
| **ffplayout** | Archived; GPL-3.0 complications for future commercial distribution |
| **Tunarr** | No RTMP push capability |
| **Raw FFmpeg concat** | No hot-reload of playlist; no native fallback switching |
| **Custom Node.js + FFmpeg service** | Held as fallback path (below); adds platform-owned code we don't want to maintain if Liquidsoap works |

### Fallback path (if Liquidsoap fails)

If Liquidsoap fails validation, pivot to a custom Node.js + FFmpeg service informed by ffplayout's state machine patterns and Tunarr's TypeScript FFmpeg management. Parked; revisit this record with the trigger if activated.

### Go/no-go criteria at validation time

| Step | Must pass | Validated by |
|---|---|---|
| Liquidsoap → RTMP → SRS → HLS | Yes | Vidstack player on live page shows playout stream |
| `fallback()` live switching | Yes | FFmpeg test stream overrides playlist; playlist resumes on disconnect |
| S3 content source | Yes | Liquidsoap reads MP4s from Garage S3 without buffering issues |
| VAAPI encoding | No | Deferred to prod hardware (dev container has no GPU) |
| HTTP API control | No | Nice-to-have, validated later |

All "Yes" criteria passed in the 2026-03-25 spike.

## Consequences

- `snc-liquidsoap` container joins the docker-compose stack on `claude-net`
- Playout publishes to `/live/channel-main` — dedicated stream path, separate from creator live streams (`/live/livestream` or per-creator paths). SRS treats streams equally; no SRS config changes needed.
- Playout content library lives in Garage under `playout/` prefix
- Platform docs (`platform/docs/`) cover Liquidsoap config, skip/queue admin, playlist regeneration
- Operational unknowns resolved post-spike: S3 protocol vs pre-signed URLs, Docker image choice (official vs custom), playlist format (M3U vs `request.queue()` API), audio codec passthrough vs re-encode, container crash recovery behavior — all landed in code

## Related

- [platform-0001-srs-unified-streaming-server.md](platform-0001-srs-unified-streaming-server.md) — RTMP target for playout output
- [platform-0008-srs-vs-mediamtx-tv-model.md](platform-0008-srs-vs-mediamtx-tv-model.md) — TV model architectural context (playout is the always-on channel)
- [platform-0002-garage-s3-object-storage.md](platform-0002-garage-s3-object-storage.md) — content source for playout
- `platform/.memory/research/playout-systems.md` — full playout engine evaluation

Promoted 2026-04-18 during boards-migration story 1 from `boards/platform/release-0.2/design/phase-5-playout-spike.brief.md`.
