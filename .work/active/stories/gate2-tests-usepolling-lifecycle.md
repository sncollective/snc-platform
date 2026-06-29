---
id: gate2-tests-usepolling-lifecycle
kind: story
stage: implementing
tags: [testing]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: tests
created: 2026-06-29
updated: 2026-06-29
---

# usePolling hook required lifecycle behavior has no direct tests

## Priority
Critical

## Spec reference
Item: `refactor-use-polling-hook-extraction` / pattern `use-polling.md`
Acceptance criterion: "clears the pending timeout and avoids state updates after unmount", "Use initial", "Use key for dependency changes", stable refetch().

## Suggested test
`apps/web/tests/unit/hooks/use-polling.test.ts` — seeds initial data, refetches out-of-cycle, resets on key change, clears timeout on unmount (vi.useFakeTimers + renderHook).
