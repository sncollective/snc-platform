---
id: drop-image-size-magicbyte-header-dims-remove-dependency
kind: story
stage: done
tags: [security, media-pipeline, content]
parent: drop-image-size-magicbyte-header-dims
depends_on: [drop-image-size-magicbyte-header-dims-library-ingest, drop-image-size-magicbyte-header-dims-press-pdf]
release_binding: null
gate_origin: null
created: 2026-08-11
updated: 2026-08-11
---

# Remove image-size from the dependency surface

After both production call sites use the owned detector, remove `image-size`
from `apps/api/package.json` and `bun.lock`, delete the obsolete
`.claude/skills/image-size/SKILL.md`, and replace its remaining integration-test
and source-comment references. Preserve the already-resolved root nanoid
resolution exactly.

## Acceptance evidence

- Repository and dependency-tree searches contain no `image-size` reference.
- The migration integration test validates rendered dimensions with the owned
  detector.
- `bun audit` drops both image-size high advisories and reports only the known
  TanStack moderate and Babel low findings; nanoid remains at the resolution.

## Ordering

Depends on both call-site rewiring checkpoints. Removing the package before those
compile-time consumers move would create a knowingly broken intermediate state.

## Implementation notes

- Execution capability: cohesive inline dependency cleanup after both production
  call sites moved.
- Files changed: `apps/api/package.json`, `bun.lock`,
  `apps/api/tests/integration/content-library-migration.test.ts`,
  `packages/shared/src/content-library.ts`; deleted
  `.claude/skills/image-size/SKILL.md`.
- Tests changed: migration integration now validates imgproxy output through the
  owned detector (targeted run passed: 1 file, 2 tests).
- Verification: targeted affected units passed (3 files, 23 tests), API typecheck
  passed, source/package/lock searches are clear, and `bun why image-size`
  reports no matching lockfile package.
- Audit evidence: before removal 4 vulnerabilities (2 image-size high, 1
  TanStack moderate, 1 Babel low); after removal 2 vulnerabilities (1 moderate,
  1 low). The audit command exits 1 because those two known findings remain.
- Nanoid preservation: root resolution remains `^5.1.16` and `bun.lock` resolves
  `nanoid@5.1.16`.
- Simplification: removed the runtime dependency, lockfile node, reference skill,
  test import, and stale shared-source attribution.
- Discrepancies from design: none.
- Adjacent issues parked: none.
