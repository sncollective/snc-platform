---
id: content-library-migration
kind: feature
stage: review
tags: [media, content, refactor]
parent: content-library
depends_on: [content-library-core]
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-09
---

# Content library — migrate existing surfaces onto the asset store

## Brief
Migrate the existing per-surface images — avatars, banners, content-media
(and v1 press photos) — onto the content-addressable asset store: hash each
existing object, register it as an asset, dedup, and re-point the surface's
reference (e.g. `creator_profiles.avatarKey` → an asset reference). Eliminates
the N× duplication already on disk + back-fills the library so the browse/reuse
UI has the creator's existing images available immediately.

## Epic context
- Parent epic: `content-library`
- Position: consumer of `content-library-core`; the `[refactor]` that removes
  existing duplication + back-fills the library. Isolated to contain risk
  (touches live surfaces).

## Simplification opportunity
- Removes existing duplicate hosting (avatars/banners/content stored once each,
  referenced everywhere).

## Foundation references
- Existing surfaces: `creator_profiles.avatar_key`/`banner_key`,
  `content-media` keys, v1 `creator_press_configs.content.photos`
- `content-library-core` (the asset store + registry)
- Storage: `apps/api/src/storage/index.js`

## Risks
- Touches live surfaces — needs careful re-pointing + verification per surface.
- imgproxy delivery must keep resolving (asset keys vs old per-surface keys
  during the transition).

## Implementation notes

- Execution capability: inline direct-read implementation; one cohesive, high-risk
  data-transform boundary, with nested agents explicitly prohibited by the caller.
- Review weight: standard (project default), stopping at `review` per the caller's
  requested worker boundary.
- Migration approach: one-shot `db:migrate-content-library` script backed by an
  idempotent service. It reads avatar/banner, content thumbnail, v1 press-photo,
  and every v2 `PressImage.key`/release-art reference; downloads and byte-detects
  each source; registers it through `uploadLibraryAsset`; verifies the destination
  object's SHA-256; then re-points all prepared references in one transaction.
  An optional creator-id scope isolates real-DB verification fixtures.
- Risk isolation: no live reference changes until every destination has uploaded
  and hash-verified. Optimistic old-value predicates reject concurrent edits. A
  preparation failure leaves every surface reference unchanged. Legacy source
  objects remain as rollback copies; active references and storage backing converge
  on the deduplicated library object. Surface replace/clear/delete paths now refuse
  to delete shared `library/...` blobs.
- Files changed: `apps/api/src/services/content-library-migration.ts`,
  `apps/api/src/scripts/migrate-content-library.ts`, `apps/api/package.json`, the
  creator/content media mutation routes, their unit tests, and
  `apps/api/tests/integration/content-library-migration.test.ts`.
- Tests added: real PostgreSQL + Garage migration proof for avatar, banner,
  content thumbnail, v1 press photo, and v2 press-image delivery; same-byte
  cross-surface dedup; unchanged audio/video media key; second-run no-op;
  all-or-nothing reference behavior on a missing source; and route regressions
  preventing replacement/clear/delete from removing shared library blobs.
- Tests removed: none.
- Simplification: the existing content-library upload service remains the sole
  hash/detection/dedup implementation; the migration adds no parallel registry or
  schema.
- Discrepancies from design: content `mediaKey` is intentionally not migrated
  because the content library accepts images only and that column contains audio
  or video; `thumbnailKey` is the content-media image surface. No Drizzle migration
  was generated.
- Adjacent issues parked: none.

## Integrated verification

- Dev migration: 18 source image objects/read registrations, 18 references and
  updates, 18 verified library objects; the immediate repeat and the post-suite
  repeat were exact zero-work no-ops.
- Real surface proof: avatar, banner, and content-thumbnail routes returned the
  original bytes from their new library key; v1 press-photo delivery redirected
  to the immutable raw library route and returned the original bytes; v2 press
  descriptors retained their metadata and resolved the same library key through
  imgproxy URL generation.
- API unit: 125 files / 2,005 tests passed.
- API integration: 12 files / 53 tests passed, including 2 migration tests against
  real PostgreSQL and Garage.
- TypeScript: `cd apps/api && npx tsc --noEmit` passed with zero errors.
- `git diff --check` passed.
