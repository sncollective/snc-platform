---
id: unified-channel-model-identity-lifecycle
kind: feature
stage: done
tags: [streaming, playout]
parent: unified-channel-model
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
---

# Channel identity/lifecycle — the enum dies, creator channels persist

## Resume note (2026-06-13, Lane 1 — safe to clear & resume)

Working tree clean through the type→role chain; migrations applied to the dev DB through
`0025` (`0023` add cols, `0024` backfill, `0025` drop `type`). The expand→migrate→contract
chain has now been **reviewed and approved** (orchestrator review pass 2026-06-13).

**Child story status:**
- `-expand` → **done** (Approve; schema cols + backfill; commit `6d1d468`)
- `-migrate` → **done** (Approve; all consumers cut to role/ownership; commit `356e8b8`)
- `-contract` → **done** (Approve; `type` enum dropped everywhere; commit `dd9a9f3`)
- `-lifecycle` → **implementing, NOT STARTED** ← the one remaining piece (3/4 children done;
  feature stays `implementing` until this lands)

All three reviewed stories keep `release_binding: null` — mid-epic children of
`unified-channel-model` (`epic_cohesion: total`): the whole epic binds to one release at
completion, and the release-deploy binding guard catches unbound items at ship time.

**To resume — build the last piece:**
- `/agile-workflow:implement unified-channel-model-identity-lifecycle-lifecycle`
  — depends only on `-expand` (satisfied via landed code). It's the behavior-bearing story:
   `ensureCreatorChannel` on stream-key creation, retire `createLiveChannel`'s temp-row
   fabrication for activate-not-delete, chat-room continuity across sessions, and dedupe of
   backfill-left duplicate `live-ingest` rows. Coordinates with `stream-lifecycle.ts`
   (extracted earlier; `ensureLiveChannelWithChat`/`teardownLiveChannel` get rewritten there).

**Carry-forward facts for whoever resumes:**
- Identity model landed: `channels.ownership` ('platform'|'creator') + `channels.role`
  ('playout'|'broadcast'|'live-ingest'); `type` is gone. Airing-state is still NOT modeled
  here — it stays with `live-experience-redesign-live-state`.
- LIVE-badge sites carry `TODO(live-state)` breadcrumbs (channel-card.tsx, live.tsx,
  admin/playout.tsx) using the interim proxy `ownership==='creator' && role==='live-ingest'`.
- Verification baseline at HEAD: `@snc/api` unit + integration 15/15 + `@snc/web` 1717/1717
  green; topology goldens byte-identical; shared+web typecheck clean. The **only** `@snc/api`
  typecheck errors are 2 pre-existing Lane 2 ones (`playout-orchestrator.ts:346`,
  `sse.routes.test.ts:104`) — NOT mine, do not chase them.
