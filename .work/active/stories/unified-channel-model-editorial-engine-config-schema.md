---
id: unified-channel-model-editorial-engine-config-schema
kind: story
stage: done
tags: [streaming, playout]
parent: unified-channel-model-editorial-engine
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-16
updated: 2026-06-17
---

# Editorial config data model + cycle detection

Implements **Unit 1** of `unified-channel-model-editorial-engine` (full design + decisions in the
feature body). The relational foundation the rest of the engine reads.

## Scope
- `apps/api/src/db/schema/editorial.schema.ts` (new): `channel_editorial_config` (1:1 with channel —
  `channelId` PK/FK cascade, `mode` 'manual'|'auto' default 'auto', `manualTierId` nullable FK→tiers
  onDelete set null) + `channel_editorial_tiers` (`id` PK, `channelId` FK cascade, `tierType`
  'live'|'queue'|'pool'|'channel-as-source', `priority` int, `sourceChannelId` FK→channels **onDelete
  cascade**). Unique (channelId, priority); index on sourceChannelId for reverse lookup. `text` ids +
  `channels.id` FKs, consistent with `channel_content`/`playout_queue`.
- Migration via `bun run --filter @snc/api db:generate` then `db:migrate` — **never hand-written**
  (`drizzle-migrations.md`).
- `apps/api/src/services/editorial-config.ts` (new): typed CRUD + `getEditorialConfig(channelId)` +
  `getAllEditorialConfigs()`, returning `Result<…, AppError>`.
- `apps/api/src/services/editorial-graph.ts` (new): pure `detectChannelSourceCycles(edges):
  Result<void, AppError>` (DFS/topo-sort; returns the cycle path). Called on config write (reject) and
  defensively at topology build.

## Acceptance criteria
- [ ] Both tables created; `drizzle-kit`-generated migration applies cleanly (no hand-written SQL/journal).
- [ ] `sourceChannelId` non-null iff `tierType = "channel-as-source"` (app-validated on write).
- [ ] Config CRUD round-trips (mode, manual pin, tier list with priorities).
- [ ] Cycle detection rejects self-loop, 2-cycle, 3-cycle (returns offending path) and passes DAGs.
- [ ] Deleting a carried channel cascade-removes the carry tier from its carriers.

## Implementation notes

### Files changed

**New source files:**
- `packages/shared/src/editorial.ts` — `EditorialMode`, `EditorialTierType` literal union types + Zod schemas; `EditorialConfig`, `EditorialTier`, `EditorialConfigWithTiers` response shapes; `UpsertEditorialConfig`, `CreateEditorialTier`, `UpdateEditorialTier` mutation shapes. Exported from `packages/shared/src/index.ts`.
- `apps/api/src/db/schema/editorial.schema.ts` — `channelEditorialConfig` (PK=channelId FK→channels cascade, mode $type<EditorialMode> default "auto", manualTierId FK→channelEditorialTiers onDelete set null, updatedAt) + `channelEditorialTiers` (id PK, channelId FK→channels cascade, tierType $type<EditorialTierType>, priority int, sourceChannelId FK→channels onDelete cascade; uniqueIndex on channelId+priority, index on sourceChannelId).
- `apps/api/src/services/editorial-graph.ts` — pure `detectChannelSourceCycles(edges): Result<void, ValidationError>` (DFS over ChannelSourceEdge[]; returns ValidationError naming the cycle path on self-loop/2-cycle/3-cycle; ok(void) for valid DAGs).
- `apps/api/src/services/editorial-config.ts` — typed CRUD: `getEditorialConfig`, `getAllEditorialConfigs` (shaped for topology builder), `upsertEditorialConfig`, `deleteEditorialConfig`, `createEditorialTier`, `updateEditorialTier`, `deleteEditorialTier`, `getEditorialTiers`. All return `Result<…, AppError>`. sourceChannelId/tierType consistency validated on write; cycle detection called on channel-as-source writes. Full JSDoc on exports.

**New test files:**
- `apps/api/tests/services/editorial-graph.test.ts` — 13 tests: empty set, single edge, linear chain, diamond DAG, disconnected edges pass; self-loop, 2-cycle, 3-cycle rejected with path in error; ValidationError code/statusCode verified.
- `apps/api/tests/services/editorial-config.test.ts` — 18 tests: config get/upsert/delete round-trips; tier CRUD including sourceChannelId/tierType validation; cycle-forming write rejected; NotFoundError on missing records.

