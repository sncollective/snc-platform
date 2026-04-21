---
id: story-refactor-use-polling-hook-extraction
kind: story
stage: implementing
tags: [refactor, quality]
release_binding: null
created: 2026-04-20
updated: 2026-04-20
related_decisions: []
related_designs: []
parent: null
---

Extract the duplicated `mountedRef` + recursive `setTimeout` polling pattern from two route components into a shared `usePolling<T>` hook.

## Scope

- `apps/web/src/routes/admin/playout.tsx` lines 53–89 — first polling implementation.
- `apps/web/src/routes/live.tsx` lines 94–129 — near-identical second implementation.
- `apps/web/src/hooks/use-polling.ts` (new) — the extracted hook. Signature: `usePolling<T>(fetcher: () => Promise<T>, intervalMs: number): T | undefined` (or similar; match the actual return shape needed by both call sites). The hook manages `mountedRef` teardown, error swallowing or surfacing, and the recursive timer internally.

## Tasks

- [ ] Create `apps/web/src/hooks/use-polling.ts` with a generic `usePolling<T>` hook capturing the shared pattern.
- [ ] Replace the inline polling block in `admin/playout.tsx` with a `usePolling` call.
- [ ] Replace the inline polling block in `live.tsx` with a `usePolling` call.
- [ ] Confirm both components render and tear down correctly; run `bun --cwd=./platform run --filter @snc/web test:unit`.

## Notes

Read both call sites before settling on the hook's API — the two implementations may differ slightly (error handling, initial state, return shape). The hook should accommodate both without leaking either site's specifics into its interface. If the two sites diverge enough that a shared abstraction would be awkward, document the divergence and close the story as "pattern diverged — not extracted"; but based on the board description they are described as identical.
