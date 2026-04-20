---
id: epic-prod-playout-fixes
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

# Prod Playout Fixes

Two issues discovered during 0.2.0 prod deployment that block playout with real content.

## Issue 1: Playlist cross-container sync

**Problem:** The API writes `playlist.m3u` to the local filesystem (`platform/liquidsoap/playlist.m3u` — resolved via `import.meta.dirname` in `playout.ts:37-41`). In dev, Liquidsoap reads the same file via Docker volume mount (`./liquidsoap:/etc/liquidsoap` in `docker-compose.yml`). In prod, the API runs on the app LXC and Liquidsoap runs on the SRS LXC — different containers, different filesystems. The playlist file never reaches Liquidsoap.

**Current flow in `regeneratePlaylist()` (`playout.ts:201-231`):**
1. Query DB for enabled, ready items ordered by position
2. Build M3U with `#EXTM3U` header, `#EXTINF` metadata, and S3 URIs (best rendition: 1080p → 720p → 480p → source)
3. Atomic write: temp file → rename to `playlist.m3u`
4. Call `reloadPlaylist()` via HTTP POST to `/reload-playlist`

Step 3 writes on the API host (useless in prod). Step 4 tells Liquidsoap to reload from its own disk (stale file in prod).

**Existing infrastructure:** Liquidsoap already has harbor HTTP endpoints for queue, skip, now-playing, and reload (`playout.liq:81-145`). The API already calls these via `liquidsoapRequest()` in `liquidsoap.ts:20-40`. The existing `/reload-playlist` endpoint (`playout.liq:142-145`) only calls `classics_playlist.reload()` from disk — it doesn't accept content.

**Recommended approach:** Add a `/write-playlist` POST endpoint to Liquidsoap's harbor that accepts M3U content in the request body, writes it to disk, and reloads. This is distinct from the existing `/reload-playlist`.

- `playout.liq` — new harbor endpoint: parse body, write to `/etc/liquidsoap/playlist.m3u`, call `classics_playlist.reload()`
- `services/liquidsoap.ts` — add `writePlaylist(content: string)` that POSTs to `LIQUIDSOAP_API_URL/write-playlist`
- `services/playout.ts` — `regeneratePlaylist()` calls `writePlaylist()` when `LIQUIDSOAP_API_URL` is set, falls back to local file write + `reloadPlaylist()` in dev

> **Status:** Superseded by the [playout-channel-architecture](playout-channel-architecture.md) rethink, which eliminates the playlist concept entirely in favor of a DB-backed queue. Not implemented as originally designed. Full design text preserved in git history on `boards/platform/release-0.2.1/design/prod-playout-fixes.md` (units 1-3).

## Issue 2: Server-side upload fails over ~5GB

**Problem:** Playout ingest (`jobs/handlers/playout-ingest.ts`) downloads the source from S3, remuxes it via ffmpeg, then re-uploads via `uploadFromTemp()` (`processing-jobs.ts:129-148`). This calls `storage.upload()` which is a single `PutObject` call. S3/Garage limits single-part uploads to ~5GB. A 6.2GB file fails with `S3_ERROR: data is too long`.

**Compounding issue:** `storage.upload()` in `s3-storage.ts:46` does `new Response(stream).arrayBuffer()` — it buffers the entire file into memory as a `Uint8Array` before passing to `PutObjectCommand`. This means even files under 5GB could cause OOM on memory-constrained environments. The platform allows video uploads up to 20GB (`packages/shared/src/storage.ts:79`).

Client-side uploads already handle large files via the multipart upload API in `storage/s3-multipart.ts` (browser → presigned URLs → direct to S3). The gap is server-side: `uploadFromTemp()` has no multipart path.

**Recommended approach:** Use `@aws-sdk/lib-storage` `Upload` utility in `uploadFromTemp()` for files above a threshold (e.g., 100MB). This handles chunking and streaming automatically with the existing S3 client. No new storage interface needed — the `Upload` utility wraps the same `S3Client` instance from `storage/index.ts`.

- `@aws-sdk/lib-storage` needs to be added as a dependency (not currently installed; only `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` are present)
- The `Upload` utility accepts a `ReadableStream` or Node `Readable`, avoiding the full-buffer-to-memory issue

> **Status:** Shipped 2026-04 as the BOARD-tracked "Streaming multipart upload fix." See [prod-playout-fixes-multipart-upload](../features/prod-playout-fixes-multipart-upload.md).

## Children

- [prod-playout-fixes-multipart-upload](../features/prod-playout-fixes-multipart-upload.md) — shipped (issue 2)
- Issue 1 work superseded; no child item. Tracked implicitly by [playout-channel-architecture](playout-channel-architecture.md).
