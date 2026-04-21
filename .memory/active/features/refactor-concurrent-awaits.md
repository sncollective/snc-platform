---
id: feature-refactor-concurrent-awaits
kind: feature
stage: implementing
tags: [refactor, stylistic]
release_binding: null
created: 2026-04-20
updated: 2026-04-20
related_decisions: []
related_designs: []
parent: null
---

Sequential `await` pairs for operations with no data dependency introduce unnecessary latency and obscure the independence relationship between operations. The fix — wrapping independent awaits in `Promise.all` — is mechanical once independence is confirmed, and makes the parallelism explicit to readers. Two confirmed sites exist; the sweep detector looks for the structural pattern more broadly.

## Pattern

Two or more sequential `await` expressions where neither result is consumed as input to the other before both are needed. Structural signal: `const a = await f(); const b = await g();` where `a` is not passed to `g()`, followed by code that uses both. Especially clear when one of the awaits precedes an existing `Promise.all` block.

## Detector

At sweep time, trace sequential awaits preceding `Promise.all` blocks and any function whose return value is awaited independently of the next call. The two confirmed sites below are the primary targets; a broader pass over `apps/api/src/routes/` and `apps/web/src/routes/` may surface additional sites.

## Representative sites

- `apps/api/src/routes/creator.routes.ts:119-129` — `batchGetSubscribedCreatorIds` awaited sequentially before an independent `Promise.all`; the two operations are independent and can be combined into a single `Promise.all`
- `apps/web/src/routes/governance/projects.tsx:43-65` — `fetchAllCreators()` and `loadProjects()` triggered in separate `useEffect` hooks; combining into a single effect with `Promise.all` removes the sequential trigger dependency and reduces render passes

## Notes

Confirm independence at each site before combining — verify that neither call consumes the result of the other and that no ordering invariant exists (e.g. auth checks that must precede data fetches). The `projects.tsx` site also has a `biome-ignore` for exhaustive deps at line 62 (tracked separately as a backlog item); the `Promise.all` refactor and the `useCallback` fix are independent and can land in either order.
