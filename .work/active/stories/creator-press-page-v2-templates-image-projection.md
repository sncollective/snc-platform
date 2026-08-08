---
id: creator-press-page-v2-templates-image-projection
kind: story
stage: implementing
tags: [creators, content, ui]
parent: creator-press-page-v2-templates
depends_on: [creator-press-page-v2-image-management]
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-07
---

# Press templates — public image delivery projection

## Checkpoint

Establish the server-only boundary between raw `PressImage` metadata and the
responsive images consumed by the public React templates.

- Add delivered-image/public-content types and Zod response shape in
  `packages/shared/src/press.ts` without changing editable `PressContent`.
- Add `apps/api/src/lib/press-url.ts`; for each non-null image call
  image-management's exact `buildPressImageUrl(image, slot, width)` contract.
- Resolve banner/about/member/cover/gallery with slots `banner/about/member/cover/gallery`
  and widths `1920/720/480/480/960` respectively.
- Apply the projection only to public `GET /:creatorId/press`; manage routes keep
  raw content. Do not duplicate crop math or import signing code into web.

## Acceptance evidence

- Unit test mocks the helper and proves slot/width calls, ordering, null behavior,
  and preservation of crop/alt/credit.
- Public API route test proves the delivered payload validates; manage tests prove
  their contract is unchanged.
- Typecheck confirms browser code consumes delivered values rather than the
  server signer.

## Ordering

Blocked on `creator-press-page-v2-image-management`, which owns optional crop,
`PressImageSlot`, and `buildPressImageUrl`.
