---
id: idea-livestate-offline-while-streaming
created: 2026-06-17
tags: [streaming, playout]
---

# Channel liveState shows "Offline" while the channel is actually streaming

Surfaced during the editorial-engine staging walk (2026-06-17). In the live UI,
S/NC Classics + test/test2/test34 display **"Offline"** even though SRS is
actively writing and serving their HLS segments (confirmed: `channel-classics-*.ts`
being written, and a client `GET channel-classics.m3u8`). Meanwhile S/NC Music and
S/NC TV show "Scheduled" — the only two with a backing signal the status logic reads.

## Root cause

`deriveLiveState()` for **playout**-role channels (`apps/api/src/services/srs.ts`)
computes `isAiring = (nowPlaying !== null)`, and `nowPlaying` for playout channels
comes ONLY from `orchestrator.getMultiChannelQueueStatus()` — i.e. a `playout_queue`
row with `status='playing'`. Channels airing from the **pool/`channel_content`** LRP
auto-fill, or from the **static default/fallback render**, have 0 `playout_queue`
playing items, so `isAiring=false` → `"offline"` despite live HLS.

Evidence at walk time: Classics had 0 queue items AND 0 pool items yet was serving
HLS (default/fallback render); S/NC Music had 103 queue items / 1 playing → correctly
"Scheduled".

## Why it matters now

The editorial engine **sharpens** this. Under the unified program-source model, "auto"
mode runs a readiness fallback over enabled sources (the operator queue auto-fills from
the pool), so a pool-fed channel with no operator-queued playing-item is *genuinely
airing* but reports Offline. "Offline = no `playout_queue` playing item" predates the
editorial model and hasn't caught up.

## Fix direction (for scope/design, not decided here)

Broaden the playout `isAiring` signal to also reflect pool/auto airing and/or actual
SRS publish presence. Note `hasActiveSrsSession` is **already computed** in
`getChannelList` but currently consumed only for the `live-ingest`/`broadcast` roles,
not for `playout` — so the SRS-presence signal is already in hand.

## Scope note

Pre-existing (not caused by the editorial work; `deriveLiveState` predates the editorial
model). **Not a blocker** for the editorial-engine staging gate — that gate verified the
playout runtime mechanism (mode/manual/arm/take/LRP/regenerate-restart). This is the
separate UI status-reporting layer.
