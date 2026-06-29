---
id: idea-seed-demo-content-videos-lack-audio
kind: backlog
stage: backlog
tags: [bug, testing, streaming]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-28
updated: 2026-06-28
---

# Seed-demo content videos lack an audio track → unplayable in Liquidsoap

## Context

Surfaced while diagnosing the `creator-channel-engine-e2e-infra-machine-proof`
story: the e2e playback proof could queue Maya's "Studio Tour 2026" but
`nowPlaying.contentId` stayed null for 90s.

## Root cause

`apps/api/src/scripts/seed-demo.ts` `generateVideo()` builds creator content
mp4s from an ffmpeg `color=` lavfi source encoded with libx264 only — **no
audio track**. Liquidsoap's encoder chain requests
`{audio=pcm(stereo),video=canvas}`; a video-only mp4 fails decode
(`Cannot decode file ... Detected content: {video=canvas}`), the request is
destroyed, `on_metadata` never fires, so no `track-event` reaches the API and
the queued item never promotes to `nowPlaying`.

The playout clips from `scripts/dev/seed-playout-content.sh` decode fine
because they include a sine-wave AAC audio track.

## Impact

Any creator-channel queued-content playback proof (and any real creator
playback of these seeded videos) cannot complete: the media exists in Garage
but is undecodable by the playout engine.

## Fix direction

`generateVideo()` in `seed-demo.ts` should add a sine-tone audio source
(mirroring `seed-playout-content.sh`: `-f lavfi -i sine=...` + `-c:a aac`),
so the generated content mp4s carry audio and decode under Liquidsoap.

## Note

Fixed inline during the machine-proof diagnosis because it is load-bearing
for the proof to pass at all; this backlog item is the audit trail per the
test-integrity rule (file real production bugs rather than silently fixing
mid-pass). The fix shipped in commit `95755bb` (implement:
creator-channel-engine-e2e-infra-machine-proof). **Audit-only — this item is
not open work; the bug is fixed. Retain for traceability.**
