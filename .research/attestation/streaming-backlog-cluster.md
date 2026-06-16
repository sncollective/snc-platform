---
source_handle: streaming-backlog-cluster
fetched: 2026-06-16
source_path: .work/backlog/
provenance: source-direct
substrate_confidence: source-direct
---

## Summary

The streaming backlog cluster under `.work/backlog/` (all `streaming-*` items read 2026-06-16).
These are unscoped parked work items, flat markdown files with `tags`, `release_binding`, and
`created`/`updated` frontmatter. This attestation summarizes the items load-bearing for the
Liquidsoap/SRS capability-feasibility map. Each item names a streaming capability and a deferral
condition. The items below are quoted/paraphrased verbatim from their `# heading` + body prose.

## Per-item key content (each cited by `[handle]{N}` in the brief)

**`streaming-snctv-fallback-dynamic-channel`** — "Decouple S/NC TV fallback from the hardcoded
`classics` channel. Currently `playout.liq` references the `classics` Liquidsoap source directly
as the S/NC TV fallback. The fallback should instead reference the broadcast channel's
`defaultPlayoutChannelId` from the database, resolved at config generation time." Part of the
broadcast source selector; fallback channel must be DB-driven not baked into the script.

**`streaming-snctv-broadcast-source-selector`** — "Admin UI for choosing what's on air for S/NC
TV: live creator, playout channel, or scheduled event. Intelligent priority-based fallback when
nobody is actively managing (e.g., scheduled event > live creator > default playout channel)."
`defaultPlayoutChannelId` on the channels table supports it at the data layer. "Enabled by the
playout channel architecture rethink — playout channels become selectable sources in the
broadcast source list."

**`streaming-programming-epg`** — "Time-slot-based scheduling for playout channels — `schedule`
table, programming grid UI, and EPG (Electronic Program Guide) output. Enables an admin to
assign playout content to time slots (e.g., 'S/NC Classics plays jazz on weekday mornings,
world music Friday evenings')." Deferred from Phase 5 follow-up.

**`streaming-liquidsoap-single-queue-per-output`** — "Decouple Liquidsoap from channel
identity — move to a single-queue-per-output architecture where Liquidsoap is purely a
decoder/encoder receiving one track at a time, and all queue/channel logic lives in the API.
Currently each channel needs its own `request.queue` + harbor endpoints baked into
`playout.liq`. This becomes a problem when: (a) channel count exceeds ~5 and static config
becomes unwieldy, (b) zero-downtime channel management is needed, or (c) channels need to share
output streams dynamically (e.g., channel scheduling on S/NC TV)." Prerequisite: config
generation + restart (Option A) first. "Full realization of 'API is the orchestrator,
Liquidsoap is the dumb player.'"

**`streaming-low-latency-webrtc`** — "Upgrade the live stream delivery path from HLS to WebRTC
using SRS WHIP (ingest) and WHEP (playback) for sub-second latency." Vidstack supports WHEP
natively. "Current HLS latency (~5-15s) is acceptable for most content; WebRTC is a future
upgrade." (SRS-side capability, not Liquidsoap.)

**`streaming-dvr-rewind-live`** — "YouTube-style live rewind — viewers can pause and rewind a
live stream by up to a configurable window (e.g., 30 minutes). Enabled by SRS native DVR
maintaining a rolling buffer. Vidstack player needs a DVR-aware seek bar... Depends on SRS DVR
recording being configured." (SRS-side.)

**`streaming-abr-transcoding-strategy`** — "FFmpeg sidecar with VAAPI hardware encoding for
adaptive bitrate (ABR) live stream delivery. Target hardware: Intel UHD 630 / i7-10700 CQP
mode... Include an audio-only rendition for music streaming on mobile." "Requires significant
infrastructure investment."

**`streaming-multi-rendition-playout-transcoding`** — "Currently skipped: Liquidsoap re-encodes
source files to FLV/RTMP on the fly regardless of uploaded MP4 renditions, making intermediary
renditions redundant for the playout path. Multi-rendition transcoding for playout only becomes
relevant if serving HLS directly from S3 (bypassing Liquidsoap) or adding ABR adaptive bitrate
playback."

**`streaming-auto-captions`** — "Speech-to-text on the live audio stream to generate real-time
captions (accessibility) and searchable transcripts (discovery). Runs as a sidecar process
consuming the SRS HLS output or a tapped audio stream, producing WebVTT segments synced to the
player." Caption delivery: "WebVTT is standard; HLS can embed via in-band CEA-608 or side-loaded
`.vtt` files. Vidstack player supports both." (The captioning is ASR-sidecar; the delivery
format is WebVTT/HLS.)

**`streaming-subtitle-delivery-player`** — "Deliver subtitle tracks extracted during Phase 5
playout ingest to the Vidstack player via WebVTT. Depends on subtitle tracks being stored during
Phase 5 ingestion (already done). The wiring from stored WebVTT files to the Vidstack
`<MediaPlayer>` track selection API is the remaining work." (Player-side wiring; the extraction
is done.)

**`streaming-srs-dvr-recording`** — "Configure SRS DVR to start FLV recording triggered by the
`on_publish` callback (depends on Phase 4 callback infrastructure, which shipped). SRS native
DVR writes the live stream to disk as FLV when a creator starts publishing." (SRS-side.)

**`streaming-stream-scheduling`** — "A `stream_schedule` table and CRUD endpoints for creators
to pre-announce upcoming live streams with a start time. Schedule entries display on the
creator's channel page and feed into the programming grid." (Application/DB-side; no engine
capability.)

**`streaming-premieres`** — "Scheduled VOD playback with live chat — a creator schedules a
previously recorded video to 'premiere' at a specific time, appearing as a live event... The
playout system enables this natively: a playout channel can be configured to play a single video
at a scheduled time. Depends on the programming schedule / EPG work for the scheduling layer."

**`streaming-clip-creation`** — "Allow viewers and creators to create shareable clips from live
streams or VODs using SRS DVR output and timestamp access... Requires SRS DVR recording to be in
place and a clip extraction job in the media-pipeline." (SRS DVR + media-pipeline; no Liquidsoap
capability.)

## Structural metadata

- All items `tags: [streaming, ...]`, `release_binding: null`, `created: 2026-04-20`.
- Capability split observed: Liquidsoap-side (fallback/source/channel/queue topology, playlist),
  SRS-side (DVR, WHIP/WHEP, recording), media-pipeline-side (transcoding, clip extraction,
  ASR), player-side (Vidstack track/DVR-seek wiring), application/DB-side (schedule tables, EPG
  grid).
