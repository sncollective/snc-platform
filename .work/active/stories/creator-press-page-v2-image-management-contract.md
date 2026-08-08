---
id: creator-press-page-v2-image-management-contract
kind: story
stage: done
tags: [creators, content, ui]
parent: creator-press-page-v2-image-management
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-07
---

# Press image crop contract + slot-aware imgproxy URL (Unit 1)

The shared checkpoint for every press image consumer: normalized per-reference crop metadata and one API-side slot registry/builder for fixed-aspect delivery.

## Scope

- Extend `PressImageSchema` in `packages/shared/src/press.ts` with optional
  `crop: {x,y,width,height}` in normalized source-image coordinates. Validate
  finite 0–1 bounds, positive dimensions, and `x + width <= 1` / `y + height <= 1`.
  Keep `alt` structurally required but allow legacy normalized rows' current
  empty string; the new image controls enforce nonblank alt before apply.
- Export the exact slot registry/type in `packages/shared/src/press.ts`:
  banner `3/1`, about `4/5`, member `1/1`, gallery `4/3`, cover `1/1`.
- Add `buildPressImageUrl(image, slot, width)` in
  `apps/api/src/lib/imgproxy.ts`. It derives integer output height from the slot,
  converts the crop rect to width/height + focal-point center, emits the required
  `c:…/rs:fill:…/g:ce` path, and signs the complete path with the existing HMAC
  signer. A missing crop emits only `rs:fill:…/g:ce`.
- Canonicalize normalized crop values to six decimals for stable cache keys.
  imgproxy treats an exact crop dimension `1` as one pixel, not 100%; encode a
  full normalized axis as `0` (imgproxy's documented full-source sentinel).
- Return `src` at the requested maximum width, a de-duplicated quarter/half/full
  width `srcSet` (minimum 160px), and slot `sizes` aligned to the locked 760px and
  480px template breakpoints. Each candidate reuses the exact crop and differs
  only in output dimensions/signature.

## Acceptance evidence

- [x] Shared schema accepts valid normalized crop rectangles and rejects negative,
      zero-sized, non-finite, or out-of-source rectangles.
- [x] No-crop banner at width 1500 contains
      `rs:fill:1500:500:0/g:ce` in the signed processing path.
- [x] Crop `{x:.1,y:.2,width:.6,height:.4}` emits
      `c:0.6:0.4:fp:0.4:0.4` before the slot resize.
- [x] A crop whose width or height is exactly `1` uses `0` for that imgproxy crop
      dimension rather than accidentally requesting one source pixel.
- [x] Changing crop, slot, or width changes the HMAC signature; unchanged input is
      deterministic. Responsive candidates preserve the crop and returned slot
      `sizes` match the locked CSS.
- [x] Existing `buildImgproxyUrl` / `buildSrcSet` behavior remains green.
- [x] Shared and API unit/typecheck commands pass.

## Ordering

Foundation checkpoint; the authorization/preview route and web crop editor consume it.

## Implementation

- Execution capability: inline direct-read implementation; the shared schema and one API utility formed a bounded contract.
- Review: not applicable — child-story checkpoint; effective review weight `standard` (project default) remains at feature scope.
- Files changed: `packages/shared/src/press.ts`, `packages/shared/tests/press.test.ts`, `apps/api/src/lib/imgproxy.ts`, `apps/api/tests/lib/imgproxy.test.ts`.
- Added focused schema and URL-builder tests for bounds, canonicalization, ratios, crop/focal-point encoding, full-axis sentinels, responsive descriptors, deterministic HMAC coverage, and existing builders.
- Verification: shared `23` files / `723` tests passed; API `123` files / `1967` tests passed; `apps/api` `npx tsc --noEmit` passed with zero errors.
- Simplification/discrepancies/adjacent issues: one shared slot registry and one signer path; none.
