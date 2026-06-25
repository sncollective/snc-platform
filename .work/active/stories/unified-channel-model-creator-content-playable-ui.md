---
id: unified-channel-model-creator-content-playable-ui
kind: story
stage: review
tags: [streaming, playout]
parent: unified-channel-model-creator-content-playable
depends_on: [unified-channel-model-creator-content-playable-reads, unified-channel-model-creator-content-playable-transitions]
release_binding: null
gate_origin: null
created: 2026-06-24
updated: 2026-06-25
---

# Unblock the manual-queue UI for creator content

Unit 4 of `unified-channel-model-creator-content-playable`. Depends on the backend reads + transitions.

## Scope
**Files**: `apps/web/src/components/playout/editorial-surface.tsx`,
`apps/web/src/components/admin/pool-item-picker.tsx`, the creator playout insert route
(`apps/api/src/routes/creator-playout.routes.ts`) + admin equivalent + the web client lib.

- `pool-item-picker.tsx:66`: drop the `sourceType === "playout"` filter — content is now queueable.
- `editorial-surface.tsx` `handlePlayNext` (~line 220): stop early-returning on `!item.playoutItemId`;
  send the right source (`contentId` for content rows, `playoutItemId` for playout rows).
- Insert route validators (creator + admin): accept a discriminated `{ playoutItemId } | { contentId }`
  body; thread the source through to `orchestrator.insertIntoQueue`.

## Acceptance
- [ ] A creator selects their own pooled content in the queue picker and "play next" works.
- [ ] Admin can still queue playout items unchanged.
- [ ] **AC#5 live fix-verify** (the deferred one): user confirms a creator driving their own queue
      with their own content in the running app. Closes the deferred fix-verify for the whole
      creator-enablement arc.

## Implementation notes

Land of Unit 4 (the UI/route surface) on top of the now-committed source-polymorphic backend
(schema + transitions + reads stories). The backend already accepts a discriminated
`QueueSource` and scope-gates creator sources to the channel's pool; this story makes the UI and
the route validators speak the same shape end to end.

### Files changed
- `packages/shared/src/playout-queue.ts` — added a discriminated `QueueInsertSource` type
  (`{ playoutItemId: string } | { contentId: string }`) mirroring the API service-layer
  `QueueSource`, so the web client + route callers share one canonical source shape. (The
  existing loose `InsertQueueSourceSchema` stays the wire-validation schema.) `@snc/shared`
  resolves from `src/` via tsconfig `paths` (no build step — there is no `build` script on the
  package, so the AGENTS.md `build-shared` command is a no-op for it; the source edit is directly
  visible to typecheck and tests).
