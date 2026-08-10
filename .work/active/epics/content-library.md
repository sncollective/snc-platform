---
id: content-library
kind: epic
stage: review
tags: [media, content]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-07
---

# Content library — shared, dedup media assets across surfaces

## Brief

Creators upload images across surfaces (avatar, banner, content-media, press
kit). Today each surface stores its own copy under per-surface prefixes
(`creators/{id}/{avatar|banner}/…`, `content/…`, `creators/{id}/press/…`), so
the same photo used as the avatar + the press banner + in content is stored
N×. This epic introduces a **shared, content-addressable media library**:
assets stored once (keyed by content hash → automatic dedup), referenced by
every surface; plus a browse/reuse UI so creators pick an existing asset
instead of re-uploading. Built on the existing Garage `storage` abstraction;
imgproxy delivery continues to resolve asset keys → responsive descriptors.

## Decomposition

Split by capability: the asset store + registry + API is the foundation every
consumer (the UI, the migration, and downstream epics like the press-page v2)
depends on; the browse/reuse UI is the creator-facing picker; the migration
re-points existing per-surface images onto the store.

### Child features

- `content-library-core` — content-addressable asset store (hash-keyed →
  automatic dedup) + asset registry (hash, MIME, dimensions, size, owner,
  uploaded) + the library API (upload→dedup, list/get/delete-with-refcount).
  Built on the existing `storage` abstraction. — depends on: `[]`
- `content-library-ui` — the browse/reuse picker component creators use across
  surfaces (avatar/banner/content/press) to choose an existing asset instead of
  re-uploading. — depends on: `[content-library-core]`
- `content-library-migration` — migrate existing per-surface images (avatars,
  banners, content-media) onto the asset store: hash, dedup, re-point
  references. Touches live surfaces — risky, isolated. — depends on:
  `[content-library-core]` — tag `[refactor]`

### Simplification arcs

- core — replaces per-surface image storage prefixes with one content-addressable
  store; dedup is automatic (re-upload = no-op store).
- migration — removes the N× duplication of existing avatars/banners/content.

### Decomposition risks

- Migration touches live surfaces (avatar/banner/content-media) — needs
  careful re-pointing + verification; isolating it as its own `[refactor]`
  feature contains the risk.
- imgproxy integration must keep working (it resolves keys → descriptors) —
  verify asset keys flow through the existing `creator-url`/`imgproxy` path.

## Cross-epic dependency

The press-page v2 (`creator-press-page-v2`) consumes this:
`creator-press-page-v2-image-management` **depends on `content-library-core`**
(press images reference library assets). `content-library-core` lands first.

## Notes

- Reusable platform-wide (avatars, banners, content, press, future surfaces).
- The asset/reference split: bytes live once on the asset (by hash); per-use
  metadata (crop, alt, credit) lives on the *reference* in each surface's
  content model.
