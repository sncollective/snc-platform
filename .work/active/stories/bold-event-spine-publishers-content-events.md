---
id: bold-event-spine-publishers-content-events
kind: story
stage: done
tags: [streaming, media]
release_binding: null
depends_on: [bold-event-spine-publishers-queue-events]
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: bold-event-spine-publishers
---

# Content processing publisher + scope filter

Unit 3 of the parent feature design (incl. the chokepoint + team-aware filter
rationale).

## Scope

- Shared union: `content.processing-status-changed {contentId, creatorId, status}`
  (hint payload — client re-fetches).
- `updateContentProcessing`: publish only when `updates.processingStatus` is present,
  using `.returning({creatorId, processingStatus})` on the same UPDATE. Playout-item
  processing (`playout-ingest.ts`) is out of scope.
- `SubscriberContext` gains `creatorIds: string[]`; SSE route fills it at connect via
  one `creator_members` query (skipped when the `content` topic isn't granted).
- Registry entry: topic `content`, coalesce `contentId`, scopeFilter admin-or-member —
  this discharges the registry fence the endpoint feature established.

## Acceptance criteria

- [x] Status-bearing update publishes; codec-only update does NOT.
- [x] scopeFilter matrix: member sees own-creator events, not others'; admin sees all;
      anon never granted `content`.
- [x] Existing event-bus + sse.routes tests green (additive ctx extension).

## Implementation notes (2026-06-13)

**Files changed:**
- `packages/shared/src/events.ts` — `ContentProcessingStatusChangedSchema` + union extension
- `apps/api/src/services/event-bus.ts` — `SubscriberContext.creatorIds: string[]`; registry entry for `content.processing-status-changed` with admin-or-member scopeFilter
- `apps/api/src/services/processing-jobs.ts` — eventBus import; `updateContentProcessing` publishes when `processingStatus` present using `.returning({creatorId, processingStatus})`; codec-only path unchanged
- `apps/api/src/routes/sse.routes.ts` — `db`/`creatorMembers` imports; `creatorIds` query at connect when `content` granted + user present; passed into `ctx`
- `apps/api/tests/services/event-bus.test.ts` — `creatorIds: []` added to existing ctx fixtures; 4 new scopeFilter matrix tests
- `apps/api/tests/services/processing-jobs.test.ts` — 3 new `updateContentProcessing` tests (publishes/not-publishes/fire-and-forget)
- `apps/api/tests/routes/sse.routes.test.ts` — `db`/`creatorMembers` mock added to `buildTestApp`

**Test results:**
- event-bus.test.ts: 18 tests ✓ (was 14, +4 scopeFilter matrix tests)
- processing-jobs.test.ts: 14 tests ✓ (was 11, +3 new)
- sse.routes.test.ts: 15 tests ✓ unchanged (mock extension only)
- Full API suite: 1595 passed; 14 fails in local-storage.test.ts (pre-existing sandbox `/tmp` restriction)

## Review (2026-06-14)
**Verdict**: Approve — fast-lane: green unit verification (scopeFilter matrix; status-only publish, codec-only no-publish).
