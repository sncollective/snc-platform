---
id: unified-channel-model-identity-lifecycle-contract
kind: story
stage: implementing
tags: [streaming, playout]
parent: unified-channel-model-identity-lifecycle
depends_on: [unified-channel-model-identity-lifecycle-migrate]
release_binding: null
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
