---
id: unified-channel-model-snctv-composition-seed-config
kind: story
stage: implementing
tags: [streaming, playout]
parent: unified-channel-model-snctv-composition
depends_on: [unified-channel-model-snctv-composition-topology]
release_binding: null
gate_origin: null
created: 2026-06-18
updated: 2026-06-18
---

# Seed S/NC TV's editorial config (the 3 tiers)

Make the broadcast channel's editorial config exist so the generated block reproduces today's
fallback order. Without this the broadcast channel renders config-less (queue-only default) — a
regression.

## Scope

**File**: `apps/api/src/scripts/seed-channels.ts` (calling the existing `editorial-config` service)

After `ensureBroadcast` (which already wires Classics as the default fallback), idempotently set the
broadcast channel's editorial config + tiers:
- `upsertEditorialConfig(broadcastId, { mode: "auto" })`
- `createEditorialTier(broadcastId, { tierType: "live", priority: 0 })`
- `createEditorialTier(broadcastId, { tierType: "queue", priority: 1 })`
- `createEditorialTier(broadcastId, { tierType: "channel-as-source", priority: 2, sourceChannelId: <classicsId> })`

The priority order reproduces `fallback([live_source, snc_tv_queue, default, blank])` under the
engine's auto-mode readiness fallback (the `blank` tail is the render's infallible `mksafe(blank())`,
always appended — not a seeded tier).

**Idempotency**: the seed must be safe to re-run. `createEditorialTier` enforces a unique
`(channelId, priority)` index, so a naive re-run would error on duplicate priorities. Guard it:
check for existing broadcast tiers first and skip/clear-and-recreate. Pick the simpler of:
(a) "config exists → skip tier creation," or (b) clear the broadcast channel's tiers then recreate.
Match whatever `ensurePlayout`/`ensureBroadcast` already do for idempotency.

**Backfill for existing deployments**: a live deployment already has the broadcast channel but NO
editorial config (it predates this feature). The seed path must backfill it on next run — name the
mechanism in this story (the idempotent upsert above runs on next `seed-channels`, OR a guarded
one-time backfill). Without backfill, an existing broadcast channel renders config-less after Unit 2
deletes the static block → queue-only regression.

## Acceptance criteria
- [ ] Fresh seed produces a broadcast channel whose generated `.liq` is output-equivalent to today's static block (matches the Unit-2 equivalence golden).
- [ ] Re-running the seed is idempotent — no duplicate tiers, no unique-index error.
- [ ] An existing (pre-config) broadcast channel gets its config backfilled — mechanism named + tested.
- [ ] Seed test asserts the 3 tiers exist in priority order with the correct `sourceChannelId` → Classics.

## Design reference
Feature body §Implementation Units / Unit 3.
