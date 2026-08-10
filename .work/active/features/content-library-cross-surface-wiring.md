---
id: content-library-cross-surface-wiring
kind: feature
stage: review
tags: [media, content, refactor]
parent: content-library
depends_on: [content-library-core, content-library-migration]
release_binding: null
gate_origin: null
created: 2026-08-10
updated: 2026-08-10
---

# Content library — wire avatar/banner/content uploads through the library

## Brief
Close the epic-level gap that the content-library is press-only: route the other
image upload surfaces — **avatar, banner, content thumbnails** — through the
content-addressable library (upload → hash → dedup → register → reference the
library key), so new uploads across ALL surfaces dedup + are reusable (not just
press). The migration re-pointed EXISTING images; this ensures NEW uploads also
go into the library (no per-surface duplication recreated). Large-media
(video/audio) tus path stays (parked unified vision). Behavior-preserving
(avatar/banner/thumbnails render the same — imgproxy/raw resolve library keys).

## Scope
- **avatar/banner** (`apps/api/src/routes/creator-media.routes.ts`): the upload writes to the content-library (hash→dedup→register) + references the library key in `avatarKey`/`bannerKey`. The streaming GETs resolve library keys (imgproxy / the library raw route). Behavior-preserving (same images render).
- **content thumbnails** (`apps/api/src/services/upload-completion.ts`): route image-thumbnail upload through the library (purpose-prefixed keys → library keys). Large-media (video/audio) tus path UNCHANGED (unified vision).
- **Web upload UIs**: the avatar/banner upload calls the library upload (not the direct per-surface one). (Optional: reuse the media-picker for avatar/banner — your call; minimum is the library upload wiring.)
- **Behavior-preserving refactor** — black-box: avatar/banner/thumbnails render identically; only the storage backing changes (per-surface prefix → library key).

## Bundled content-library epic should-fixs (same worker)
- **Migration metadata preservation:** `uploadLibraryAsset` without a sharing arg defaults `private` + can overwrite an existing registration's `sharing`/`originalFilename` during dedup. Preserve existing live-registration metadata on dedup (or use ensure-only semantics).
- **Browse canUse aggregation:** list/get derive status from ONE registration row, but `canUseAsset` authorizes if ANY registration grants → browse status can disagree. Aggregate use-status per blob (consistent with `canUseAsset`).
- **Dead-end request link:** the legacy press picker's "Request access in library" link (`?asset=…`) goes nowhere (request flow parked). Replace with non-actionable explanatory copy.

## Accepted MVP boundary (operator-confirmed)
- **Sharing posture hard-coded `private`** for MVP (1 creator; the sharing UI/filters/badges are theoretical until multi-creator). No sharing-control UI in the picker/page uploads. Note in the epic.

## Acceptance
- [x] avatar/banner/content-thumbnail uploads route through the library (hash→dedup→register→library key); same images render (behavior-preserving).
- [x] Large-media (video/audio) tus path unchanged.
- [x] Migration metadata preserved on dedup; browse canUse aggregates per-blob; dead-end request link replaced.
- [x] Tests green; typecheck 0.

## Notes
- This is the cross-surface wiring that makes the content-library epic's "reuse across surfaces" promise real (not press-only). Closes the epic review's blocking gap #1. Gap #2 (sharing authoring) accepted as MVP.

## Implementation notes
- Execution capability: `openai-codex/gpt-5.6-sol`; cohesive cross-surface implementation kept with one owner as requested, with no nested agents.
- Review weight: stop at `review` per caller transition instruction.
- Files changed: creator/library routes, library and upload-completion services, web creator upload clients/context, press picker copy, focused API/web tests, and the parent epic MVP note.
- Tests added/updated: ensure-only metadata preservation; blob-wide browse authorization aggregation; avatar/banner library assignment, rendering, and web endpoint wiring; thumbnail completion dedup/reference wiring; unchanged large-media completion; dead-end-link removal.
- Simplification: avatar/banner clients now share the existing content-library upload helper instead of maintaining direct per-surface multipart calls.
- Discrepancies from design: none. The library upload endpoint accepts an internal `usage` marker so web uploads register and assign the avatar/banner key atomically from the caller's perspective; direct creator-media endpoints remain library-backed for API compatibility.
- Adjacent issues parked: none.
- Verification: API unit 125 files / 2011 tests; API integration 12 files / 54 tests; web unit 185 files / 1910 tests; API and web typechecks plus explicit `npx tsc --noEmit` both green. Library-key streaming assertions cover avatar/banner; thumbnail completion records the deduped library key and cleans the temporary purpose key; content-media completion asserts the library path is not invoked.
