---
id: content-library-migration
kind: feature
stage: drafting
tags: [media, content, refactor]
parent: content-library
depends_on: [content-library-core]
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-07
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
