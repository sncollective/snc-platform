---
id: feature-playout-channel-architecture-phase2
kind: feature
stage: done
tags: [streaming]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: playout-channel-architecture
---

# Playout Channel Architecture — Phase 2 (Liquidsoap + Cleanup)

> **Review outcome (2026-04-18):** verification-only pass. Units 1-2 (env-var parameterized `playout.liq` + docker-compose channel env vars) were **superseded** by the `dynamic-liquidsoap-config` feature, which chose the "template regeneration" option this design listed as an alternative — `playout.liq` is now generated from DB channel rows on CRUD, and the hardcoded channel env vars were removed. Units 3-11 (real `LiquidsoapClient`, orchestrator init switch, `getNowPlaying`, dynamic `PLAYOUT_STREAM_NAMES`, streaming status via orchestrator, playlist/liquidsoap.ts cleanup, ingest handler cleanup, tests) were **verified in code**: `liquidsoap-client.ts` has the real implementation alongside the test stub, `playout-channels.init.ts` switches on `LIQUIDSOAP_API_URL`, `srs.ts` routes playout channels through `orchestrator.getMultiChannelQueueStatus`, no stale `regeneratePlaylist`/`writePlaylist`/`CHANNEL_NOW_PLAYING_PATHS`/`PLAYOUT_STREAM_NAMES` references remain, and `liquidsoap-client.test.ts` + `playout-orchestrator.test.ts` exist. Work happened on a different machine between the 2026-04-06 board snapshot and the 2026-04-18 migration; the old board was never updated to reflect completion. Bound to 0.3.0.

## Overview

Phase 2 wires the Phase 1 backend to Liquidsoap and cleans up the old playlist-based system. Delivers:

1. **Parameterized multi-channel Liquidsoap config** — replaces hardcoded `classics_*` / `snc_tv` with per-channel `request.queue` + `fallback` + `output.url`, driven by environment variables.
2. **Real `LiquidsoapClient` implementation** — replaces the Phase 1 stub with HTTP calls to per-channel harbor endpoints.
3. **`on_metadata` webhook callbacks** — Liquidsoap signals track starts to the API for queue advancement.
4. **Cleanup** — remove old playlist code (`regeneratePlaylist`, `writePlaylist`, `reloadPlaylist`, M3U constants), old `liquidsoap.ts` functions, hardcoded channel maps, and `PLAYOUT_STREAM_NAMES`.

### Dependencies
- Phase 1 must be complete (new tables, orchestrator, track-event endpoint, stub client)
- Liquidsoap v2.4 reference available via the `liquidsoap-v2` skill

## Implementation Units

### Unit 1: Parameterized `playout.liq`

**File**: `platform/liquidsoap/playout.liq` (full rewrite)

Replace the entire file. The new config uses environment variables for channel IDs and stream names. Each playout channel is a self-contained block:

```liquidsoap
# ── Channel: S/NC Classics (playout) ──

classics_id = environment.get("CHANNEL_CLASSICS_ID", default="")
classics_stream = environment.get("CHANNEL_CLASSICS_STREAM", default="channel-classics")

classics_queue = request.queue(id="channel-#{classics_id}")
classics = fallback(track_sensitive=false, [classics_queue, mksafe(blank())])

classics_uri = ref("")
classics_title = ref("")
classics.on_metadata(synchronous=false, fun(m) -> begin
  u = m["s3_uri"]
  classics_uri := if u == "" then m["filename"] else u end
  classics_title := m["title"]
  ignore(process.run("curl", [
    "-s", "-X", "POST",
    "http://#{api_host}:#{api_port}/api/playout/channels/#{classics_id}/track-event?secret=#{callback_secret}",
    "-H", "Content-Type: application/json",
    "-d", '{"uri":"#{classics_uri()}","title":"#{classics_title()}"}'
  ]))
end)

output.url(url="rtmp://#{srs_host}:1935/live/#{classics_stream}?key=#{playout_key}", enc, classics)

harbor.http.register(port=8888, method="POST", "/channels/#{classics_id}/queue", fun(req, res) -> begin
  classics_queue.push.uri(req.body())
  res.data("queued")
end)

harbor.http.register(port=8888, method="POST", "/channels/#{classics_id}/skip", fun(_req, res) -> begin
  classics.skip()
  res.data("skipped")
end)

harbor.http.register(port=8888, method="GET", "/channels/#{classics_id}/now-playing", fun(_req, res) -> begin
  e = classics.elapsed()
  r = classics.remaining()
  safe_elapsed = if e == infinity or e != e then -1. else e end
  safe_remaining = if r == infinity or r != r then -1. else r end
  res.json({
    uri = classics_uri(),
    title = classics_title(),
    elapsed = safe_elapsed,
    remaining = safe_remaining
  })
end)
```

No `playlist()` source. Old endpoints (`/classics/*`, `/reload-playlist`, `/write-playlist`) removed.

**Acceptance Criteria**:

- [ ] Each playout channel has: `request.queue`, `fallback`, `on_metadata` webhook, `output.url`, harbor endpoints
- [ ] No `playlist()` source anywhere in the config
- [ ] `on_metadata` POSTs to `/api/playout/channels/:id/track-event?secret=...`
- [ ] S/NC TV falls back to the default playout channel
- [ ] Old endpoints (`/classics/*`, `/reload-playlist`, `/write-playlist`) removed
- [ ] Health endpoint preserved at `/health`

