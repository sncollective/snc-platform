---
id: unified-channel-model-creator-content-playable-transitions
kind: story
stage: done
tags: [streaming, playout]
parent: unified-channel-model-creator-content-playable
depends_on: [unified-channel-model-creator-content-playable-schema]
release_binding: 0.4.0
gate_origin: null
created: 2026-06-24
updated: 2026-06-24
---

# Make the queue transitions source-polymorphic

Unit 2 of `unified-channel-model-creator-content-playable`. Depends on the schema widening.

## Scope
**File**: `apps/api/src/services/playout-queue-transitions.ts`.

`enqueue`, `enqueueBatch` (and the `markPlayed`/`promoteNext` paths as needed) currently take
`playoutItemId: string`. Change the source param to a discriminated union and write the correct
column:

```ts
type QueueSource = { playoutItemId: string } | { contentId: string };
// enqueue({ channelId, source: QueueSource, position? })
// enqueueBatch(channelId, sources: QueueSource[])
```

Insert `playoutItemId` OR `contentId` per the source — the DB CHECK (Unit 1) enforces exactly-one.
The five `eventBus.publish` callsites and the `content.playout-changed` creator-scoping (already
landed in api-gate) are unchanged.

## Acceptance
- [x] `enqueue` / `enqueueBatch` accept a content source and write a `content_id` row with `playout_item_id` null.
- [x] The admin playout-item path is unchanged (writes `playout_item_id`, `content_id` null).
- [x] The CHECK is never violated by any transition.
- [x] Existing transition unit tests stay green; new tests cover the content-source branch.

## Implementation notes

**File**: `apps/api/src/services/playout-queue-transitions.ts`.

Made the birth transitions (`enqueue`, `enqueueBatch`) source-polymorphic via a discriminated
union. `markPlayed` / `promoteNext` / `removeQueued` were untouched — they flip status on an
existing row and never name a source column.

- **New exported type** (alongside `QueueRow`):
  ```ts
  export type QueueSource = { playoutItemId: string } | { contentId: string };
  ```
- **New private helper** `sourceColumns(source)` returns `{ playoutItemId }` *or* `{ contentId }`
  — the one-key column subset. Spread into the INSERT `.values({...})`, so the unset column is
  omitted from the object. Drizzle maps an omitted column to NULL, which is exactly what the
  `playout_queue_one_source` CHECK (`num_nonnulls(playout_item_id, content_id) = 1`) requires.
  The discriminated union guarantees exactly one branch fires, so exactly one column is ever set.
- **Changed signatures**:
  - `enqueue(opts: { channelId: string; source: QueueSource; position?: number })` (was
    `playoutItemId: string`). All position-shift logic, MAX(position) read, event publishes, and
    return shape are byte-identical to before.
  - `enqueueBatch(channelId: string, sources: QueueSource[])` (was `playoutItemIds: string[]`).
    Maps each source through `sourceColumns`; the MAX read, consecutive-position assignment,
    empty-array guard, publishes, and `count` return are unchanged.

**Tests** (`apps/api/tests/services/playout-queue-transitions.test.ts`): migrated all existing
`enqueue` / `enqueueBatch` call sites to the new `source` shape (`{ playoutItemId: "..." }` /
`[{ playoutItemId: "..." }]`); added `contentId: {}` to the mocked schema object for parity with
the real schema. Added two new tests:
  - `enqueue` content source → asserts `contentId` is set and `playoutItemId` is absent (omitted →
    NULL column), proving the exactly-one CHECK is satisfiable from the content branch.
  - `enqueueBatch` content sources → asserts each row sets only `contentId`, no `playoutItemId` key.

**Verification**:
- `bun run --filter @snc/api test:unit -- tests/services/playout-queue-transitions.test.ts` →
  41 passed (39 prior + 2 new).
- `tsc --noEmit` on the api package: the transitions source file and its test file are both
  type-clean. The only remaining errors (8) are in `playout-orchestrator.ts` — the old call sites
  (`enqueue({ ..., playoutItemId })` line 436, `enqueueBatch(ch, string[])` line 829) plus the
  pre-existing schema-widening fallout from story 1 (nullable `playoutItemId` + new `contentId`
  field in the `PlayoutQueueEntry` mapping). **All 8 are story 3's (reads) job, as the brief
  specified** — not edited here.

**Design note**: the discriminated-union + spread-to-omit approach worked cleanly; no design-flaw
escape hatch needed. Drizzle omitting an absent key to a NULL column is the standard behavior and
keeps the call sites declarative (`source: { contentId }`) with no nulls passed explicitly.

## Review (2026-06-25)

**Verdict**: Approve — advanced to done. Cross-model peer-review loop converged at pass 3 (Codex SAFE on the full B1+B2+B3 fix set). Code complete + verified (typecheck clean; API unit 1866 + cross-tenant integration 13 green).
