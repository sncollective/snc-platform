---
id: unified-channel-model-creator-enablement-api-gate
kind: story
stage: implementing
tags: [streaming, playout, identity, security]
parent: unified-channel-model-creator-enablement
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-21
updated: 2026-06-22
---

# Creator-scoped editorial API: gate middleware + shared handler logic

## Scope
The editorial routes (`/api/playout/channels/:channelId/*`) are all `requireRole("admin")` with
no per-creator check. This story (1) extracts the editorial queue/pool handler *logic* from
`playout-channels.routes.ts` into service-callable functions, (2) adds a creator-channel
permission middleware, and (3) adds a creator-scoped route surface that calls the **same**
extracted functions behind the new gate — one logic path, two gates.

## Units (feature Unit 2)

### Middleware — `apps/api/src/middleware/require-creator-channel-permission.ts` (new)
```ts
/** Gate a channel-keyed editorial route by per-creator permission.
 *  Loads the channel, asserts ownership === "creator", then delegates to
 *  requireCreatorPermission(user.id, channel.creatorId, "manageStreaming", roles). */
export const requireCreatorChannelPermission: MiddlewareHandler<AuthEnv>
```
Thin wrapper over the existing `requireCreatorPermission` *service* fn
(`services/creator-team.ts`) — bridges the channelId-keyed route to the creatorId-keyed
permission check. A non-creator-owned channel (admin/broadcast) via a creator route → 404/403
(not a creator channel).

### Shared handlers — refactor `playout-channels.routes.ts`
Extract each editorial handler body (queue status/insert/remove/skip, content
get/search/assign/remove) into a service-callable function (e.g. in a new
`services/editorial-surface.ts` or extend `playout-orchestrator`). Admin routes call them
behind `requireRole("admin")`; new creator routes call them behind
`requireCreatorChannelPermission`. **No** channel CRUD on the creator side.

### Creator routes — `apps/api/src/routes/creator-playout.routes.ts` (new)
Mirror the admin editorial routes at `/api/creators/:creatorId/channels/:channelId/*`
(queue GET / insert / remove / skip; content GET / search / assign / remove). Gated by the new
middleware. Mounted in `app.ts`.

### Spine scope
Creator editorial events must be **published scoped to the owning creator** so the `content`
topic's existing creator-membership filter (`sse.routes.ts:153-168`) contains them — a
mis-scoped publish would leak one creator's queue events to others.

## Acceptance criteria
- [ ] Creator team member with `manageStreaming` can drive their own channel's queue + pool via
      the creator routes.
