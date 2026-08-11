---
id: drop-image-size-magicbyte-header-dims-detector
kind: story
stage: done
tags: [security, media-pipeline, content]
parent: drop-image-size-magicbyte-header-dims
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-11
updated: 2026-08-11
---

# Build the allowlisted image header detector

Implement `apps/api/src/lib/image-detect.ts` as the single public boundary for
jpg/png/webp magic-byte classification and owned header dimension reads. Magic
classification must complete before format-specific parsing; any other signature
returns `null`. Recognized but malformed/truncated headers retain their format and
return null dimensions.

## Acceptance evidence

- Unit fixtures report exact dimensions for PNG, JPG SOF, WebP VP8, VP8L, and
  VP8X headers.
- Crafted ICNS, JXL, HEIF, and arbitrary signatures are rejected at the magic
  boundary.
- JPG reads are bounds-checked, monotonic, and capped at
  `MAX_FILE_SIZES.image`; truncated and invalid-length marker streams terminate
  without throwing or hanging.

## Ordering

This checkpoint has no sibling dependency. Library ingest and press PDF rewiring
consume its exported contract.

## Implementation notes

- Execution capability: cohesive inline implementation; the detector is one
  isolated pure module with exact binary fixtures.
- Files changed: `apps/api/src/lib/image-detect.ts`,
  `apps/api/tests/lib/image-detect.test.ts`.
- Tests added: seven detector tests covering PNG/JPG, all WebP header variants,
  early allowlist rejection, malformed/truncated metadata, and the 10 MiB JPG
  scan cap.
- Verification: targeted Vitest passed (1 file, 7 tests); API typecheck passed.
- Simplification: one closed public detector boundary; no format registry or
  separately callable parsers.
- Discrepancies from design: none.
- Adjacent issues parked: none.
