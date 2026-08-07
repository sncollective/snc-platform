---
id: content-library-core
kind: feature
stage: drafting
tags: [media, content]
parent: content-library
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-07
---

# Content library — asset store + registry + API (foundation)

## Brief
The foundation: a **content-addressable asset store** (asset key = content hash
→ automatic dedup: same bytes uploaded anywhere = one stored copy), an **asset
registry** (metadata: hash, MIME, dimensions, size, owner creator, uploaded
timestamp), and the **library API** — upload (hash → store-once → return
assetKey), list/get a creator's assets, and delete with reference-counting (only
GC an asset when no surface references it). Built on the existing Garage
`storage` abstraction; imgproxy keeps resolving asset keys → responsive
descriptors.

## Epic context
- Parent epic: `content-library`
- Position: **foundation feature** — every consumer (the UI, the migration, and
  downstream epics like `creator-press-page-v2` image-management) depends on it.

## Simplification opportunity
- Replaces per-surface image storage prefixes (`creators/{id}/{avatar|banner}`,
  `content/`, `creators/{id}/press/`) with one content-addressable store.
- Dedup is automatic (re-upload = no-op store).

## Foundation references
- Storage: `apps/api/src/storage/index.js`
- Existing upload paths: `apps/api/src/routes/creator-media.routes.ts` (avatar/banner),
  `apps/api/src/routes/upload.routes.ts` + `apps/api/src/services/upload-completion.ts` (Uppy/tus content)
- imgproxy: `apps/api/src/lib/imgproxy.ts`, `apps/api/src/lib/creator-url.ts`