- `apps/web/src/components/admin/pool-item-picker.tsx` — dropped the
  `sourceType === "playout"` filter; both source types are now selectable. Source badge is
  per-row (`Content` vs `Playout`). Stale empty-state copy ("Only playout-uploaded items can be
  queued…") replaced with a neutral "No items in pool" message.
- `apps/web/src/components/playout/editorial-surface.tsx` — `handlePlayNext` no longer
  early-returns on a content row; it builds the matching discriminated source
  (`{ playoutItemId }` for a playout row, `{ contentId }` for a content row) from the pool item
  and passes it to `insertQueueItem`. A malformed row (neither id set) is still skipped.
- `apps/web/src/components/playout/editorial-api.tsx` — `EditorialApi.insertQueueItem` signature
  now takes `QueueInsertSource` instead of a bare `playoutItemId: string`.
- `apps/web/src/lib/playout-channels.ts` + `apps/web/src/lib/creator-playout-channels.ts` —
  `insertQueueItem(channelId, source, position?)`; posts `{ ...source, position }` (admin +
  creator scopes).
- `apps/api/src/routes/creator-playout.routes.ts` + `apps/api/src/routes/playout-channels.routes.ts`
  — queue-insert validators switched from the playout-only inline `z.object` to the shared
  `InsertQueueSourceSchema`; the handler splits `position` off the validated body and threads the
  discriminated source through to `orchestrator.insertIntoQueue` (the schema's exactly-one-of
  refine guarantees precisely one source is set, so `{ contentId: contentId! }` is sound on the
  non-playout branch).

### Tests added / updated
- `apps/api/tests/routes/creator-playout.routes.test.ts` — added: content-source insert (201,
  threads `{ contentId }`), both-sources-set rejected (400, orchestrator not called),
  neither-set rejected (400). Existing playout-source + position cases unchanged.
- `apps/api/tests/routes/playout-channels.routes.test.ts` — same three additions on the admin
  route (admin can queue a content row too; both-set/neither-set rejected by the validator).
- `apps/web/tests/unit/components/admin/pool-item-picker.test.tsx` — rewrote the obsolete
  "content filtered out" / "only playout queueable" empty-state tests to assert content rows are
  now listed + carry a Content badge; added a mixed-pool content-selection case; updated the
  empty-pool copy assertions.
- `apps/web/tests/unit/components/playout/editorial-surface.test.tsx` — updated the playout
  play-next assertion to the new `{ playoutItemId }` source shape; added a content play-next case
  proving a content pool row fires `insertQueueItem(channelId, { contentId }, 1)`.
- `apps/web/tests/unit/lib/creator-playout-channels.test.ts` — updated the `insertQueueItem`
  signature call; added a content-source body-shape case (`{ contentId }`, position omitted).

### New `insertQueueItem` client signature
```ts
insertQueueItem(channelId: string, source: QueueInsertSource, position?: number): Promise<PlayoutQueueEntry>
// QueueInsertSource = { playoutItemId: string } | { contentId: string }
// body posted: { ...source, position }   // position: undefined is dropped by JSON.stringify
```

### Discrepancies from design
- The design said "the insert API route + client take a discriminated source." The committed
  backend's `orchestrator.insertIntoQueue(channelId, source, position)` keeps `position` as a
  separate 3rd arg, while the shared `InsertQueueSourceSchema` folds `position` into the wire
  body. Reconciled by having the route destructure `position` out of the validated body and pass
  a clean `QueueSource` (`{ playoutItemId }` XOR `{ contentId }`) to the orchestrator. No behavior
  change — just where `position` is carried.
- Added `QueueInsertSource` to `@snc/shared` rather than reusing the inferred `InsertQueueSource`
  type: the inferred type is the loose validated shape (`{ playoutItemId?, contentId?, position? }`),
  which would not give the client a tight discriminated parameter. `QueueInsertSource` is the
  exact client-facing source type.

### Verification (all green)
- `bun run --filter @snc/api typecheck` → clean (exit 0)
- `bun run --filter @snc/web typecheck` → clean (exit 0)
- `bun run --filter @snc/api test:unit` → 1866 passed (115 files)
- `bun run --filter @snc/web test` → 1801 passed (168 files)
- (`@snc/shared` has no build script; it resolves from source via tsconfig paths, so no rebuild
  was needed.)

### Adjacent issues parked
None.

## Live fix-verify needed (AC#5)

This is the deferred AC#5 — a USER step in the running app that an agent cannot perform. It
closes the deferred fix-verify for the whole `unified-channel-model-creator-enablement` arc, not
just this story. Steps for the user:

1. Log in as a creator account that has `manageStreaming` on its own creator-owned channel.
2. Open the creator Programming tab for that channel.
3. In the Content Pool, assign one of the creator's OWN content pieces to the pool (via
   "+ Add Content" → search → select). Confirm it appears in the pool table.
4. Open the Queue's "+ Add to Queue" picker. Confirm the just-assigned creator content now
   appears as a selectable option with a "Content" badge (before this fix it was filtered out and
   could not be queued).
5. Select that content item to "play next." Confirm:
   - no error banner appears (before the backend widening this hit a ForbiddenError /
     FK-violation path),
   - the item lands in the upcoming queue, and
   - it actually plays through the creator's channel when it reaches the front of the queue
     (renders via Liquidsoap over the URI pool-next path).
6. Sanity check isolation is intact: the picker/search must NOT offer another creator's content
   or platform playout-library items for a creator channel.

If all of the above hold, AC#5 is satisfied and the creator-enablement arc's deferred
fix-verify closes.
