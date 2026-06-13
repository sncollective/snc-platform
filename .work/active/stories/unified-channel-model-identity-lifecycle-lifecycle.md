---
id: unified-channel-model-identity-lifecycle-lifecycle
kind: story
stage: implementing
tags: [streaming, playout]
parent: unified-channel-model-identity-lifecycle
depends_on: [unified-channel-model-identity-lifecycle-expand]
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
---

# Lifecycle: persistent creator channels + lazy provisioning

Retire the per-session temp-row fabrication. Creator channels become persistent rows,
lazily provisioned on stream-key creation and *activated* (not fabricated) on publish.
Depends on `expand` only (it needs the `ownership`/`role` columns); independent of
migrate/contract, so it can run in parallel with those once the columns exist.

## Scope

- `apps/api/src/services/channels.ts`:
  - New `ensureCreatorChannel(creatorId): Promise<Result<{ channelId }, AppError>>` —
    idempotent; creates a persistent row (`ownership: 'creator', role: 'live-ingest'`,
    `isActive: false`) if the creator has none, else returns the existing one.
  - Retire `createLiveChannel`'s fabricate-or-reactivate dance: the on_publish path
    activates the creator's existing persistent channel (set `isActive`, `streamSessionId`)
    and NEVER inserts a temp row.
  - on_unpublish path **deactivates** (`isActive: false`), never deletes.
- `apps/api/src/services/stream-keys.ts` — call `ensureCreatorChannel(creatorId)` when a
  creator creates their first stream key (the lazy-provisioning trigger for this feature).
- on_publish / on_unpublish wiring in `apps/api/src/services/stream-lifecycle.ts`
  (+ `streaming.routes.ts` callers) — activate/deactivate the persistent channel.
- `apps/api/src/services/seed-channels.ts` + `SNC_TV_BROADCAST` (services/channels.ts) —
  seeded identity rows carry explicit `ownership`/`role` (`platform`/`broadcast` for S/NC TV,
  `platform`/`playout` for Classics). Takes the constant ownership the topology refactor deferred.
- **Chat-room continuity**: ensure the channel room once at provisioning (`ensureChannelRoom`),
  reuse across sessions; on_unpublish closes the *session*, not the room.
- **Dedupe**: reconcile any duplicate temp `live-ingest` rows per creator left by the
  expand backfill (old temp fabrications) down to one persistent channel.

## Acceptance criteria

- [ ] Creating a stream key provisions exactly one persistent creator channel (`ownership='creator', role='live-ingest'`).
- [ ] A creator who publishes → unpublishes → publishes reuses the SAME channel row (no temp-row churn) — integration test.
- [ ] on_unpublish deactivates without deleting; the chat room survives across sessions.
- [ ] Seed rows + `SNC_TV_BROADCAST` carry explicit `ownership`/`role`.
- [ ] Backfill-left duplicate temp rows per creator are deduped to one (dedupe assertion).
- [ ] `createLiveChannel` temp-fabrication path is gone; existing streaming route tests green (updated for activate-not-fabricate).

## Notes

This is the behavior-bearing story of the feature (the others are migration mechanics).
The publish→unpublish→publish reuse test is the core proof that temp-row churn is gone.
Coordinate with `stream-lifecycle.ts` (landed by refactor-streaming-lifecycle-service-extraction):
`ensureLiveChannelWithChat` / `teardownLiveChannel` are the functions this story rewrites
from fabricate/delete to activate/deactivate.
