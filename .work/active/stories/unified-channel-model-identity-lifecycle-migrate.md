---
id: unified-channel-model-identity-lifecycle-migrate
kind: story
stage: implementing
tags: [streaming, playout]
parent: unified-channel-model-identity-lifecycle
depends_on: [unified-channel-model-identity-lifecycle-expand]
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
---

# Migrate: cut every consumer off `type` onto role/ownership

The middle phase. Every read of `channels.type` moves to `role` (routing) or `ownership`
(permissions). `type` column still exists after this story but nothing reads it — the
contract story then drops it.

## Scope

API consumers (all `type === ...` reads → `role`/`ownership`):
- `apps/api/src/services/channels.ts` — `CHANNEL_PRIORITY` → `ROLE_PRIORITY` keyed on
  `ChannelRole` (`{ broadcast: 0, "live-ingest": 1, playout: 2 }`); `ChannelInfo.type` →
  `ownership` + `role`; every insert/update sets both new columns.
- `apps/api/src/services/srs.ts` — lines 72/74/113/133: `role === 'playout'` / `role === 'broadcast'`.
- `apps/api/src/services/playout.ts:37` — `eq(channels.role, 'playout')`.
- `apps/api/src/services/playout-orchestrator.ts:790` — `eq(channels.role, 'playout')`.
- `apps/api/src/services/liquidsoap-config.ts:58` — `eq(channels.role, 'playout')`
  (⚠ topology goldens must stay byte-identical — this only changes the WHERE predicate, not output).
- `apps/api/src/routes/playout-channels.routes.ts:90` — `eq(channels.role, 'playout')`.
- `packages/shared/src/streaming.ts` — `ChannelSchema` gains `ownership`/`role` (keep `type` for now).

Web consumers:
- `apps/web/src/routes/live.tsx` (267/299/314), `apps/web/src/routes/admin/playout.tsx`
  (52/108/112), `apps/web/src/components/landing/channel-card.tsx` (13).
- **LIVE-badge interim proxy**: `isLive` derivations currently on `type === 'live'` →
  `ownership === 'creator' && role === 'live-ingest'` as an interim identity proxy. Add
  `// TODO(live-state): replace identity proxy with derived airing-state` at each site so
  `live-experience-redesign-live-state` finds them.

## Acceptance criteria

- [ ] `grep -rn "channels.type\|\\.type === \"playout\"\|=== \"broadcast\"\|=== \"live\"\|=== \"scheduled\"\|ChannelType\|CHANNEL_TYPES" apps packages` returns only the column definition + the `type` Zod field (everything else cut over).
- [ ] `ROLE_PRIORITY` ordering test added; default-channel selection behaves as before.
- [ ] All existing `channels`/`srs`/route/web tests green; channel-list, admin playout, and live surfaces behave identically to pre-migration.
- [ ] Topology goldens unchanged (the `role`-predicate swap produces the same playout channel set → same `.liq`).
- [ ] LIVE-badge sites carry the `TODO(live-state)` breadcrumb.

## Notes

Behavior-preserving cutover: same channels selected, same priority order, same surfaces.
The only semantic shift is the LIVE-badge source, intentionally an identity proxy until
the live-state feature lands the real derivation.
