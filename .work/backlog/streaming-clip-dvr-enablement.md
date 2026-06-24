---
id: streaming-clip-dvr-enablement
kind: feature
tags: [streaming, media-pipeline]
parent: null
depends_on: []
release_binding: null
gate_origin: null
research_origin: stream-clipping-twitch-parity
created: 2026-06-24
updated: 2026-06-24
---

# Enable SRS DVR + on_dvr ingest (stream-clip prerequisite)

The prerequisite for **stream-derived** clips (live + post-stream). The platform records nothing
persistent today — `srs.conf` enables no DVR, and the HLS window is a ~10s ephemeral buffer. (Clips
from an **already-uploaded VOD** need none of this — they extract straight from the Garage object.)

Scope:
- **Enable SRS DVR** in `srs.conf` — choose `dvr_plan` (`session` = one file per broadcast, available
  on `on_dvr` at stream end; `segment` = a file every `dvr_duration`, enabling mid-stream VOD clips at
  a ~segment-duration lag). Pick against the live-edge rewind-depth target.
- **`on_dvr` ingest** — handle the callback (delivers `file`/`cwd`); ingest the DVR recording into
  Garage as a VOD source so it survives DVR rolloff. **Caveat:** the path is *inside SRS's own
  filesystem* — reach it via a shared volume into the SRS container or an SRS-HTTP fetch.
- **Reconciliation sweep** — `on_dvr` is fire-once / best-effort; a missed callback orphans a
  recording. A periodic sweep (list DVR outputs, ingest any not yet recorded) is the backstop, not
  callback-only handoff.
- **DVR cost/retention** — always-on DVR records every stream; a per-stream/opt-in DVR policy
  interacts with the clip-enable permission. Decide the policy here.

Open inputs (acquisitions): whether the `on_dvr`/`on_hls` payload carries the segment path, and
whether DVR can be toggled per-stream at runtime (SRS DVR RAW API, issues #319/#459).

## Research grounding

**Source**: `.research/analysis/campaigns/stream-clipping-twitch-parity/parent.md` (slug: `stream-clipping-twitch-parity`)

The campaign's #1 prerequisite for stream-derived clipping; corroborated by YouTube's own docs
("you can't create Clips from live streams without DVR"). `streaming-clip-creation` depends on this
for live-stream clips.
