---
id: drop-image-size-magicbyte-header-dims-press-pdf
kind: story
stage: done
tags: [security, media-pipeline, content]
parent: drop-image-size-magicbyte-header-dims
depends_on: [drop-image-size-magicbyte-header-dims-detector]
release_binding: null
gate_origin: null
created: 2026-08-11
updated: 2026-08-11
---

# Use stored library dimensions in press PDF rendering

Change `apps/api/src/services/press-pdf.ts` so library keys load positive
width/height from `content_blobs` without downloading immutable image bytes.
Legacy owned press keys remain compatible by downloading at most
`MAX_FILE_SIZES.image` and passing those bytes through the owned detector. Any
missing or malformed dimensions stay inside the existing warning-and-omit
boundary.

## Acceptance evidence

- A library key uses its database dimensions and never downloads the blob.
- A legacy key downloads and derives dimensions through `detectImage()`.
- Oversized, missing, truncated, or malformed metadata omits the image rather
  than guessing or throwing out of PDF rendering.

## Ordering

Depends on `drop-image-size-magicbyte-header-dims-detector`; it can proceed
independently of library-ingest rewiring once that detector contract is done.

## Implementation notes

- Execution capability: cohesive inline integration at the press renderer's
  existing validation seam.
- Files changed: `apps/api/src/services/press-pdf.ts`,
  `apps/api/tests/services/press-pdf.test.ts`.
- Tests changed: press PDF units now prove legacy keys download without a DB
  lookup and library keys use stored `content_blobs` dimensions without a blob
  download; real integration covers both key classes.
- Verification: targeted detector/press unit tests passed (2 files, 14 tests),
  API typecheck passed, and targeted library/press integration passed (1 file,
  9 tests).
- Simplification: removed the redundant library-blob parse; legacy streaming is
  capped at 10 MiB and shares the owned detector.
- Discrepancies from design: none.
- Adjacent issues parked: none.
