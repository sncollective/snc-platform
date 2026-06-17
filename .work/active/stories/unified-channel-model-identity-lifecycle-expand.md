---
id: unified-channel-model-identity-lifecycle-expand
kind: story
stage: done
tags: [streaming, playout]
parent: unified-channel-model-identity-lifecycle
depends_on: []
release_binding: 0.4.0
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
---

# Expand: add ownership/role columns + backfill (type stays authoritative)

The additive first phase of expand-migrate-contract. Add the two identity columns and
backfill them from `type`; `type` remains the authoritative routing signal until the
migrate story cuts consumers over. Nothing reads the new columns yet.

## Scope

- `apps/api/src/db/schema/streaming.schema.ts` — add to the `channels` table:
  - `ownership: text("ownership").notNull().default("platform")` — `'platform' | 'creator'`
  - `role: text("role").notNull().default("playout")` — `'playout' | 'broadcast' | 'live-ingest'`
  - `index("channels_role_active_idx").on(table.role, table.isActive)` (mirrors the
    existing `channels_type_active_idx`; that index stays until contract).
- `packages/shared/src/streaming.ts` — add alongside (do NOT remove) `CHANNEL_TYPES`:
  - `CHANNEL_OWNERSHIPS = ["platform", "creator"] as const` + `ChannelOwnership`
  - `CHANNEL_ROLES = ["playout", "broadcast", "live-ingest"] as const` + `ChannelRole`
- Generated migration: schema-diff migration via `bun run --filter @snc/api db:generate`,
  then a **custom-SQL backfill** via `db:generate --custom` (per `.claude/rules/drizzle-migrations.md`
  — never hand-author the journal/snapshot):
  - `type='playout'   → ownership='platform', role='playout'`
  - `type='broadcast' → ownership='platform', role='broadcast'`
  - `type='live'      → ownership='creator',  role='live-ingest'`
  - `type='scheduled' → ownership='platform', role='playout'` (none expected; defensive)

## Acceptance criteria

- [ ] `db:generate` produces the column-add migration; `db:generate --custom` the backfill (no hand-authored journal/snapshot/timestamps).
- [ ] Migration applies and reverts cleanly (`db:migrate` up/down).
- [ ] After backfill every `channels` row has non-null `ownership`/`role` consistent with its `type`.
- [ ] `@snc/api` + `@snc/shared` build green with BOTH `type` and `ownership`/`role` present.
- [ ] New shared const tuples + types exported; `CHANNEL_TYPES`/`ChannelType` untouched.

## Notes

This story is purely additive — no consumer change, no behavior change. The topology
goldens (model-render feature) must stay green; they read `type='playout'` still, which is
unchanged here.

## Implementation notes (2026-06-13)

- **Files changed:**
  - `packages/shared/src/streaming.ts` — added `CHANNEL_OWNERSHIPS`/`ChannelOwnership` and
    `CHANNEL_ROLES`/`ChannelRole` const tuples alongside (not replacing) `CHANNEL_TYPES`.
  - `apps/api/src/db/schema/streaming.schema.ts` — added `ownership` + `role` columns (both
    `notNull().default(...)`) and `channels_role_active_idx`; legacy `type` column and
    `channels_type_active_idx` retained.
  - `apps/api/drizzle/migrations/0023_serious_thunderball.sql` — generated column-add + index
    (drizzle-kit `db:generate`).
  - `apps/api/drizzle/migrations/0024_square_psynapse.sql` — generated blank via `db:generate
    --custom`, filled with the backfill UPDATEs (the sanctioned custom-SQL path).
- **Tests added:** none new — this is a schema-only additive step; coverage that it's neutral
  comes from the existing channels/topology/streaming suites staying green (92/92) and the
  topology goldens being byte-identical.
- **Backfill verified in dev DB:** `broadcast→platform/broadcast` (1), `live→creator/live-ingest`
  (1), `playout→platform/playout` (5); 0 nulls / 7 total; no `scheduled` rows. New index present.
- **Discrepancies from design:** none. Column types, defaults, index name, and backfill mapping
  match the design exactly.
- **Revert caveat:** drizzle migrations here are forward-apply; there's no down-migration file.
  The column-add is trivially reversible by hand in dev if needed (drop columns + index), but
  the migrate/contract stories are the forward path — no rollback expected on the production path.
- **Adjacent issues parked:** none. (Noted but NOT acted on: 2 pre-existing `@snc/api` typecheck
  errors in `playout-orchestrator.ts:346` and `sse.routes.test.ts:104` are Lane 2's in-flight
  event-spine work — confirmed unrelated to this story; not mine to fix or park.)

## Review (2026-06-13)

**Verdict**: Approve

**Blockers**: none
**Important**: none
**Nits**: none

**Notes**: Substrate-mode review of the landed expand commit (`6d1d468`). Read the full
diff rather than rubber-stamping the implementation record. Additive change is correct and
matches the design exactly: `ownership`/`role` columns both `notNull().default(...)`, the
`channels_role_active_idx` mirrors the legacy `type` index (which is retained until contract),
`type` untouched and authoritative, new shared const tuples added alongside `CHANNEL_TYPES`.
Backfill SQL (`0024`, custom-SQL path per drizzle-migrations rule) maps all four enum values
correctly incl. the defensive `scheduled` mapping. Verified at HEAD: grep guard clean,
`@snc/shared` typecheck + 675 tests green. (The known down-migration absence is noted in the
story's own implementation notes — forward-apply is the production path here; acceptable.)
`release_binding` left `null`: this is a mid-epic child of `unified-channel-model`
(`epic_cohesion: total`); the whole epic binds to one release at completion, and the
release-deploy binding guard catches unbound items at ship time. No premature version pick.