---

### Unit 2: Docker Compose Environment Variables

**File**: `platform/docker-compose.yml` (modify `snc-liquidsoap` service)

Add:
- `PLAYOUT_CALLBACK_SECRET: ${PLAYOUT_CALLBACK_SECRET:-}`
- `CHANNEL_CLASSICS_ID: ${CHANNEL_CLASSICS_ID:-}`
- `CHANNEL_CLASSICS_STREAM: ${CHANNEL_CLASSICS_STREAM:-channel-classics}`
- `CHANNEL_SNCTV_STREAM: ${CHANNEL_SNCTV_STREAM:-snc-tv}`
- `DEFAULT_PLAYOUT_STREAM: ${DEFAULT_PLAYOUT_STREAM:-channel-classics}`
- `API_CALLBACK_HOST: snc-api`
- `API_CALLBACK_PORT: "3000"`

---

### Unit 3: Real `LiquidsoapClient` Implementation

**File**: `platform/apps/api/src/services/liquidsoap-client.ts` (replace stub)

```typescript
export const createLiquidsoapClient = (): LiquidsoapClient => {
  return {
    async pushTrack(channelId, uri) {
      const annotatedUri = `annotate:s3_uri="${uri}":${uri}`;
      return request(`/channels/${channelId}/queue`, {
        method: "POST",
        body: annotatedUri,
        headers: { "Content-Type": "text/plain" },
      });
    },
    async skipTrack(channelId) {
      return request(`/channels/${channelId}/skip`, { method: "POST" });
    },
  };
};
```

Stub kept for tests.

**Acceptance Criteria**:

- [ ] `createLiquidsoapClient()` calls `/channels/{channelId}/queue` for pushTrack
- [ ] URI is wrapped with `annotate:s3_uri=` before POSTing
- [ ] Returns `err` when `LIQUIDSOAP_API_URL` is not configured

---

### Unit 4: Update Orchestrator Initialization

**File**: `platform/apps/api/src/routes/playout-channels.init.ts`

Switch to real client when `LIQUIDSOAP_API_URL` is configured, stub otherwise.

---

### Unit 5: `getNowPlaying` for Per-Channel Queries

Extend `LiquidsoapClient` interface with `getNowPlaying(channelId): Promise<LiquidsoapNowPlaying | null>`.

---

### Unit 6: Update `PLAYOUT_STREAM_NAMES` to Dynamic Check

**File**: `platform/apps/api/src/routes/streaming.routes.ts`

Replace hardcoded `PLAYOUT_STREAM_NAMES` set with a DB query checking if a stream name belongs to an active channel.

---

### Unit 7: Update Streaming Status to Use Orchestrator

**File**: `platform/apps/api/src/services/srs.ts`

For playout channels: get now-playing from orchestrator queue status (faster, no Liquidsoap round-trip). For broadcast channels: use Liquidsoap client directly.

---

### Unit 8: Remove Old Playlist + Liquidsoap Code

**File**: `platform/apps/api/src/services/playout.ts`

Remove: `PLAYLIST_DIR`, `PLAYLIST_PATH`, `regeneratePlaylist`, `savePlaylist`, `reorderPlayoutItems`, related imports.

Bridge old admin operations to orchestrator:
- `queuePlayoutItem` → delegate to `orchestrator.insertIntoQueue`
- `skipCurrentTrack` → delegate to `orchestrator.skip`
- `getPlayoutStatus` → delegate to `orchestrator.getChannelQueueStatus`

---

### Unit 9: Remove Old `liquidsoap.ts` Functions

Remove: `CHANNEL_NOW_PLAYING_PATHS`, `skipTrack`, `queueTrack`, `reloadPlaylist`, `writePlaylist`.
Keep: `getNowPlaying` (still used for S/NC TV broadcast status).

---

### Unit 10: Update Playout Ingest Handler

Remove `regeneratePlaylist()` import and call from ingest handler. A newly ready item sits in the content pool and auto-fill picks it up naturally.

---

### Unit 11: Update Tests

1. `tests/services/playout.test.ts` — remove tests for removed functions, update bridge function tests
2. `tests/services/liquidsoap.test.ts` — remove tests for removed functions
3. `tests/services/liquidsoap-client.test.ts` (new) — tests for real `createLiquidsoapClient`
4. `tests/jobs/handlers/playout-ingest.test.ts` — remove `regeneratePlaylist` mock

---

## Implementation Order

1. **Unit 1**: New `playout.liq`
2. **Unit 2**: Docker compose env vars
3. **Unit 3**: Real `LiquidsoapClient`
4. **Unit 5**: Add `getNowPlaying` to client interface
5. **Unit 4**: Update orchestrator init
6. **Unit 6**: Dynamic `PLAYOUT_STREAM_NAMES`
7. **Unit 7**: Streaming status uses orchestrator
8. **Unit 10**: Remove `regeneratePlaylist` from ingest handler
9. **Unit 8**: Clean up `playout.ts`
10. **Unit 9**: Clean up `liquidsoap.ts`
11. **Unit 11**: Update tests

## Verification Checklist

```bash
bun --cwd=./platform run --filter @snc/api test
pm2 restart all
pm2 logs api --lines 30
docker compose --project-directory platform logs snc-liquidsoap --tail 20
curl http://localhost:8888/health
```
