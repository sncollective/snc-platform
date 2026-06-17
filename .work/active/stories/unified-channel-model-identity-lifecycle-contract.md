---
id: unified-channel-model-identity-lifecycle-contract
kind: story
stage: done
tags: [streaming, playout]
parent: unified-channel-model-identity-lifecycle
depends_on: [unified-channel-model-identity-lifecycle-migrate]
release_binding: 0.4.0
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
---

# Contract: drop the type enum and dead 'scheduled'

The final phase. Nothing reads `type` after the migrate story, so remove it everywhere:
the column, the index, the shared type, and the Zod field. This is the step that makes the
LIVE-badge bug class structurally unrepresentable.

## Scope

- `apps/api/src/db/schema/streaming.schema.ts` — drop the `type` column and
  `channels_type_active_idx` (the `channels_role_active_idx` added in expand replaces it).
- Generated drop migration via `bun run --filter @snc/api db:generate` (drizzle-kit emits
  the column/index drop; never hand-author).
- `packages/shared/src/streaming.ts` — remove `CHANNEL_TYPES`, `ChannelType`, and the
  `type` field from `ChannelSchema`.
- Any remaining test fixtures or seed code still setting `type:` (should be none after
  migrate + lifecycle, but sweep).

## Acceptance criteria

- [ ] `type` column and `channels_type_active_idx` gone from the schema; drop migration applies + reverts cleanly.
- [ ] `CHANNEL_TYPES` / `ChannelType` / `ChannelSchema.type` removed from shared.
- [ ] `grep -rn "channels.type\|ChannelType\|CHANNEL_TYPES\|\\btype: \"(playout|live|broadcast|scheduled)\"" apps packages` returns nothing.
- [ ] Full `@snc/api` + `@snc/shared` + `@snc/web` build/typecheck green.
- [ ] Full API unit suite green, INCLUDING the topology goldens (byte-identical — render now reads only `role`).

## Notes

Irreversible-ish (dropping a column), but the drizzle drop migration reverts cleanly in
dev and the data is fully derived from `ownership`/`role` by this point. Sequenced last so
the production path never has a window where a consumer needs a column that's gone.

## Implementation notes (2026-06-13)

- **Files changed (src):**
  - `apps/api/src/db/schema/streaming.schema.ts` — dropped the `type` column and
    `channels_type_active_idx`; updated the column comment to reflect identity-not-type.
  - `apps/api/drizzle/migrations/0025_worthless_maelstrom.sql` — generated drop migration
    (`DROP INDEX channels_type_active_idx; ALTER TABLE channels DROP COLUMN type`). Applied
    + verified against dev DB.
  - `packages/shared/src/streaming.ts` — removed `CHANNEL_TYPES`, `ChannelType`, and
    `ChannelSchema.type`; rewrote the identity comment to current-state.
  - `apps/api/src/services/channels.ts` — removed the `ChannelType` import, `ChannelInfo.type`
    field, the `row.type` read mapping, and the four writer `type:` lines (createLiveChannel ×2,
    ensureBroadcast, ensurePlayout) — `ownership`/`role` now carry identity.
  - **`apps/api/src/routes/streaming.routes.ts:159`** — the `/status` response serializer was
    still mapping `type: ch.type` into the `Channel` JSON. **This was a migrate-story miss**: it's
    an output-serialization, not a `=== "..."` decision-read, so the migrate grep guard didn't
    catch it (the contract typecheck did). Changed to emit `ownership`/`role`. Worth flagging the
    grep guard's blind spot — output mappings need a separate check from predicate reads.
- **Tests fixed (stale fixtures + assertions — test debt, not product bugs):**
  - `channels.test.ts` — removed `type` from `makeChannelRow`, the `ch()` helper, and the
    selectDefaultChannel literal objects; **rewrote 3 writer assertions** (`vals.type === "live"/
    "broadcast"`) to assert `vals.ownership`/`vals.role` (the writers now set those); renamed one
    test title from "type broadcast" to "broadcast role".
  - `srs.test.ts` — `makeChannel` now destructures the `type` override (kept as an ergonomic
    identity selector via `identityForType`) and no longer spreads a `type` field into the object.
  - `playout-orchestrator.test.ts`, `playout.test.ts`, `streaming.routes.test.ts`,
    integration `playout-queue-cleanup.test.ts` — channel-row/`Channel` fixtures drop `type`,
    carry `ownership`/`role`.
  - web `channel-card` / `whats-on` / `admin/playout` / `live` fixtures — `type` removed
    (the live `liveOverrides`/overrides already carry `ownership`/`role`).
- **Discrepancies from design:** none. The one beyond-scope edit (streaming.routes.ts serializer)
  was a necessary completion of the migrate cutover surfaced here, not a design deviation.
- **Adjacent issues parked:** none. The 2 standing `@snc/api` typecheck errors remain Lane 2's
  pre-existing event-spine work.
- **Verification:**
  - Final grep guard CLEAN — `channels.type`/`ChannelType`/`CHANNEL_TYPES`/`channels_type_active_idx`
    gone from all src.
  - `@snc/shared` typecheck clean; `@snc/web` typecheck 0 errors; `@snc/api` typecheck back to the
    2 pre-existing Lane 2 errors only.
  - Suites green: `@snc/api` unit (all files), `@snc/api` integration 15/15 (real DB insert with
    `type` dropped works), `@snc/web` 1717/1717.
  - Topology goldens **byte-identical** — render reads role-filtered playout channels, output unchanged.

## Review (2026-06-13)

**Verdict**: Approve

**Blockers**: none
**Important**: none
**Nits**: none

**Notes**: Substrate-mode review of the landed contract commit (`dd9a9f3`), full diff read.
The enum is gone cleanly: `type` column + `channels_type_active_idx` dropped (migration `0025`),
`CHANNEL_TYPES`/`ChannelType`/`ChannelSchema.type` removed from shared, `ChannelInfo.type` +
`row.type` mapping + the four writer `type:` lines removed from `channels.ts`. The LIVE-badge bug
class is now structurally unrepresentable — there is no `type` column left to conflate identity
with airing-state. The one beyond-scope edit (`streaming.routes.ts:159` `/status` serializer,
emitting `ownership`/`role` instead of `type`) was a genuine migrate-step miss surfaced by the
contract typecheck — an output serialization the migrate grep guard (predicate-only) didn't catch.
The fix is correct and consistent with the migrated `ChannelSchema` SSOT (web consumers infer from
it, already migrated), so the `/status` response shape change is internally coherent — no orphaned
external consumer. Worth carrying the lesson forward: field-removal audits need an output-mapping
grep, not just `=== "..."` predicate grep (already noted in the story body). Test fixtures + 3
writer assertions updated honestly. Verified at HEAD: grep guard clean (`channels.type`/
`ChannelType`/`CHANNEL_TYPES`/`channels_type_active_idx` absent everywhere), `@snc/shared` typecheck
+ tests green; channels/srs/playout/streaming API tests green (14 api failures are environmental
`/tmp` mkdir errors in `local-storage.test.ts` — sandbox FS, unrelated). `release_binding` left
`null` (mid-epic; binds with the epic at ship — see expand review).
