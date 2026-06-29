---
id: gate-refactor-floating-search-promise
kind: story
stage: done
tags: [refactor, stylistic]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: refactor
created: 2026-06-29
updated: 2026-06-29
---

# Debounced content search promise is handled but not explicitly voided

## Source library
scan-stylistic — rule: no-floating-promises

## Severity
High

## Findings-route
refactor (behavior-preserving)

## Location
`apps/web/src/components/admin/content-search-picker.tsx:53`

## Evidence
```tsx
setIsLoading(true);
searchAvailableContent(channelId, query.trim(), controller.signal)
  .then((data) => {
    setResults(data.items);
```

## Remediation direction
Prefix the handled promise chain with `void` or wrap in an async helper invoked with `void`.

## Implementation (2026-06-29)
- Files changed: `apps/web/src/components/admin/content-search-picker.tsx`
- Tests added: none
- Verification: covered by bundle-final `bun run --filter @snc/web build` and `bun run --filter @snc/web test`
- Discrepancies from design: none; the existing handled `.then(...).catch(...)` chain was already localized in the debounce callback, so a `void` prefix was the smallest behavior-preserving fix.
- Adjacent issues parked: none

## Review (2026-06-29)

**Verdict**: Approve

**Notes**: Fast-lane (story with green verification). Implementation verified in the implement wave: full suite green (shared 682, api 1890, web 1807, web build). No blockers or important findings above nit.
