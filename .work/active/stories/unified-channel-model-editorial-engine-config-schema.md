---
id: unified-channel-model-editorial-engine-config-schema
kind: story
stage: review
tags: [streaming, playout]
parent: unified-channel-model-editorial-engine
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-16
updated: 2026-06-16
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
