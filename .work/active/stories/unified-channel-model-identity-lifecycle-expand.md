---
id: unified-channel-model-identity-lifecycle-expand
kind: story
stage: implementing
tags: [streaming, playout]
parent: unified-channel-model-identity-lifecycle
depends_on: []
release_binding: null
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
