---
id: feature-refactor-error-extraction-helper
kind: feature
stage: implementing
tags: [refactor, quality]
release_binding: null
created: 2026-04-20
updated: 2026-04-20
related_decisions: []
related_designs: []
parent: null
---

The pattern `e instanceof Error ? e.message : "Failed to <action>"` appears 20+ times across route handler catch blocks. Each site reinvents the same defensive check with a locally-varied fallback string. This makes the fallback messages inconsistent in phrasing, forces reviewers to verify correctness at every call site, and couples error-handling boilerplate to business logic. A single `extractErrorMessage(e, fallback)` utility centralizes the pattern and makes the intent explicit at each call site.

## Pattern

Inline `instanceof Error` ternary used to coerce a caught unknown value to a string. Every site in `apps/api/src/routes/` follows the same structure; only the fallback string differs. Replacing with a named helper makes each call site one line and the fallback string the only variable.

## Detector

```
grep -r "e instanceof Error ?" apps/api/src/routes/
```

Expected to match 20+ lines across route files. After the helper is extracted, the grep becomes a zero-tolerance lint signal — any new match after the sweep is a regression.

## Representative sites

- `apps/api/src/routes/` — the grep above will enumerate all 20+ sites; no single file dominates, the pattern is distributed across most route files in the directory.

## Notes

Likely home for the helper: `apps/api/src/lib/errors.ts` if that file exists, otherwise a new zero-dep module alongside existing lib utilities. The helper signature is `extractErrorMessage(e: unknown, fallback: string): string`. After extraction, confirm no call sites in middleware or services were missed by the route-scoped grep — run a broader sweep across `apps/api/src/` to catch any outside `routes/`.
