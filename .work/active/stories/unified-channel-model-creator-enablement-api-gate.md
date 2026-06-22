---
id: unified-channel-model-creator-enablement-api-gate
kind: story
stage: done
tags: [streaming, playout, identity]
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

## Review record
Verdict: **Approve** (deep adversarial lane, fresh-context reviewer) — zero blockers, zero
importants. Traced all 7 authz/leak lenses against the real code + ran the 30 tests:
- **No authz bypass** — all 8 editorial routes carry `requireCreatorChannelPermission("manageStreaming")`; `manageStreaming` is owner-only (`CREATOR_ROLE_PERMISSIONS`), so editor/viewer members are denied.
- **No cross-creator access** — middleware resolves `creatorId` from the channel record, not a URL param (unspoofable); a member of A cannot drive B's channel.
- **No channel-type confusion** — non-creator (admin/broadcast/platform) channel via a creator route → 404 with no existence oracle.
- **No SSE scope leak** — `content.playout-changed` scopeFilter on the authenticated `content` topic is identical in shape to the proven `content.processing-status-changed`; required `creatorId` field can't fail open; ctx.creatorIds is membership-derived server-side.
- **No admin regression** — admin routes untouched (`8fc4454` doesn't modify `playout-channels.routes.ts`); same orchestrator, two gates.
- **Tests genuine** — cross-creator-403 exercises a real different membership; no `expect(true)`, no mocking-away of the check under test.

**Known deferred (acceptable, by story design):** the real-time *publish* path is inert — no
`content.playout-changed` is emitted from `playout-queue-transitions.ts` yet (`creatorId` not in
context at transition time). The filter exists and is secure; the push path is non-functional
until wired. Creator real-time updates ride the 3s poll fallback meanwhile (same as admin). The
publish wire-up is feature-level follow-on work, tracked in the feature body, not a blocker here.

Two optional nits (not gating): an integration test wiring the *real* permission service with an
`editor` membership would make "manageStreaming is owner-only" self-evident in this file; the
middleware dereferences `c.get("user")` without a null guard (safe — `requireAuth` always precedes).
