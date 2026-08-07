---
id: content-library-ui
kind: feature
stage: drafting
tags: [media, content, ui]
parent: content-library
depends_on: [content-library-core]
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-07
---

# Content library — browse/reuse picker

## Brief
The creator-facing **browse/reuse picker**: a component surfaces the creator's
existing library assets (grid of thumbnails) so they pick an existing asset
instead of re-uploading, across surfaces (avatar, banner, content-media, press
kit). Integrates with each surface's image slot ("upload new" vs "pick from
library"). Reusing an asset creates a new *reference* (with its own crop/alt/
credit per surface), not a new copy.

## Epic context
- Parent epic: `content-library`
- Position: consumer of `content-library-core`; the creator-facing surface that
  realizes the "don't re-host" benefit as a UX (not just dedup-on-upload).

## Simplification opportunity
- Lets creators reuse assets across surfaces without re-uploading (the dedup
  benefit made visible + deliberate).

## Foundation references
- Existing upload UI: `apps/web/src/contexts/upload-context.tsx` (Uppy),
  `apps/web/src/lib/creator.ts` (avatar/banner upload), the press editor's photo flow
- `content-library-core` API
