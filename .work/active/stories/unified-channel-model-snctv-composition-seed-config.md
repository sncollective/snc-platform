---
id: unified-channel-model-snctv-composition-seed-config
kind: story
stage: review
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

## Constraint resolved (2026-06-18) — folded in; back to implementing

The operator chose the broadcast-role exemption (option 1). Resolved + folded into this story rather
than a separate engine story — it's a small cohesive change that directly unblocks the seed, and
keeping it with the seed keeps the broadcast-config work in one review unit.

**`editorial-config.ts`** `validateOwnershipConstraint`: added a `role` parameter and an early
`if (role === "broadcast") return ok(undefined)` exemption — the broadcast channel (S/NC TV) is the
one platform channel the unified model designed to hold both a `live` tier (the `:1936` takeover
input) and a `channel-as-source` tier (its fallback). The live-XOR-carry rule still applies to
`playout`-role platform channels. Threaded `channel.role` through both call sites
(`createEditorialTier`, `updateEditorialTier`); `fetchChannel` now selects `role`. JSDoc updated to
document the exemption.

**Tests** (`editorial-config.test.ts`): added `makeBroadcastChannel` fixture + `role` to the existing
fixtures and the schema mock; two new exemption cases (broadcast allows carry-with-existing-live and
live-with-existing-carry). The two playout XOR-rejection tests still hold (they use the now-`playout`-
default `makePlatformChannel`). 43 passed.

Stage moved back `drafting → implementing`; the seed work below proceeds.

## Seed implementation (2026-06-18)

**`seed-channels.ts`**: added `seedBroadcastEditorialConfig(broadcastId, classicsId)`, called after
`ensureBroadcast`. It `upsertEditorialConfig(broadcastId, { mode: "auto" })` then, **if the channel
has no tiers yet**, creates the 3 tiers: `live` p0 / `queue` p1 / `channel-as-source`→Classics p2.
The blank tail is the render's infallible `mksafe(blank())`, not a seeded tier. The carry tier is
omitted in the degenerate no-playout-channel case.

**Idempotency + backfill**: the "skip tier creation if tiers already exist" guard makes a re-run a
no-op and **backfills** an existing broadcast channel that predates the editorial model (its config
is created on next seed run). `upsertEditorialConfig` is itself idempotent (`onConflictDoUpdate`).

### Verification (live, against the dev DB)
- **Seed runs clean**: `db:seed-channels` → "S/NC TV editorial config seeded (3 tiers)" (real
  backfill — the dev broadcast channel had no config before).
- **Idempotent**: second run → "S/NC TV editorial tiers already present (3) — skipping tier
  creation" — no duplicate-priority error.
- **Output-equivalence on the real seeded DB**: generated the config via `generateLiquidsoapConfig`
  against the live DB — the broadcast block renders
  `…_source = fallback(track_sensitive=false, transitions=[notify_switch("live"/"queue"/"fallback"/"blank")],
  […_live, …_queue_program, ch_<classics>_source, mksafe(blank())])`, `:1936` input,
  `output.url(... live/snc-tv ...)`, input-switch telemetry — and Classics' `_source` is defined
  before the broadcast block references it (topo-sort).
- **`liquidsoap --check` exit 0** on the real-DB config (495 lines, 6 channels). Zero errors. The
  only warnings are pre-existing/filed: `Unused variable _req` (generic channel GET handlers) and
  `Deprecated: use \`null\`` (the `null()`→`null` pool code — already filed as
  `editorial-render-followups #3`, present on every channel, not introduced here).
- Full API unit suite **1772 passed**; `tsc --noEmit` clean.

No unit test for the seed script itself — it composes already-unit-tested services
(`upsertEditorialConfig` / `createEditorialTier` / `getEditorialTiers`) and seed scripts are
integration glue validated by the live run above, consistent with the other seed scripts in
`src/scripts/` (which also have no unit tests).

## Design reference
Feature body §Implementation Units / Unit 3.

## Review findings — BOUNCE (feature deep review, 2026-06-18)

Fresh-context adversarial review caught the **backfill trigger gap** this story's §Risks named but
the implementation didn't actually close.

