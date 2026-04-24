---
id: story-admin-manage-stream-keys-simulcast
kind: story
stage: review
tags: [streaming, access]
release_binding: 0.3.1
created: 2026-04-24
updated: 2026-04-24
related_decisions: []
related_designs: []
parent: null
---

# Admin can manage stream keys + simulcast for any creator

Prod triage 2026-04-24 (0.3.0 live). Admin user hit `/creators/<id>/manage/streaming` for a creator they don't own and got "Failed to load stream keys — only creator can manage stream keys or simulcast destinations." Admins need to manage these on behalf of creators (at least until delegation UX catches up), same as admins manage most other creator-scoped routes via the shared permission check.

Root cause: stream-keys and simulcast services had their own hardcoded `requireOwner()` helpers that queried `creator_members` for `role === "owner"` — bypassing `checkCreatorPermission`, which already has the admin bypass used by every other creator-scoped write path (e.g., `creator-events.routes.ts`). Owner-only was an earlier defensive posture that predates the admin role model; it shipped without getting migrated when the shared permission flow landed.

Fix: replace the per-service `requireOwner` with `checkCreatorPermission(userId, creatorId, "manageStreaming", userRoles)` — a new permission in the shared matrix. The shared check short-circuits for `admin` platform role and otherwise consults the role matrix. Route handlers thread `getRoles(c)` through, matching the creator-events pattern.

Also adds `manageStreaming: false` for `editor` and `viewer`. Preserves the current semantic that only owners (and now admins) manage stream keys and simulcast — editors do not gain access as a side effect of this fix. That decision can be reopened independently if editor-team streaming management becomes a requirement.

## Scope

- [x] Add `manageStreaming` permission to `CREATOR_ROLE_PERMISSIONS` matrix (`packages/shared/src/creator.ts`).
  - owner: true, editor: false, viewer: false.
- [x] Replace `requireOwner` in `services/stream-keys.ts` with `requireStreamKeyAccess` that delegates to `checkCreatorPermission`. Thread `userRoles?: string[]` through `createStreamKey`, `listStreamKeys`, `revokeStreamKey`.
- [x] Replace `requireOwner` in `services/simulcast.ts` with `requireSimulcastAccess` — same pattern. Thread `userRoles` through all 4 creator-scoped functions.
- [x] Add `getRoles(c)` helper in `routes/streaming.routes.ts` and thread through the 7 creator-scoped route handlers.
- [x] Update route OpenAPI descriptions from "owner only" → "owner or platform admin".
- [x] Update existing service tests (`stream-keys.test.ts`) to mock `checkCreatorPermission` at module level.
- [x] Add admin-bypass test for stream-keys service.
- [x] Update route tests (`streaming.routes.test.ts`) to include roles in `toHaveBeenCalledWith` assertions.
- [x] Web side needs no change — `routes/creators/$creatorId/manage/streaming.tsx:90` already computes `isOwner = isAdmin || memberRole === "owner"`. API rejection was what surfaced the error.
- [x] API unit tests 1498/1498 green. Shared tests 657/657 green.
- [ ] User acceptance in prod: as admin, load Animal Future's streaming manage page. Stream keys should list; simulcast destinations should list; activate/deactivate/create/delete should succeed.

## Risks

- Permission matrix lives in `@snc/shared` which is consumed by both API and web. A stale build of shared in prod deployment could leave the matrix missing `manageStreaming`. Mitigation: shared uses direct TS source imports (`"main": "./src/index.ts"`), no pre-build step — so on first prod boot after deploy the matrix is live.
- Editor role explicitly does NOT gain streaming management. If this is a gap we want to close, it's a separate permission-matrix revision (propose: editor `manageStreaming: true` once team-member streaming setup is a use case we want to support). Parked here rather than changed silently.

## Revisit if

- Additional creator roles are introduced (e.g., `producer`, `engineer`) — revisit whether `manageStreaming` should apply.
- Stream keys gain per-key scoping (e.g., a key tied to an event or a co-host) that needs finer authz than creator-level — revisit the permission grain.
- An admin-audit or admin-actions log becomes a requirement; admin-elevation on creator-scoped resources should record who acted on whose behalf.
