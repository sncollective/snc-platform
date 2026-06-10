---
status: settled
authored: 2026-06-10
provenance: agent-synthesis
related:
  - to: ../briefs/playout-systems.md
    type: grounds
    note: full playout engine evaluation
  - to: srs-streaming-server.md
    type: cites
    note: RTMP target for playout output
  - to: tv-model-playout-architecture.md
    type: cites
    note: TV model architectural context (playout is the always-on channel)
  - to: garage-object-storage.md
    type: cites
    note: content source for playout
revisit_if:
  - Liquidsoap upstream slows (Savonet team churn, issue-response regressions, release gaps)
  - Playout needs grow beyond what fallback() + S3 reads can express (multi-region, live ad insertion, dynamic graphics overlays)
  - OCaml runtime footprint or performance becomes operationally problematic
  - Fallback to custom Node.js + FFmpeg service activates — update this record with the trigger
---

# Position: Liquidsoap as TV channel playout engine

**Status: settled.** Liquidsoap is the platform's always-on channel playout engine, selected
after evaluation and validated by a successful Phase 5 spike.

## The stance

**Liquidsoap (Savonet, v2.4.x, OCaml, GPL-2.0) is the platform's playout engine.**
Production-tested streaming framework — 20+ years of development, Radio France (77 stations),
AzuraCast. GPL-2.0; self-hosting has no license implications.

### Core pattern

`fallback([live, playlist])` with `track_sensitive=false` for mid-track switching. Live input
on port 1936; playlist from Garage S3 via `playlist()`; RTMP push to SRS on
`/live/channel-main`.

```liquidsoap
live = input.rtmp(port=1936)
playlist = playlist("/path/to/playlist.m3u", mode="normal", reload_mode="watch")
radio = fallback(track_sensitive=false, [live, playlist])
output.url(url="rtmp://snc-srs:1935/live/channel-main", radio)
```

### Go/no-go criteria passed at Phase 5 spike (2026-03-25)

| Step | Validated by |
|---|---|
| Liquidsoap → RTMP → SRS → HLS | Vidstack player on live page shows playout stream ✅ |
| `fallback()` live switching | FFmpeg test stream overrides playlist; playlist resumes on disconnect ✅ |
| S3 content source | Liquidsoap reads MP4s from Garage S3 without buffering issues ✅ |

VAAPI encoding (no GPU in dev container) and HTTP API control (nice-to-have) were deferred
to production hardware and later validation.

## Rejected alternatives

| Option | Reason for rejection |
|---|---|
| **ErsatzTV** | Archived; no RTMP push in maintained versions |
| **ffplayout** | Archived; GPL-3.0 complications for future commercial distribution |
| **Tunarr** | No RTMP push capability |
| **Raw FFmpeg concat** | No hot-reload of playlist; no native fallback switching |
| **Custom Node.js + FFmpeg service** | Held as fallback path (below); adds platform-owned code we don't want to maintain if Liquidsoap works |

### Fallback path (parked, not activated)

If Liquidsoap fails validation on production hardware, pivot to a custom Node.js + FFmpeg
service informed by ffplayout's state machine patterns and Tunarr's TypeScript FFmpeg management.
This fallback is parked. If it activates, update this record with the trigger and the outcome.

## Deployment constraints

- `snc-liquidsoap` container joins the docker-compose stack on `claude-net`.
- Playout publishes to `/live/channel-main` — dedicated stream path, separate from creator live
  streams (`/live/livestream` or per-creator paths). SRS treats streams equally; no SRS config
  changes needed for this separation.
- Playout content library lives in Garage under `playout/` prefix.
- Platform docs (`platform/docs/`) cover Liquidsoap config, skip/queue admin, playlist
  regeneration.

## Operational unknowns resolved post-spike

All landed in code: S3 protocol vs pre-signed URLs, Docker image choice (official vs custom),
playlist format (M3U vs `request.queue()` API), audio codec passthrough vs re-encode, container
crash recovery behavior.

## Platform constraints it sets

- `liquidsoap-v2` tech-reference skill carries the Liquidsoap DSL and container configuration.
- Playout is the always-on channel in the TV model; live creators dynamically override it via
  the SRS `fallback()` mechanism.
