---
id: unified-channel-model-creator-enablement-api-gate
kind: story
stage: implementing
tags: [streaming, playout, identity]
parent: unified-channel-model-creator-enablement
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-21
updated: 2026-06-21
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
