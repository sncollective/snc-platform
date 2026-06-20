---
id: content-media-stream-cache-control-stale
kind: story
stage: review
tags: [content, ux-polish, bug]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-04-24
updated: 2026-06-20
---

# Media + thumbnail stream cache-control serves stale bytes across replacements

Promoted from backlog and fixed. The content media/thumbnail stream routes serve from **stable
URL paths** (`/api/content/<id>/media`, `/api/content/<id>/thumbnail`) that don't change when the
underlying storage key is replaced, while emitting long `cache-control` lifetimes (`private,
max-age=3600` for media; `public, max-age=86400` for thumbnails). After a replace the browser and
`<video>` media cache kept serving the prior response for the full window — even on hard refresh.

Surfaced 2026-04-24 during `resumable-uploads-tus` review (a 4 GB HEVC replace completed
server-side but the page kept playing the old video). Not tus-specific — any
`mediaKey`/`transcodedMediaKey` replacement hit it.

## Fix — Option 1 (URL cache-bust)

`resolveContentUrls` (`apps/api/src/lib/content-helpers.ts`) now appends `?v=<updatedAt epoch>` to
both `mediaUrl` and the thumbnail fallback URL via a small `cacheBust(updatedAt)` helper.
`content.updatedAt` is bumped on every media upload/replace, so the served URL changes exactly when
the bytes change and the browser cache key refreshes. ~one helper + two call-site threads, one
file, no schema/contract change.

- The imgproxy `thumbnail` srcSet is keyed on `thumbnailKey` (which already changes on replace), so
  it needs no bust — only the stable `/api/content/<id>/…` fallback paths did.
- All `mediaUrl`/`thumbnailUrl` consumers pass the value straight to a player `src`/`href` or
  null-check it; none parse the path, so the query param is safe everywhere. The stream routes read
  the `:id` path param and ignore the query.

**Rejected — Option 2 (ETag + shorter max-age):** would need the `StorageProvider` contract
extended to surface the S3 ETag (currently discarded in `s3-storage.ts`) and plumbed through
`streamFile`, and still leaves the path stable (a CDN seeing only the path serves stale). Higher
cost, doesn't dominate Option 1 for the browser-cache case that's biting. *Revisit if a CDN lands
between browser and API* (the `private` directive stops fitting and proper HTTP revalidation earns
its weight), or if rapid re-uploads make range-segment cache churn a measured bandwidth problem.

## Verification

- API unit suite green: 1781/1781. Added a `content-helpers` regression test proving the URL
  changes when `updatedAt` changes, and **two new thumbnail-route tests** (header + no-thumbnail
  404) closing a prior coverage gap (the thumbnail stream route had no test).
- Access-gating assertions in `content.routes.test.ts` relaxed from exact-URL to path-`toContain`
  (the gate cares about present-vs-null, not the incidental cache-bust token); the dedicated
  URL-resolution test asserts the exact versioned shape.
- `tsc --noEmit` clean (api); web suite unaffected (1764/1764).

## Fix-verify loopback (pending)

In the running app: replace a content item's media (and/or thumbnail), reload the content page,
confirm the new media/thumbnail appear immediately — no stale playback or stale poster. Story
stays at `stage: review` until confirmed.
