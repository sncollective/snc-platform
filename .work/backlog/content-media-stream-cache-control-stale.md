---
id: content-media-stream-cache-control-stale
kind: backlog
tags: [content, ux-polish, bug]
created: 2026-04-24
updated: 2026-06-20
---

# Media + thumbnail stream cache-control serves stale bytes across replacements

The content media/thumbnail stream routes serve from **stable URL paths** that don't change when
the underlying storage key changes on replacement, while emitting long `cache-control` lifetimes.
After a replace, the browser (and `<video>` media cache) keeps serving the prior response until
the cache window rotates — even on hard refresh.

Surfaced 2026-04-24 during `resumable-uploads-tus` review: a 4 GB HEVC replacement completed
cleanly server-side (rename, probe, transcode, DB updates) but the content page kept playing the
prior video. Not tus-specific — any `mediaKey`/`transcodedMediaKey` replacement hits it.

## Grounded findings (code-checked 2026-06-20)

| Path | Cache-Control | URL builder | Stale window |
|---|---|---|---|
| `GET /api/content/:id/media` | `private, max-age=3600` (`content-media.routes.ts:278`) | `content-helpers.ts:53-55` (`/api/content/<id>/media`, no version) | up to 1h |
| `GET /api/content/:id/thumbnail` | `public, max-age=86400` (`content-media.routes.ts:304`) | static `/api/content/<id>/thumbnail`, no version | **up to 24h** |

- **Thumbnail shares the bug and is worse** (24h window, `public`). Fix both in one pass.
- `content` row carries `updatedAt` (`content.schema.ts:30-32`), already bumped to `new Date()`
  on every media upload (`content-media.routes.ts:216`) and clear/replace
  (`content.routes.ts:256`). It's a ready cache-bust token — no migration needed.
- **No ETag is available** without contract surgery: `s3-storage.ts` `download()` discards the
  S3 ETag and `DownloadResult` (`packages/shared/src/storage.ts:19-30`) has no ETag field.
- Existing test asserts the media header verbatim (`content.routes.test.ts:1183`); **no**
  thumbnail-header test (coverage gap).

## Scoped fix — Option 1 (cache-bust the URL)

Append `?v=<updatedAt epoch>` to `mediaUrl` **and** `thumbnailUrl` in `resolveContentUrls`
(`content-helpers.ts`). The URL changes whenever the row changes, so the browser cache key
refreshes on every replace. ~4-6 lines, one file, no schema/contract change, fixes both paths.

**Rejected — Option 2 (ETag + shorter max-age):** requires extending the `StorageProvider`
contract to surface the S3 ETag and plumbing it through `streamFile`, and still leaves the path
stable (a CDN seeing only the path would serve stale). Higher cost, doesn't dominate Option 1
for the browser-cache case that's actually biting. *Revisit if a CDN lands between browser and
API* (the `private` directive stops fitting and proper HTTP revalidation earns its weight), or
if rapid re-uploads make range-segment cache churn a measured bandwidth problem.

## Scope (at implementing)

1. `resolveContentUrls` — append `?v=${updatedAt-as-epoch}` to both URLs (guard the null cases).
2. Update the media-header test and **add the missing thumbnail-header test**; assert the
   versioned URL shape so a future static-URL regression is caught.
3. Confirm `<video>`/`<img>` consumers don't strip or re-derive the query param anywhere.

User-verifiable (fix-verify loopback): replace a content item's media, reload the content page,
confirm the new media/thumbnail show immediately (no stale playback).
