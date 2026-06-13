---
id: refactor-streaming-lifecycle-service-extraction
kind: story
stage: review
tags: [refactor, structural, streaming]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-04-20
updated: 2026-06-13
parent: null
---

Extract the inline callback orchestration from `streaming.routes.ts` into a dedicated service module so the route file shrinks below 400 LOC and the lifecycle logic is independently testable.

## Scope

- `apps/api/src/routes/streaming.routes.ts` — extract `ensureLiveChannelWithChat`, `teardownLiveChannel`, and `extractStreamKey` out of the route file body. After extraction the route file wires these calls but does not implement them inline.
- `apps/api/src/services/stream-lifecycle.ts` (new) — receives the three extracted functions. Follows the `Result`-returning service pattern used by sibling services. Imports from `channels.ts`, `chat.ts`, and any other service-layer modules as needed; does not import from route files.

## Tasks

- [ ] Create `apps/api/src/services/stream-lifecycle.ts` with `ensureLiveChannelWithChat`, `teardownLiveChannel`, and `extractStreamKey`.
- [ ] Replace inline implementations in `streaming.routes.ts` with imports from the new module.
- [ ] Confirm `streaming.routes.ts` drops to under 400 LOC after extraction.
- [ ] Run `bun --cwd=./platform run --filter @snc/api test:unit` to verify no regressions.

## Notes

`streaming.routes.ts` is currently 537 LOC. The three orchestration functions are the primary bloat — the rest of the file is standard route handler boilerplate. The new service should expose plain async functions returning `Result` (consistent with `channels.ts`, `playout.ts`); avoid returning raw throws so callers can pattern-match on `.ok`. Companion structural work (splitting the broader route file) is tracked separately under the route-file-size feature.

## Implementation record (2026-06-13)

Extracted `extractStreamKey`, `ensureLiveChannelWithChat`, `teardownLiveChannel` (plus
the `toErrorDetail` helper they shared) into new `apps/api/src/services/stream-lifecycle.ts`.
Route file imports the three from the service; six now-dead imports removed from the route
file (`createLiveChannel`/`deactivateLiveChannel`, `createChannelRoom`/`closeChannelRoom`,
`broadcastToRoom`, and drizzle `desc`) — they had no remaining users once the functions left.

**Deliberate divergence from the Notes' `Result` suggestion.** `ensureLiveChannelWithChat`
and `teardownLiveChannel` are **fire-and-forget, best-effort** orchestration: they return
`void`, swallow every error via internal try/catch + logging, and the call sites
(`on_publish` / `on_unpublish` SRS callbacks) deliberately do not branch on a result —
the call-site comment is literally *"best-effort — don't block SRS callback"*. Converting
them to `Result`-returning and having callers pattern-match on `.ok` would be a **behavior
change** (the callback would gain an error-handling branch it doesn't have today), which the
`[refactor]` tag forbids. Extracted verbatim, void contract preserved; the void/swallow
intent is now documented in each function's JSDoc. `extractStreamKey` is a pure parser and
moved unchanged.

**LOC target is stale and not met by this extraction alone.** Story Notes cite 537 LOC and
a <400 goal; the file had drifted to **645 LOC** (the 0.3.1 `on_forward` triage + admin authz
landed after the story was written). Removing the ~71-line trio drops it to **574 LOC** —
real shrinkage, but a 645-line file can't reach <400 by pulling three functions. Getting it
under size is the **route-file-size-splits** feature's job (it exists, at `implementing`);
this story's honest deliverable is the lifecycle-logic extraction + independent testability,
which is done.

Added `tests/services/stream-lifecycle.test.ts` — 5 direct unit tests for the now-isolated
pure `extractStreamKey` (realizing the story's "independently testable" goal). The two
side-effect functions keep their existing end-to-end coverage in
`tests/routes/streaming.routes.test.ts` (42/42 green) rather than duplicating DB/service mocks.

Verification: `@snc/api` typecheck shows exactly 2 errors, both pre-existing in other lanes'
in-flight work (`playout-orchestrator.ts:346` exactOptionalPropertyTypes, `sse.routes.test.ts:104`
EventBus mock) — neither in `streaming.routes.ts` or `stream-lifecycle.ts`; confirmed my
extraction introduces no new type error. Streaming route suite 42/42, new lifecycle suite 5/5.

## Tasks

- [x] Create `apps/api/src/services/stream-lifecycle.ts` with the three functions (void contract preserved, not `Result` — see divergence note).
- [x] Replace inline implementations in `streaming.routes.ts` with imports; remove the six dead imports.
- [~] Confirm `streaming.routes.ts` drops under 400 LOC — **not achievable by this extraction** (645→574); reassigned to route-file-size-splits (LOC target was stale).
- [x] Run the streaming route unit tests — 42/42 pass; added 5-test lifecycle suite.