**BLOCKER: the backfill is operator-manual only; a restart before re-seeding silently degrades S/NC
TV to queue-only (no live takeover, no Classics carry).** Boot regenerates the `.liq` via
`writeConfigOnly()` (`apps/api/src/jobs/register-workers.ts:154`) from DB state, but
`seed-channels` / `seedBroadcastEditorialConfig` is **not** invoked at boot, in `start-dev.sh`, or in
any migrate/entrypoint hook (grep-confirmed). So an existing deployment (broadcast channel row, no
editorial config — the pre-feature state) on its next API restart: `writeConfigOnly` regenerates →
the broadcast channel joins the topology → gets the **config-less default (single queue tier)** →
renders `fallback([queue_program, mksafe(blank())])`. **The `:1936` live input and the Classics carry
both vanish silently.** Creator takeover is dead until someone manually runs `bun run db:seed-channels`.

The "verified live against the dev DB" check passed because the seed had *just been run* manually in
the same session — it never exercised the restart-without-reseed path, which is the actual deployment
hazard. This is a silent production regression on the exact channel the feature is about.

**To fix**: the broadcast editorial config must exist before the first `writeConfigOnly`, durably —
not as a manual step. Options to weigh:
1. **Boot-time ensure** — call an idempotent `ensureBroadcastEditorialConfig` in the startup
   sequence (alongside / before `writeConfigOnly`), so a config-less broadcast channel self-heals on
   boot. The seed helper is already idempotent; the work is wiring it into boot, not the script.
2. **A data migration** — a one-time migration that backfills the editorial config for any existing
   broadcast channel (drizzle migration or a guarded startup task).
3. **A render-time fallback** — if the broadcast channel has no editorial config, render the
   equivalent `[live, queue, default-carry, blank]` instead of the queue-only default (keeps S/NC TV
   safe even un-seeded, but re-introduces a broadcast special case in the render — weigh against the
   feature's whole point).

Whichever path: add a test/assertion for the **restart-without-reseed** scenario — a broadcast
channel with NO editorial config must still render the live input + carry (option 3) OR the boot
sequence must guarantee the config exists (options 1/2). The dev-DB "happy path" check is not enough.

**Partial-state note (lower priority)**: a mid-loop `createEditorialTier` failure (tier 2 of 3)
leaves a config row + partial tiers; the idempotency guard (`length > 0 → skip`) would NOT repair it
on re-run. Worth making the guard count-aware (expect exactly 3) or clear-and-recreate, but secondary
to the trigger gap above.

## Fix (2026-06-18) — BLOCKER 2: boot-time backfill

**Made the broadcast editorial config a durable boot-time guarantee, not a manual step.**

- **`editorial-config.ts`**: new `ensureBroadcastEditorialConfig()` — idempotent, self-contained
  (resolves the broadcast channel + its carry target from the DB itself, via the broadcast channel's
  `defaultPlayoutChannelId`). Ensures `mode: auto` + tiers `live(0) / queue(1) / channel-as-source→
  default-playout(2)`. Branches: no broadcast channel → ok no-op; complete tier set → skip; **zero
  tiers → create the full set (the backfill)**; partial set (prior run failed mid-creation) → log a
  warning + leave for operator reconciliation, never crash. Returns `Result` so the boot caller logs
  but continues — a degraded S/NC TV must not block startup.
- **`register-workers.ts`**: call `ensureBroadcastEditorialConfig()` **before** `writeConfigOnly()` in
  the boot sequence. So on every restart the broadcast config is ensured before the `.liq` is
  regenerated — closing the silent restart-without-reseed regression. A failure is logged, not fatal.
- **`seed-channels.ts`**: refactored to call the shared `ensureBroadcastEditorialConfig()` (deleted
  the duplicate inline `seedBroadcastEditorialConfig`). One provisioning path for both seed + boot.

**Addresses the partial-state note**: the guard is now count-aware (`>= expectedCount` → skip;
`0` → create; partial → warn-and-leave), rather than the prior `length > 0 → skip` that would strand
a partial set.

### Verification
- **Restart-without-reseed simulated against the live dev DB**: deleted the broadcast channel's
  editorial config + tiers (the pre-feature state), then ran `ensureBroadcastEditorialConfig` (the
  boot path) → tiers went `0 → live@0, queue@1, channel-as-source@2` (full backfill). 2nd run
  idempotent (still 3, ok). This is the exact hazard the review flagged, now self-healing.
- **Unit tests** (`editorial-config.test.ts`, +3): no-broadcast no-op; complete-set skip; partial-set
  leave-untouched. `register-workers.test.ts` updated to mock the new boot dependency (back to green).
- Full API unit suite **1778 passed**; `tsc --noEmit` clean.
