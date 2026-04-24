---
id: story-security-chat-moderation-rest-role-check
kind: story
stage: done
tags: [security, community]
release_binding: 0.3.0
created: 2026-04-24
updated: 2026-04-24
related_decisions: []
related_designs: []
parent: null
---

Surfaced by the 0.3.0 security-gate scan (api/routes+middleware). **S1** — auth bypass on moderation.

The REST moderation endpoints in [chat.routes.ts](../../apps/api/src/routes/chat.routes.ts):

- `GET /rooms/:roomId/moderation`
- `GET /rooms/:roomId/moderation/active`
- `GET /rooms/:roomId/filters`
- `POST /rooms/:roomId/filters`
- `DELETE /rooms/:roomId/filters/:filterId`

Use `optionalAuth` + a manual `if (!user) throw ...` null check, but perform **no role or moderator-permission check**. Any authenticated user — including a brand-new account — can list bans, inspect moderation history, add word filters, or remove word filters in any chat room.

The WebSocket moderation path (used by the in-app moderation UI) correctly gates each action via `canModerateRoom()` from [chat-moderation-auth.ts](../../apps/api/src/services/chat-moderation-auth.ts). The REST surface never acquired the same gate.

## What changes

1. Replace `optionalAuth` + manual null-check with `requireAuth` middleware on all 5 moderation REST routes.
2. Before each handler's main logic, call `canModerateRoom(userId, roomId, roles)`; throw `ForbiddenError` if the check fails.
3. Match the existing WS handler's pattern exactly — don't invent a second permission path.

## Tasks

- [ ] Swap `optionalAuth` → `requireAuth` on the 5 listed routes.
- [ ] Add `canModerateRoom` check at the top of each handler.
- [ ] Update route tests — the existing "unauthed → 401" assertions should still hold; add "authed but non-moderator → 403" coverage for each route.

## Verification

- Route tests (existing + new) green.
- Manual: log in as a non-moderator account; `curl` each endpoint; expect 403.

## Risks

Low. The routes are already using the same `chatModerationActions` / `chatWordFilters` tables and return-shapes as the WS path; the gating logic is already implemented in `canModerateRoom`. Existing admin users with moderator status pass the check as before.