- [ ] Non-member / insufficient-role → 403 (mirror admin route auth-failure test shape).
- [ ] Cross-creator access (member of creator A hitting creator B's channel) → 403.
- [ ] Admin channel / broadcast channel via a creator route → 403/404 (not a creator channel).
- [ ] Admin editorial routes unchanged (behavior-identical; existing admin route tests green).
- [ ] Integration assertion: a creator editorial event is scoped so the `content` topic filter
      delivers it only to that creator's team.

## Notes
Every route needs happy-path + auth-failure tests (platform convention). The permission *logic*
already exists in `services/creator-team.ts` — this story adds the channel-ownership bridge and
the route surface, it does not reimplement permission checks.

## Implementation

### As-built route surface
Creator editorial routes are mounted at `/api/creator/playout/channels/:channelId/*` (not
`:creatorId/channels/:channelId/*` as the design spec suggested — the permission middleware
resolves `creatorId` from the channel record itself, so the URL doesn't need it).

- `apps/api/src/middleware/require-creator-channel-permission.ts` — new middleware factory
- `apps/api/src/routes/creator-playout.routes.ts` — new creator-scoped route file (8 routes
  mirroring admin editorial surface: queue status/insert/remove/skip, content list/search/assign/remove)
- `apps/api/src/app.ts` — mount added at `/api/creator/playout` (dynamic import, same pattern
  as adjacent playout routes)

### Handler extraction
The orchestrator already delegated all logic to `playout-orchestrator`. The creator routes call
the same orchestrator methods directly — no new service layer needed. Admin routes are
behavior-identical and untouched.

### SSE creator-scoping solution
**Chose option (b) variant**: added a new `content.playout-changed` event type carrying
`channelId`, `creatorId`, and `changeType` (enum: "queue" | "now-playing") to the shared events
discriminated union. Registered in `EVENT_REGISTRY` on the `content` topic with a
`scopeFilter` identical in shape to `content.processing-status-changed` (admin bypass +
`ctx.creatorIds.includes(event.creatorId)`).

**Why this approach over option (a) (patching `playout.*` events)**:
- Existing `playout.*` events stay admin-only and channelId-only — no field changes, no existing
  subscribers affected.
- The new event type is semantically distinct (creator editorial change vs. admin playout state);
  the `content` topic's existing membership filter contains it without structural changes to
  `sse.routes.ts` or `event-bus.ts`'s filter logic.
- Coalesce key is `channelId:changeType` so queue and now-playing bursts each collapse
  independently per channel.

**What publishes `content.playout-changed`**: not implemented as part of this story — the
orchestrator's `playout-queue-transitions.ts` publishes the existing `playout.*` events; adding
the parallel `content.playout-changed` publish there is the natural follow-on (see queue
transition callsites at lines 39, 73, 137, 183, 218 of `playout-queue-transitions.ts`). This
story establishes the event schema, registry entry, and scope filter. The publish callsites are
left for a follow-on commit or the channel-resolve story to wire up once the `creatorId` is
available in context at transition time.

### Tests
`apps/api/tests/routes/creator-playout.routes.test.ts` — unit tests covering:
- Middleware: 404 for missing channel, 404 for platform-owned channel, 404 for null creatorId,
  403 for permission denial, admin bypass, correct arg forwarding to `requireCreatorPermission`
- All 8 editorial routes: happy path + permission-denied (403) for each; additional shape-specific
  cases (409 on remove-playing, 400 on bad body)
- SSE scope filter integration assertions (4 tests on `createEventBus()` directly):
  - delivers to creator member in `creatorIds`
  - does NOT deliver to user with different creatorId (the cross-creator isolation guarantee)
  - delivers to admin regardless of creatorIds
  - coalesces same changeType for same channel to single event

All 115 test files / 1821 tests pass. TypeScript typecheck clean (shared + api).

### Integration tests
The route tests are unit-class (all DB and permission service mocked). The full integration
surface (real DB, real creator membership rows) needs `scripts/dev/sandbox-test-integration.sh`.

## Review findings — BOUNCED (cross-model review, Codex xhigh)
The first review pass (Claude/opus, deep adversarial) Approved by verifying the authz *gate*
(who can call the routes). A second independent cross-model pass (Codex, xhigh) caught a real
**Blocker the first pass missed**: it verified the *data* the gated methods expose. Verdict: **Bounce**.

### BLOCKER — cross-creator content disclosure + playback (confirmed against code)
The creator routes reuse the **admin-wide** orchestrator (`playout-orchestrator.ts`). Those methods
were built for admins, who legitimately see all content — so they apply **no creator scoping**:
- `searchAvailableContent(channelId, query)` (`playout-orchestrator.ts:719`) searches ALL `content`
  of `type='video'` across **every creator** — `c.creator_id` is selected but never constrained to
  the channel's creator, and there is no `visibility` / `publishedAt` / `deletedAt` filter. A creator
  using their Programming content-search would see every other creator's videos, including
  private/subscriber/unpublished.
- `assignContent(channelId, playoutItemIds, contentIds)` (`playout-orchestrator.ts:446`) inserts the
  caller-supplied `contentIds` into `channel_content` with **zero ownership/eligibility check** — a
  creator could assign another creator's content id and play it out.

This was safe as an admin-only surface; it becomes a cross-tenant leak the moment a creator can call it.

**Fix (grounded):** the scoping primitive already exists — `poolContentScope(channel)`
(`editorial-config.ts:58`) returns `{creatorId}` for creator channels vs `{allCreators: true}` for
platform. Wire it into the creator content path: creator-scoped `search`/`assign` must constrain to
`content.creatorId === channel.creatorId`, `deletedAt IS NULL`, and the creator's own
publish/visibility rules. Either add creator-scoped orchestrator methods, or pass the channel's
resolved scope into the existing methods and branch. Admin path keeps `{allCreators: true}` (unchanged).

### IMPORTANT — gate doesn't constrain channel `role`
`require-creator-channel-permission.ts` checks `ownership === "creator"` + non-null `creatorId` but
not `role`. (Codex's *specific* suggestion — require `role === "playout"` — is WRONG for this feature:
creator editorial channels are the persistent `live-ingest` channel, so that check would break the
whole surface. Reject that fix.) The valid underlying point: decide deliberately which creator
channel role(s) the editorial gate accepts and assert it. For the creator's single persistent
`live-ingest` channel the blast radius is small, but the gate should state its intent rather than
accept any creator-owned channel by omission.

### IMPORTANT — tests prove forwarding, not authorization
The route tests mock `requireCreatorPermission` wholesale, so they verify arg-forwarding, not the
real owner-only `manageStreaming` decision or real cross-creator membership denial — and they don't
cover the content-scope bug at all. Add tests using the real permission service (owner allowed;
editor/viewer denied; different-creator membership denied) AND cross-creator content
search/assign rejection (the Blocker's regression guard).

### NIT — missing input validators
Route params/query are raw `c.req.param()` / `c.req.query()` with no `validator("param"/"query")`
(SQL is parameterized, so not an injection vector, but it violates the platform boundary-validation
rule). Add param validators for `channelId`/`entryId` and a bounded query schema for `q`.

### Clean (both passes agree)
Every route is `requireAuth` + `requireCreatorChannelPermission("manageStreaming")`; creatorId is
resolved from the channel row (unspoofable); the SSE `content.playout-changed` filter is fail-closed
and requires matching `creatorIds`; the unwired publish path is non-functional, not insecure; admin
routes behaviorally unchanged.

## Fix (re-implementation)

All four findings resolved. The design keeps "one logic path, two gates": admin and creator
routes call the SAME orchestrator methods, and the content-pool scope is DERIVED FROM THE CHANNEL,
never from the caller. The admin (`{ allCreators: true }`) path is byte-equivalent to before — the
pre-existing admin route tests + orchestrator tests stay green with zero edits.

### 1. BLOCKER — cross-creator content disclosure + playback (fixed)
`poolContentScope(channel)` (`editorial-config.ts:58`) is now wired into the orchestrator's content
methods via a private `resolvePoolScope(channelId)` helper (`playout-orchestrator.ts`). The helper
loads the channel's `ownership`/`creatorId` by id (raw `db.execute` SELECT) and returns the existing
`PoolScope` descriptor: creator-owned → `{ creatorId }`, platform/admin (or an unloadable row) →
`{ allCreators: true }`.

- **`searchAvailableContent`**: for `{ creatorId }` scope the SQL is rebuilt to (a) **drop the
  `playout_items` UNION branch entirely** — creator pools are content-only — and (b) constrain the
  `content` branch with `AND c.creator_id = <scope.creatorId> AND c.deleted_at IS NULL`. The
  creator's own content is offered regardless of publish/visibility state (it's theirs, bound for
  their own channel — the leak guarded is specifically *other* creators' content). For
  `{ allCreators: true }` the query is reconstructed byte-for-byte (both branches, no creator
  filter) so admin behavior is unchanged.
- **`assignContent`**: for `{ creatorId }` scope it (a) rejects any `playoutItemIds` outright with a
  `ForbiddenError` (platform playout media is off-limits to creator pools — the content-only
  decision), and (b) validates every requested `contentId` with
  `SELECT id FROM content WHERE id = ANY(...) AND creator_id = scope.creatorId AND deleted_at IS NULL`;
  if any requested id is not in the owned set, returns `ForbiddenError` and writes nothing. For
  `{ allCreators: true }` the prior unconstrained insert runs unchanged.
- **`listContent` / `removeContent`**: confirmed already safe — both are bounded by
  `channel_content.channel_id = <channelId>`, so they only read/affect rows already in *this*
  channel's pool (which were gated at assign time). No change needed.

**playout_items in creator scope: excluded.** `poolContentScope` consumers treat playout items as
the platform's shared media library; a creator channel's pool is its own content only. So for
creator scope the search omits the playout branch and assign rejects playout-item ids. Admin scope
keeps playout items (the platform's library is legitimately theirs).

### 2. IMPORTANT — role gate (fixed)
`require-creator-channel-permission.ts` now asserts the channel `role` explicitly. Confirmed via
`ensureCreatorChannel` (`channels.ts:191`) that creator editorial channels are provisioned as
`ownership='creator'` / `role='live-ingest'`. The gate now requires
`role === "live-ingest"` (named `CREATOR_EDITORIAL_ROLE`) in addition to creator-ownership +
non-null creatorId; anything else → 404. **`role === "playout"` was NOT used** (Codex's suggestion)
because playout channels are platform-owned and that check would reject every legitimate creator
channel. The gate now states its accepted role intentionally rather than accepting any creator-owned
channel by omission.

### 3. IMPORTANT — tests prove authorization, not just forwarding (fixed)
- New `creator playout routes — real permission service` suite exercises the REAL
  `requireCreatorChannelPermission` + REAL `requireCreatorPermission` (real `CREATOR_ROLE_PERMISSIONS`)
  over a mocked membership/role DB layer: owner → 200; editor → 403; viewer → 403; member of a
  DIFFERENT creator → 403; admin platform-role → 200. (The forwarding suite that mocks
  `requireCreatorPermission` is retained for arg-forwarding coverage; `vi.doUnmock` isolates the real
  suite from it.)
- New `content pool scope (creator vs admin)` suite in `playout-orchestrator.test.ts` is the
  blocker's regression guard: a creator search emits ONLY its own content (other creators' ids
  absent, no playout branch); assigning another creator's content id → `ForbiddenError`, nothing
  inserted; assigning a platform playout item → `ForbiddenError`; assigning the creator's OWN content
  id → ok + inserted; admin scope unchanged (no creator filter, playout branch kept, no ownership
  check). **Verified these fail against the OLD unscoped orchestrator** (5/6 fail; the admin-unchanged
  one passes in both) and pass against the fix.
- New role-gate test: a creator-owned channel of role `playout` → 404. **Verified it returns 200
  against the OLD middleware** and 404 against the fix.

### 4. NIT — input validators (fixed)
Added hono-openapi `validator(...)` + zod to the creator routes: `ChannelIdParamSchema` /
`ChannelEntryParamSchema` (`validator("param", ...)`) for `channelId`/`entryId`, and a bounded
`ContentSearchQuerySchema` (`validator("query", ...)`, `q` length-capped) on the search route.
Handlers read `c.req.valid("param"|"query")`. Admin routes were left untouched (out of scope —
SQL is parameterized; not the vuln).

### Verification
`@snc/shared` 675 tests pass; `@snc/api` typecheck clean; full `@snc/api` unit suite 1834 tests pass
(115 files), including the admin orchestrator + admin route regression gates green with zero edits.
The cross-creator security tests are integration-adjacent but written unit-class (mocked DB layer) —
they run in the unit suite. A full real-DB integration pass (real creator membership + content rows)
would run via `scripts/dev/sandbox-test-integration.sh`.

## Review findings — BOUNCED again (cross-model re-review, Codex xhigh, round 2)
The first fix (`f0fd873`) closed search + assign + the role gate + the test gap (all verified
CLOSED). But the re-review caught the SAME leak class through a sibling door, plus a fail-open the
fix introduced. Verdict: **Bounce**.

### BLOCKER (NOT CLOSED) — queue insert bypasses pool scope
The fix scoped `searchAvailableContent` + `assignContent`, but the creator queue-insert route
(`creator-playout.routes.ts:99` → `insertIntoQueue`) was missed. `insertIntoQueue`
(`playout-orchestrator.ts:366`) takes a `playoutItemId` and validates ONLY that the playout_items
row exists (`:372-379`) — no creator scoping — then enqueues + prefetches for playback. A creator
owner who knows ANY platform/other-creator `playoutItemId` can queue and play it directly, bypassing
the now-scoped pool. Same cross-tenant class as the original blocker, different entry point.

**Fix:** for creator-scoped channels, a queue insert must reference an item **already in that
channel's (now creator-scoped) content pool** — make the pool the single chokepoint — rather than
accepting an arbitrary global `playoutItemId`. Reject (Forbidden/NotFound `Result`) a `playoutItemId`
that isn't a `channel_content` row for this channel. Admin path (`{allCreators:true}`) keeps today's
behavior. Add a creator `insertIntoQueue` cross-tenant-rejection regression test (must fail against
current code).

### IMPORTANT (NEW-ISSUE, introduced by the fix) — `resolvePoolScope` fails OPEN
`resolvePoolScope` (`playout-orchestrator.ts:146-151`) returns `{ allCreators: true }` when the
channel row isn't loaded. A missing / raced / bogus-id lookup therefore defaults to admin-wide
scope — the most-permissive scope is the failure default on a security boundary. The inline comment
("the route gate already proved ownership") doesn't hold: the helper is shared with the admin path,
and "no row" means the channel doesn't exist.

**Fix:** fail CLOSED — return/propagate `NotFoundError` (or the most-restrictive scope) when the
channel row is absent. Never default a security scope to `allCreators`.

### Confirmed CLOSED from round 1 (no regression)
- search + assign creator-scoped (`:824` search filter, `:500` assign ownership validation) — CLOSED.
- role gate asserts `live-ingest` (`require-creator-channel-permission.ts:31`) matching provisioning — CLOSED.
- tests wire the real permission service + orchestrator regression tests fail against unscoped code — CLOSED (gap: no creator queue-insert rejection test — add with the blocker fix).
- admin `{allCreators:true}` branch behaviorally unchanged; no SQL injection (Drizzle `sql` params) — CLOSED.
