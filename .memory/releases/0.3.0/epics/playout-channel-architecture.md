---
id: epic-playout-channel-architecture
kind: epic
stage: done
tags: [streaming, media-pipeline]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# Playout Channel Architecture Rethink

Revised 2026-04-01 from interactive scoping session. Supersedes the original brief.

> **Epic sign-off (2026-04-18):** all three phases reviewed and bound to 0.3.0 during this session — Phase 1 skip-with-note (backend foundation verified in code, end-to-end observation blocked by the now-resolved `streaming-callback-rate-limit` story), Phase 2 verification-only pass (Units 3-11 verified in code; Units 1-2 superseded by the `dynamic-liquidsoap-config` feature which chose the template-regeneration alternative), Phase 3 verification-only pass (Units 1-13 verified in code; trivial orphan file cleanup during the flip). The architectural direction set in this brief — queue as single playback stream, API as orchestrator, Liquidsoap as dumb player, data-driven channels — is observationally realized and was verified live via the admin UI and streaming endpoints. The "Phase Status" table below is now historical — all three phases are `done`. Epic bound to 0.3.0 per the `item-pipelines.md §Release binding lifecycle` "epics bind to their release" rule so the subtree archives together under `/release-deploy`.

## Problem

The playout system has three architectural issues:

1. **Queue and playlist are parallel fallback sources**, not a unified playback stream. Liquidsoap's `fallback(queue, playlist, silence)` toggles between them. The playlist cursor drifts independently while the queue is active, admin has no unified view of "what will play next."

2. **Channel names are hardcoded** in 8+ locations across Liquidsoap config, API services, routes, and seed scripts (`"channel-classics"`, `"snc-tv"`, `classics_playlist`, etc.). Adding a channel requires code changes everywhere.

3. **Queue state is ephemeral** — the in-memory `queuedEntries` array in `playout.ts` is lost on restart and supports only a single channel.

## New Model

### Key insight: eliminate the playlist concept

There is no ordered playlist. Only two concepts:

1. **Content pool** — items assigned to a channel. No ordering. Just a set of available content.
2. **Queue** — the playback order. DB-backed, always has N items prefetched. This is what the admin sees and interacts with.

When the queue runs low, auto-fill picks from the content pool using **recency + random** selection (not fixed rotation).

### API is the orchestrator, Liquidsoap is the media engine

**Queue is the single playback stream.** Everything plays through the queue. No playlist source in Liquidsoap at all.

**API owns queue state in the database.** The `playout_queue` table is the source of truth. The API decides what to push to Liquidsoap and when.

**Liquidsoap is a dumb player.** It receives tracks via `request.queue.push.uri()`, plays them, signals track changes via webhook. It doesn't decide what plays next.

### Gapless prefetch via buffer

The API pushes **2-3 tracks ahead** to Liquidsoap's `request.queue` for gapless playback.

1. On startup: push initial N tracks from DB queue (or auto-fill from content pool)
2. When Liquidsoap signals "track started" (webhook): advance queue, push next track
3. If DB queue is empty when fill is needed: auto-fill from content pool

### Auto-fill: recency + random

Selection from the content pool when the queue needs filling:

- Track `lastPlayedAt` and `playCount` per item per channel (on `channel_content` join table)
- Select randomly, weighted away from recently played items
- Future: add `weight`/`priority` field for boosting fresh content

### Track lifecycle signaling

**Primary: webhook.** Liquidsoap's `on_metadata` callback POSTs to `POST /api/playout/channels/:id/track-event`.

**Fallback: poll.** Existing 3-second status poll detects track changes if webhook fails.

### Channels are data-driven

Each playout channel is a row in the existing `channels` table (`type: "playout"`). Liquidsoap config is parameterized — one `request.queue` + `fallback(queue, silence)` + `output.url` per channel.

## Data Model

### `channel_content` table (new)

