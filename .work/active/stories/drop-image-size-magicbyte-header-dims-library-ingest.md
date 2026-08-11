---
id: drop-image-size-magicbyte-header-dims-library-ingest
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

# Rewire content-library ingest to the owned detector

Replace the service-local `imageSize()` path in
`apps/api/src/services/library.ts` with `detectImage()`. Use its one result for
format-derived extension/MIME and nullable dimensions before sha256 keying,
storage, and blob persistence. Keep upload size checks, content-addressed key
shape, dedup behavior, ordering, and API responses unchanged.

## Acceptance evidence

- Relabeled PNG bytes still produce the canonical `.png` key and `image/png`.
- The `content_blobs` insert/update receives the detector's exact dimensions.
- Unsupported magic returns the existing validation error before database or
  storage work.
- Real integration ingest persists and returns the same dimensions.

## Ordering

Depends on `drop-image-size-magicbyte-header-dims-detector` so the shared
contract is verified before service wiring.

## Implementation notes

- Execution capability: cohesive inline service rewiring against the verified
  detector contract.
- Files changed: `apps/api/src/services/library.ts`,
  `apps/api/tests/services/library.test.ts`,
  `apps/api/tests/integration/library.test.ts`.
- Tests changed: the service test now proves the blob write receives `1x1`
  detector dimensions; the real Garage/Postgres integration asserts the same
  dimensions on the returned persisted asset.
- Verification: targeted detector/library unit tests passed (2 files, 16 tests),
  API typecheck passed, and targeted library integration passed (1 file, 9
  tests).
- Simplification: removed the service-local parser wrapper and its try/catch;
  extension, MIME, and dimensions now come from one detector result.
- Discrepancies from design: none.
- Adjacent issues parked: none.
