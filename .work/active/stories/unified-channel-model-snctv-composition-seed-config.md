---
id: unified-channel-model-snctv-composition-seed-config
kind: story
stage: drafting
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

## Implementation discovery (2026-06-18) — bounced to drafting

Grounding the seed surfaced a **design conflict in the editorial engine** that blocks this story as
scoped, and resolving it is an engine design decision (not an implementation-stride call). Bounced
`implementing → drafting` per the design-flaw escape hatch.

**The conflict**: `editorial-config.ts` `validateOwnershipConstraint` enforces, for platform-owned
channels, **`live` XOR `channel-as-source`** — "Admin channels may not have both 'live' and
'channel-as-source' tiers — they are mutually exclusive." But S/NC TV's config (this story's whole
purpose) requires **both**: a `live` tier (the broadcast creator takeover) AND a `channel-as-source`
tier (carry S/NC Classics as the fallback). `createEditorialTier` will reject the second of the two
with a `ValidationError`, so the seed cannot construct the broadcast config.

This is not a muscle-through case. The XOR constraint was a deliberate engine guard (an ordinary
admin playout channel shouldn't be confused — both a live-ingest target and a carrier). But the
**broadcast channel is precisely the one case the unified-channel-model designed to have both** —
the epic's thesis is that S/NC TV's `fallback([live, queue, default, blank])` "becomes the rule." So
the constraint needs a broadcast-role exemption, which is a change to the engine's validation
surface — an editorial-engine design decision, not a seed-script detail.

**Resolution direction (for the design pass that picks this up)**: exempt the `broadcast` role from
the `live`-XOR-`channel-as-source` rule (keep it for `playout`-role platform channels). This means
threading the channel `role` into `validateOwnershipConstraint` (called from both
`createEditorialTier` and `updateEditorialTier`) and adding a test for the broadcast exemption. The
operator preferred resolving this deliberately rather than relaxing a streaming-path validation
constraint inline.

**Scope note**: once the constraint is resolved, the rest of this story is unchanged — upsert the
broadcast config (`mode: auto`) + create the 3 tiers (live p0 / queue p1 / channel-as-source→Classics
p2), idempotent + backfill for existing deployments. The constraint fix is a prerequisite, likely
either a small `[refactor]`/engine story or folded into this story's redesign.

## Design reference
Feature body §Implementation Units / Unit 3.