- Shared-index hazard: other lanes commit concurrently in this working tree. Commit with a
  tight pathspec or reset-then-add only your files (a concurrent broad `git add` once swept
  my files into another lane's commit). Watch for it.
- Lint note for the migrate→contract gap that bit once: grep guards for `type` decision-reads
  miss *output serializations* (a `/status` response mapping `type: ch.type` slipped past the
  migrate guard, caught by the contract typecheck). When auditing a field removal, grep
  assignments/serializers too, not just `=== "..."`.


## Brief
Split channel identity from airing state in the data model and retire the per-session
temp-row lifecycle. Identity (platform-owned vs creator-owned, mount point/`srsStreamName`,
slug/name, ownership) becomes the durable shape of the `channels` row; the 4-value `type`
enum ("playout" | "live" | "scheduled" | "broadcast") is removed — `"scheduled"` is dead
today and the live-vs-broadcast conflation is the LIVE-badge bug class. Migration is
**expand-migrate-contract** (per epic design decision): add identity fields, migrate
consumers off `type`, drop the enum last — each step reviewable and revertible on the
production streaming path.

Creator channels become persistent: lazily provisioned on the creator's first
channel-shaped act (stream key creation, pool config, queue use), and `on_publish`
**activates** the creator's existing channel instead of fabricating a temp row
(`createLiveChannel`'s fabricate-or-reactivate dance in `services/channels.ts` retires).
Chat-room lifecycle continuity must be preserved across this change (rooms currently
created per fabricated channel). Canonical platform-channel identity moves into the model:
the `SNC_TV_BROADCAST` constant in `services/channels.ts` (and the seed script's channel
definitions) become seeded identity rows — this feature takes the constant ownership the
topology refactor deliberately deferred.

Does NOT cover: the airing-state *representation* (derived live/playout/offline state is
built by `live-experience-redesign-live-state` per the epic's Consumers section — this
feature only guarantees the identity fields that derivation keys on); editorial config
(sibling `editorial-engine`); any UI beyond keeping existing admin/viewer surfaces working
through the migration.

## Epic context
- Parent epic: `unified-channel-model`
- Position in epic: foundation feature — the other three children depend on its schema
  and lifecycle semantics. The epic-level `depends_on` (`bold-channel-topology-model-render`,
  landed 2026-06-13) gives this feature the typed topology + pure render seam to migrate
  against.

## Foundation references
- `docs/streaming.md` — channel/playout architecture (current state; this feature changes it)
- Epic body `## Decisions` — airing model, provisioning, identity-vs-state (locked at workshop)

## Design decisions inherited from epic
- Expand-migrate-contract for the enum removal (see epic `## Design decisions`).
- Airing state is derived + event-published, owned by the live-state feature; no
  `state` enum column replaces the `type` enum.

## Design decisions (this feature, 2026-06-13)

- **Identity shape: `ownership` + `role` (two orthogonal columns).** The dying `type`
  enum did four jobs; the durable identity replacement is two columns:
  `ownership` (`'platform' | 'creator'`) and `role` (`'playout' | 'broadcast' | 'live-ingest'`).
  Routing keys on `role` (srs.ts/playout.ts/orchestrator filter `role === 'playout'`,
  broadcast is the single `role === 'broadcast'` row); permissions key on `ownership`
  (creator-owned vs platform-CRUD). The dead `'scheduled'` value is dropped. *Rejected:
  ownership-only (defers playout-vs-broadcast routing into editorial config the engine
  feature hasn't built — routing needs the signal now); single 3-value `kind` enum
  (re-couples identity facets, gets re-litigated). The two-column model is more consumer
  churn now but is the model the epic's "channel = receiver, role is what it does" thesis
  actually wants.*
  - **`'live'` is NOT a role.** Today `type === 'live'` is the airing-state conflation
    (the LIVE-badge bug). A creator channel's identity is `ownership: 'creator', role:
    'live-ingest'` permanently; whether a creator is *on air right now* is **derived
    airing-state** owned by `live-experience-redesign-live-state`, not stored here. This
    feature provides the identity fields that derivation keys on; it does not compute
    live-ness.
- **Provisioning trigger: stream-key creation only (in this feature's scope).** The
  persistent creator channel row is ensured when a creator creates their first stream key
  (existing, permission-gated act). `on_publish` then **activates** the existing row instead
  of fabricating a temp one. Pool/queue triggers are deferred to `editorial-engine` (those
  acts don't exist yet). *Rejected: on_publish-fallback provisioning (adds migration-boundary
  defensiveness this feature can cover more simply via the backfill); on_publish-only (keeps
  the proactive-provisioning UX gap the epic wants closed).* **Migration-boundary safety**
  for stream keys created before this ships is handled by the expand-step backfill (every
  creator with an existing key/session gets a channel row), not by runtime fallback.
- **Migration cut: phase-per-story, expand → migrate → contract → lifecycle.** Four child
  stories, each one revertible step on the production path (matches the epic's locked
  expand-migrate-contract decision). Dep chain: expand ← migrate ← contract; lifecycle
  depends on expand only (it needs the columns, not the enum's removal).

## Architectural choice

**Expand-migrate-contract with the identity columns added additively, `type` kept
authoritative until the contract step.** The alternative (atomic column swap) is one
irreversible review unit spanning every channels consumer on the live streaming path —
exactly what the epic forbids. Each phase here builds and ships green with `type` and the
new columns coexisting; consumers cut over one PR; the enum drops last when nothing reads it.

The shared-type surface (`packages/shared/src/streaming.ts`) is the SSOT for the channel
shape — `CHANNEL_TYPES`/`ChannelType` get replaced by `CHANNEL_OWNERSHIPS`/`CHANNEL_ROLES`
const tuples + derived types, and the `ChannelSchema` Zod object gains `ownership`/`role`
and (in the contract step) drops `type`. API and web both infer from there, so the cutover
is type-checked end to end.

## Implementation Units

### Unit 1 (Story: expand) — schema columns + backfill
**Files**: `apps/api/src/db/schema/streaming.schema.ts`, generated migration under
`apps/api/drizzle/migrations/`, `packages/shared/src/streaming.ts`.

```ts
// streaming.schema.ts — channels table, ADD (type stays for now):
ownership: text("ownership").notNull().default("platform"), // 'platform' | 'creator'
role: text("role").notNull().default("playout"),            // 'playout' | 'broadcast' | 'live-ingest'
// new index for role-based routing (mirrors today's type+active idx):
index("channels_role_active_idx").on(table.role, table.isActive)

// packages/shared/src/streaming.ts — ADD alongside CHANNEL_TYPES (not yet removed):
export const CHANNEL_OWNERSHIPS = ["platform", "creator"] as const;
export type ChannelOwnership = (typeof CHANNEL_OWNERSHIPS)[number];
export const CHANNEL_ROLES = ["playout", "broadcast", "live-ingest"] as const;
export type ChannelRole = (typeof CHANNEL_ROLES)[number];
```

**Backfill** (custom SQL via `db:generate --custom`, NOT hand-authored journal):
`type='playout' → ownership='platform', role='playout'`;
`type='broadcast' → ownership='platform', role='broadcast'`;
`type='live' → ownership='creator', role='live-ingest'`;
`type='scheduled'` → (none exist; map defensively to `platform`/`playout` + log).

**Acceptance**: migration applies + reverts cleanly; every existing row has non-null
`ownership`/`role` consistent with its `type`; build green with both column sets present;
new shared types exported, `type`/`ChannelType` untouched.

### Unit 2 (Story: migrate) — consumers cut over to role/ownership
**Files**: `apps/api/src/services/channels.ts` (CHANNEL_PRIORITY keyed on `role`,
`ChannelInfo.type` → `ownership`+`role`, all writes set both), `srs.ts`
(`role === 'playout'` / `role === 'broadcast'`), `playout.ts:37`,
`playout-orchestrator.ts:790`, `liquidsoap-config.ts:58`,
`playout-channels.routes.ts:90`, plus web: `live.tsx`, `admin/playout.tsx`,
`landing/channel-card.tsx`, and `ChannelSchema` gains `ownership`/`role` (keeps `type`).

```ts
// channels.ts — priority now keys on role (broadcast > playout; live-ingest ranks
// with creator presence, NOT a stored 'live' type):
const ROLE_PRIORITY: Record<ChannelRole, number> = { broadcast: 0, playout: 2, "live-ingest": 1 };
```

**LIVE-badge note**: `channel-card.tsx`/`live.tsx` currently derive `isLive` from
`type === 'live'`. This feature changes the source to `ownership === 'creator' && role
=== 'live-ingest'` as an *interim* identity-based signal so existing surfaces keep working;
the *correct* live-ness (actually-on-air) lands with `live-experience-redesign-live-state`.
Mark these call sites with a `// TODO(live-state): replace identity proxy with derived
airing-state` so the sibling feature finds them.

**Acceptance**: no consumer reads `channels.type` after this story (grep clean except the
column definition + Zod field); all existing tests green; channel list/admin/live surfaces
behave identically to pre-migration.

### Unit 3 (Story: contract) — drop the enum
**Files**: `streaming.schema.ts` (drop `type` column + `channels_type_active_idx`),
generated drop migration, `packages/shared/src/streaming.ts` (remove `CHANNEL_TYPES`/
`ChannelType`/`type` from `ChannelSchema`), any lingering fixtures.

**Acceptance**: `type` gone from schema, shared types, and Zod; `grep -rn "channels.type\|ChannelType\|CHANNEL_TYPES"` returns nothing; full suite green; migration reverts cleanly.

### Unit 4 (Story: lifecycle) — persistent creator channels + lazy provisioning
**Files**: `apps/api/src/services/channels.ts` (new `ensureCreatorChannel`, retire
`createLiveChannel`'s fabricate-or-reactivate in favor of activate-existing),
`apps/api/src/services/stream-keys.ts` (call `ensureCreatorChannel` on first key create),
the `on_publish` path in `streaming.routes.ts` / `stream-lifecycle.ts` (activate not
fabricate), `seed-channels.ts` + `SNC_TV_BROADCAST` (seeded identity rows carrying
`ownership: 'platform'`, `role: 'broadcast'`/`'playout'`).

```ts
// channels.ts — provisioning is idempotent; the channel persists across stream sessions
export const ensureCreatorChannel = async (creatorId: string): Promise<Result<{ channelId: string }, AppError>>;
// on_publish: look up the creator's persistent channel, set isActive + streamSessionId;
//   NEVER insert a temp row, NEVER delete on on_unpublish (just deactivate).
```

**Chat-room continuity**: rooms are today created per fabricated channel. With persistent
channels the room is ensured once at provisioning and reused; on_unpublish closes/reopens
the *session*, not the room. Preserve existing room behavior — provision-time
`ensureChannelRoom`, deactivate (not delete) on stop.

**Acceptance**: creating a stream key creates exactly one persistent creator channel
(`ownership='creator', role='live-ingest'`); a creator who streams twice reuses the same
channel row (no temp-row churn); on_unpublish deactivates without deleting; chat room
survives across sessions; `SNC_TV_BROADCAST` + seed rows carry ownership/role; integration
test covers publish→unpublish→publish reuse.

## Implementation Order
1. `unified-channel-model-identity-lifecycle-expand` (schema + backfill)
2. `unified-channel-model-identity-lifecycle-migrate` (consumers off `type`) — after expand
3. `unified-channel-model-identity-lifecycle-contract` (drop enum) — after migrate
4. `unified-channel-model-identity-lifecycle-lifecycle` (persistent provisioning) — after expand
   (independent of migrate/contract; can run parallel to 2–3 once columns exist)

## Testing
- **expand**: migration up/down test; backfill correctness assertion per `type` value.
- **migrate**: existing `channels.test.ts`, `srs` tests, route tests stay green; add a
  priority-ordering test keyed on `role`; assert no `type` reads remain (grep guard in a test or CI note).
- **contract**: full `@snc/api` unit suite + the topology goldens (untouched — render reads
  `role`-filtered playout channels, output must stay identical); grep guard for `type`.
- **lifecycle**: integration test for publish→unpublish→publish channel reuse; stream-key-
  create → channel-exists assertion; chat-room survival across sessions.

## Risks
- **Production streaming path.** Every story ships green with coexisting state until contract;
  the topology goldens (from the landed model-render feature) are the byte-identity guard that
  the `.liq` render is unaffected by the `type`→`role` cut.
- **LIVE-badge interim proxy.** Migrate-step uses an identity proxy (`role==='live-ingest'`)
  for `isLive` until live-state lands the real derivation. If live-state slips, the badge is
  identity-accurate but not airing-accurate (same as a creator channel always showing live
  when it has any session) — acceptable interim, flagged with TODO breadcrumbs.
- **Backfill of pre-existing creator channels.** Today's `type='live'` rows are temp
  fabrications; the expand backfill maps them to `creator`/`live-ingest`, but the lifecycle
  story must reconcile any duplicate temp rows per creator (dedupe to one persistent channel).
  Lifecycle-story acceptance includes a dedupe assertion.
- **`scheduled` dead value.** Confirmed unused; mapped defensively in backfill. If a
  `scheduled` row somehow exists in prod, it lands as `platform`/`playout` + a logged warning
  rather than failing the migration.

## Children complete (2026-06-13 — advanced implementing→review)
All 4 child stories at review/done; feature advanced to `review`.
- `-expand` done (Approve), `-migrate` done (Approve), `-contract` done (Approve) — the type→ownership/role migration chain, reviewed this session.
- `-lifecycle` review (commit `cafcb45`) — persistent creator channels + lazy provisioning: `ensureCreatorChannel` (idempotent + backfill dedup), `createLiveChannel`→`activateLiveChannel` (activate-in-place, never fabricate), teardown deactivates (never deletes), chat room preserved across sessions, seed rows + `SNC_TV_BROADCAST` carry explicit ownership/role. Integration test (publish→unpublish→publish reuse) written; requires live DB to run (not runnable in sandbox).
Verification: @snc/shared green; @snc/api typecheck clean; channels/srs/playout/streaming suites green (14 api failures are environmental local-storage /tmp, unrelated). `release_binding` null — binds with the unified-channel-model epic at ship (epic_cohesion:total).

## Deep review (2026-06-14)
**Verdict: Approve with comments** (fresh-context deep review). The expand→migrate→contract→lifecycle chain is clean and conventions-compliant; SSOT consistency end-to-end, drizzle-generated migrations, ROLE_PRIORITY preserves ordering, topology goldens byte-identical, deactivate-not-delete + idempotent chat-room continuity confirmed by reading. One **Important** (filed): `activateLiveChannel` writes encoder-chosen `srsStreamName` against a unique index — a collision throws and is silently swallowed → backlog `srs-stream-name-unique-index-collision` (carry to epic prod-verification). Nits (not filed): stale `streamSessionId` on deactivate; dedup not concurrency-safe (eventual-consistency). All 4 children done. release_binding null (epic_cohesion:total). Parent epic stays implementing (drafting siblings).