Join table replacing the implicit "all playout_items are in the playlist" relationship.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid, PK | |
| `channelId` | uuid, FK → channels | Which playout channel |
| `playoutItemId` | uuid, FK → playout_items | Which content |
| `lastPlayedAt` | timestamp, nullable | Last time this item played on this channel |
| `playCount` | integer, default 0 | How many times played on this channel |
| `createdAt` | timestamp | When assigned to channel |

Unique constraint on `(channelId, playoutItemId)`.

### `playout_queue` table (new)

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid, PK | |
| `channelId` | uuid, FK → channels | Which playout channel |
| `playoutItemId` | uuid, FK → playout_items | What content |
| `position` | integer | Playback order (0 = currently playing) |
| `status` | text | `queued` / `playing` / `played` |
| `pushedToLiquidsoap` | boolean | Whether pushed to the prefetch buffer |
| `createdAt` | timestamp | When queued |

## Liquidsoap Config

Per channel:
```
channel_{id}_queue = request.queue(id="channel-{id}")
channel_{id} = fallback(track_sensitive=false, [channel_{id}_queue, mksafe(blank())])
output.url(url="rtmp://srs:1935/live/{srsStreamName}?key=...", enc, channel_{id})
```

No `playlist()` source. The `mksafe(blank())` is only for startup before the API pushes first tracks.

### Per-channel harbor endpoints

```
POST /channels/{id}/queue         — push track URI
GET  /channels/{id}/now-playing   — current track metadata
POST /channels/{id}/skip          — skip current track
```

## API Service: Queue Orchestration

New service: `playout-orchestrator.ts`

Core loop (per channel):
1. On startup: for each playout channel, fill Liquidsoap queue buffer from DB queue (or auto-fill from content pool if empty)
2. On track-event webhook: mark current as `played`, update `lastPlayedAt`/`playCount`, push next track, auto-fill if below threshold
3. On skip: mark current as `played`, tell Liquidsoap to skip, push next
4. On play-next: insert at position 1, push to Liquidsoap if within prefetch window
5. On content pool change: no immediate queue effect

## Migration Path

1. New tables: `channel_content`, `playout_queue` (schema + migration)
2. Queue orchestration service with auto-fill logic
3. Parameterized Liquidsoap config (replace hardcoded channels)
4. Track-event webhook endpoint + Liquidsoap `on_metadata` callback
5. New playout admin API routes (channel-aware)
6. Admin UI rebuild: channel selector, queue view, content pool
7. Cleanup: remove M3U generation, `regeneratePlaylist()`, `writePlaylist()`, `reloadPlaylist()`, in-memory queue, hardcoded channel names
8. Data migration: existing playout_items → channel_content assignments

## Hardcoded Channel References to Remove

| File | Lines | Reference |
|------|-------|-----------|
| `playout.liq` | 70, 74 | Output URLs with `snc-tv`, `channel-classics` |
| `playout.liq` | 86-153 | Per-channel harbor endpoints |
| `liquidsoap.ts` | 53-56 | `CHANNEL_NOW_PLAYING_PATHS` Record |
| `liquidsoap.ts` | 134, 146 | `"channel-classics"` checks in skip/queue |
| `playout.ts` | 318, 351, 365 | `"channel-classics"` in status/queue/skip |
| `streaming.routes.ts` | 106 | `PLAYOUT_STREAM_NAMES` Set |
| `seed-channels.ts` | 9-16 | Hardcoded channel definitions |

## Out of Scope

- Broadcast channel source selector (separate backlog item)
- Weighted priority / content boosting (future — data model supports it)
- Dynamic Liquidsoap config generation (static parameterized config for now)
- EPG / time-slot scheduling (enabled by this architecture but separate)
- Media delivery optimization (S3 download caching, presigned URLs)

## Phase Status

- **Phase 1 (Backend Foundation)** — stage: review. Backend works but queue playback blocked by Phase 2.
- **Phase 2 (Liquidsoap + Cleanup)** — stage: review. playout.liq still uses hardcoded env vars; needs re-scoping.
- **Phase 3 (Admin UI)** — stage: drafting. Design completed 2026-04 but not started; sequenced after Phase 1+2.
