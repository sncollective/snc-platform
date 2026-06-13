---
id: unified-channel-model-identity-lifecycle-migrate
kind: story
stage: review
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

## Implementation notes (2026-06-13)

- **Files changed (API):**
  - `packages/shared/src/streaming.ts` — `ChannelSchema` gains `ownership`/`role` (keeps `type`).
  - `apps/api/src/services/channels.ts` — `ChannelInfo` gains `ownership`/`role`; `CHANNEL_PRIORITY`
    → `ROLE_PRIORITY` keyed on `ChannelRole` (`broadcast:0, live-ingest:1, playout:2` — preserves
    the old broadcast>live>playout order); read mapping populates both; all three writers
    (`createLiveChannel` ×2 paths, `ensureBroadcast`, `ensurePlayout`) set `ownership`/`role`
    alongside `type`.
  - `apps/api/src/services/srs.ts` (×4), `playout.ts`, `playout-orchestrator.ts`,
    `liquidsoap-config.ts`, `routes/playout-channels.routes.ts` — all `type`-predicate reads
    → `role`.
- **Files changed (web, LIVE-badge interim proxy + identity reads):**
  - `components/landing/channel-card.tsx`, `routes/live.tsx` (derived `selectedChannelIsLive`),
    `routes/admin/playout.tsx` — airing-state reads (`type === "live"`) → proxy
    `ownership === "creator" && role === "live-ingest"` with `TODO(live-state)` breadcrumbs;
    identity reads (`type === "playout"/"broadcast"`) → `role`.
- **Tests fixed (stale fixtures — test debt, not product bugs):**
  - `channels.test.ts` — `selectDefaultChannel` fixtures + `makeChannelRow` carry `ownership`/`role`;
    **the dead `scheduled`-tier test was rewritten** to assert broadcast-tier priority (the
    `scheduled` value no longer exists as a tier — honest update, not a gamed pass).
  - `srs.test.ts` — `makeChannel` derives `ownership`/`role` from the `type` override via
    `identityForType`, so existing call sites stay unchanged and the enrichment branches (now
    role-keyed) match.
  - web `channel-card` / `whats-on` / `admin/playout` / `live` test fixtures — `ownership`/`role`
    defaults added; `type: "live"` fixtures updated to set `creator`/`live-ingest` so the proxy fires
    (live.test via a `liveOverrides()` helper).
- **Discrepancies from design:** none of substance. The design's `ROLE_PRIORITY` example had
  `{broadcast:0, playout:2, "live-ingest":1}`; implemented identically (just reordered the literal).
- **Adjacent issues parked:** none. The 2 standing `@snc/api` typecheck errors
  (`playout-orchestrator.ts:346`, `sse.routes.test.ts:104`) remain Lane 2's pre-existing
  event-spine work — confirmed unrelated, not mine.
- **Verification:**
  - Acceptance grep clean — no consumer reads `channels.type` for decisions (only the column
    def, Zod field, `ChannelInfo.type` field, `row.type` mapping, and writer `type:` lines remain).
  - `ROLE_PRIORITY` ordering preserved (broadcast > live-ingest > playout); default-channel
    selection behaves as before.
  - Topology goldens **byte-identical** (snapshot status clean) — the `role`-predicate swap
    selects the same playout channel set → same `.liq`.
  - Full suites green: `@snc/api` unit 1572/1572, `@snc/web` 1717/1717, `@snc/shared` typecheck
    clean, `@snc/web` typecheck 0 errors.
  - LIVE-badge sites carry the `TODO(live-state)` breadcrumb (channel-card, live.tsx, admin/playout).
