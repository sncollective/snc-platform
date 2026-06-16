---
id: unified-channel-model-editorial-engine-config-schema
kind: story
stage: implementing
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