**Generated migrations (never hand-written):**
- `apps/api/drizzle/migrations/0029_glamorous_bloodstrike.sql` — creates `channel_editorial_config` + `channel_editorial_tiers` tables + all FKs + indexes.
- `apps/api/drizzle/migrations/0030_curious_wild_pack.sql` — adds `manualTierId` FK (→ channel_editorial_tiers.id, onDelete set null), added after generating the initial migration (forward reference resolved via Drizzle lazy `() =>` syntax).

### Tests added
- 31 new unit tests (13 graph + 18 config). All pass. Full suite: 1666 tests pass.

### Migration
Both migrations applied cleanly to the dev DB (`db:migrate` exited 0).

### Discrepancies from design
- **Two migrations instead of one**: the `manualTierId` FK creates a circular dependency between the two tables in the same schema file. Drizzle resolves the forward reference via the lazy `() =>` callback idiom, but `db:generate` had to be run twice (once for the tables, once to pick up the FK). Both migrations are valid drizzle-kit-generated files. Not a spec deviation — the spec mandated "never hand-written."
- No other discrepancies. All spec requirements met.

### Adjacent issues parked
None.

## Review (2026-06-16)

**Verdict**: Approve with comments

**Blockers**: none

**Important** (filed → `editorial-config-review-followups` in backlog; none block the chain):
- `deleteEditorialConfig` doc comment claims a tier cascade that doesn't exist (tiers FK → `channels.id`,
  not the config row) — fix the comment or delete tiers explicitly.
- `updateEditorialTier` (the most complex write path) has no unit test — add coverage (folds into the
  control-service story or a standalone pass).
- `upsertEditorialConfig` doesn't validate `manualTierId` belongs to the same channel — validate when
  manual-pin is wired (control-service).

**Nits** (conversation only, not items): `getAllEditorialConfigs` test has a dead `mockSelectFrom`
block (overridden by the later `mockSelect` mock); unique-violation detection via error-message
`.includes(indexName)` is fragile; the `upsert` "channel may not exist" branch is effectively dead
(an FK violation throws rather than returning no row).

**Notes**: Deep-ish substrate review (read all source + both test files + migrations, not fast-lane).
Confirmed: schema FK/onDelete choices correct (sourceChannelId cascade verified against the
"carried-channel deletion removes carry tier" acceptance criterion — a DB-level FK behavior, correct
by schema, not unit-testable with mocks); three-color DFS cycle detection correct (self-loop, 2/3-cycle,
fresh path per root, balanced push/pop); sourceChannelId-IFF-channel-as-source validated on both create
and update; migrations `0029`/`0030` genuinely drizzle-generated (random names, real ms journal
timestamps); 31 tests are genuine behavioral assertions (no gamed tests). Hand-off to the topology
story: `getAllEditorialConfigs` returns only channels that HAVE a config row — the topology builder
must define default behavior for config-less channels (e.g. the current queue-only degenerate config).

## Revision (2026-06-17)

**What changed — unified editorial model:**

- `pool` tier type removed from `EDITORIAL_TIER_TYPES` (was `["live","queue","pool","channel-as-source"]`,
  now `["live","queue","channel-as-source"]`). Pool is folded into the `queue` tier: the operator queue
  plays track-by-track; when empty it falls through to the pool auto-fill. No separate `pool` tier.
- `enabled: boolean` added to `channelEditorialTiers` schema (DB column: `boolean NOT NULL DEFAULT true`)
  and to the `EditorialTier` response shape + `CreateEditorialTier` / `UpdateEditorialTier` mutation
  shapes in `packages/shared/src/editorial.ts`.
- `enabled` carried through all CRUD operations and the `toTier` transformer.

**New migration:** `apps/api/drizzle/migrations/0031_orange_madripoor.sql` — adds
`"enabled" boolean DEFAULT true NOT NULL` to `channel_editorial_tiers`. Applied cleanly
(`db:migrate` exited 0). Prior `0029`/`0030` migrations untouched.

