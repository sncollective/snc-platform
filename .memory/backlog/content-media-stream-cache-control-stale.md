---
tags: [content, ux-polish]
release_binding: null
created: 2026-04-24
---

# Media stream cache-control can serve stale bytes across mediaKey replacements

The `GET /api/content/:id/media` streaming route sets `cache-control: private, max-age=3600` on its response. The URL it serves from (`/api/content/<id>/media`) is a stable path that doesn't change when the underlying `mediaKey` / `transcodedMediaKey` changes on replacement — so the browser (and especially `<video>` element media caches) can keep serving the previous response for up to an hour, even on hard refresh, after the content has been replaced with a new upload.

Surfaced 2026-04-24 during `resumable-uploads-tus` review: a 4 GB HEVC replacement completed cleanly end-to-end on the server (canonical-path rename, probe, transcode, DB updates), but the content page kept playing the prior test video until the browser's internal media cache eventually rotated. Not tus-specific — the same race exists for any mediaKey replacement on the direct-S3 path.

## Fix directions (pick one at scope time)

1. **Cache-bust the URL** — append `?v=<updatedAt epoch>` (or a short content-hash) to `mediaUrl` + `thumbnailUrl` in `resolveContentUrls`. URL changes when the row changes; cache keys are fresh. Minimal change; server still emits a single stream route. Downside: range-request cache segments don't share across versions, mild extra bandwidth on rapid re-uploads.

2. **Tighten cache semantics on the stream route** — drop `max-age=3600` to something shorter with `must-revalidate`, and emit an `ETag` from the S3 object's ETag so `If-None-Match` can 304 cheaply. More plumbing; respects HTTP cache properly.

3. **Both** — version the URL for safety and add an ETag for efficiency. Probably the right long-term shape.

Relevant code: [content-media.routes.ts:278](../../apps/api/src/routes/content-media.routes.ts#L278), [content-helpers.ts:53-55](../../apps/api/src/lib/content-helpers.ts#L53-L55).

## Revisit if

- A CDN lands between browser and API; `private` stops being the right directive and cache-bust becomes mandatory for purge avoidance.
- Media files grow enough that repeated full re-fetches after replacement become a bandwidth concern.
