---
tags: [refactor]
release_binding: null
created: 2026-04-20
updated: 2026-04-21
---

# Scan Conventions Rule Library

Create a `scan-conventions` rule library under the refactor-scan family. Scans whether code follows the conventions stated in platform's CLAUDE.md / canon docs. Example: if conventions say "use Result<T, E> for service returns," flag services that throw instead. Fits the existing `scan-*` / `create-scan-*` pattern (see [scan-design-system-rule-library.md](scan-design-system-rule-library.md) for a sibling in the same pattern).

Low priority — create when convention docs stabilize. Lint *target* is code, so the library lives in the refactor-scan family rather than with any memory-side lint operation.