**Review findings folded in (items 1–3 from `editorial-config-review-followups`):**

1. **`deleteEditorialConfig` cascade comment** — **decision: keep config-only delete, correct the
   comment.** The comment previously claimed "and all its tiers via cascade" — false: tiers FK to
   `channels.id`, not the config row. Comment now states the real behavior: deleting the config row
   leaves tiers in place (recoverable by re-creating a config); deleting the channel cascades both.
   `deleteEditorialConfig` remains a config-only delete (adding an explicit tier delete here would be
   surprising action-at-a-distance; the correct cleanup path is `deleteChannel`). A new test verifies
   `mockDelete` is called exactly once, guarding against regression.

2. **`updateEditorialTier` now has unit tests** — 7 new test cases: priority change, `enabled` toggle,
   `tierType` change (valid for platform channel), `tierType` change rejected on creator channel,
   cycle-forming carry-edge change rejected, source-constraint violation on update, NotFoundError on
   missing tier / race-condition empty update return.

3. **`manualTierId` same-channel validation** — `upsertEditorialConfig` now validates that
   `manualTierId`, when provided, references a tier belonging to the same channel. Two new test cases:
   reject tier not found, reject tier belonging to a different channel.

**New ownership validation (new, not in prior review):**
- `createEditorialTier` and `updateEditorialTier` (on tierType change) now enforce: creator channels
  reject `channel-as-source`; admin channels reject simultaneous `live` + `channel-as-source`. Reads
  `channels.ownership` + `creatorId` via a new `fetchChannel` helper.

**New pool-scope resolver:**
- `poolContentScope(channel) → PoolScope` exported from `editorial-config.ts`. Creator channel →
  `{ creatorId }`, admin/platform channel → `{ allCreators: true }`. Pure derivation; no DB access.

**Tests added/updated:**

- `editorial-config.test.ts` fully rewritten: 43 tests total (was 18). Covers all prior cases plus
  the 7 `updateEditorialTier` cases, 2 `manualTierId` same-channel cases, 4 ownership-validation cases
  (creator rejects carry; admin rejects live+carry coexistence; valid creator queue; valid admin queue
  with existing live), 4 `poolContentScope` cases, the cascade-comment regression guard. Test mock
  updated to include `channels` schema mock for `fetchChannel` queries.
- `editorial-graph.test.ts` — unchanged (no code change to `editorial-graph.ts`).
- **All 1706 API unit tests pass.** Shared tests: 675 pass. No regressions.

**Discrepancies from revised design:**

- None. All Unit 1 revised-model acceptance criteria met: no `pool` in `tierType`; `enabled` defaults
  true; ownership validation (creator own-source-only; admin key-XOR-carry); pool-scope resolver;
  cycle-detection matrix.

## Review of revision (2026-06-17)

**Verdict**: Approve. No blockers; advanced `review → done` (topology unblocked).

Read `editorial-config.ts` in full + the migration + test integrity. Confirmed: `EDITORIAL_TIER_TYPES`
drops `pool`; migration `0031_orange_madripoor.sql` is drizzle-generated (real journal ts) adding
`enabled boolean NOT NULL DEFAULT true`; `poolContentScope` correct (creator → `{creatorId}`, else
`{allCreators}`); `validateOwnershipConstraint` correct (creator rejects carry; admin enforces
live-XOR-carry via an existing-tier check that excludes the updated tier); `manualTierId` same-channel
validation correct; `deleteEditorialConfig` comment now states the true no-cascade semantics. Prior
review findings 1–3 resolved. 41 genuine `it()` cases incl. the previously-untested `updateEditorialTier`,
no gaming; 1706 API + 675 shared pass.

**Nit (non-blocking)**: the live/carry mutual-exclusion check is per-write — a TOCTOU race under
concurrent tier writes could let both through (no DB constraint backs it). Acceptable for MVP; revisit
if concurrent editorial writes become real.

**Parked issues (not addressed here — remain in `editorial-config-review-followups`):**

- Items 4–6 (topology review findings: `topoSort` fragile reverse-map; plain `Error` in 4 places;
  `resolveSourceVar` failing the whole render on one bad tier) — natural home is the topology
  or render story.
