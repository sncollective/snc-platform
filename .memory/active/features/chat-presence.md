---
id: feature-chat-presence
kind: feature
stage: review
tags: [streaming, community]
release_binding: null
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# Chat Presence / Viewer List

Add presence awareness to the WebSocket chat system: viewer count, authenticated user list, and join/leave notifications. Anonymous users contribute to the viewer count but do not appear in the user list. Multi-tab users (same `userId` with multiple connections) appear once in the user list but each connection counts toward `viewerCount`.

The existing `chat-rooms.ts` already tracks `ChatClient` objects per room with `userId`, `userName`, and `avatarUrl`. Presence is derived from this data — no new persistence layer needed.

## Implementation Units

- [ ] **Unit 1: Shared Presence Types** — `packages/shared/src/chat.ts`: `PresenceUser`, `RoomPresence`, `ServerPresenceEvent`, `ServerUserJoinedEvent`, `ServerUserLeftEvent`; extend `ServerEvent` union. Run `bun run --filter @snc/shared build` after.
- [ ] **Unit 2: Backend Presence Helpers** — `apps/api/src/services/chat-rooms.ts`: `getRoomPresence`, `hasOtherConnections`, `getClientRooms`. Pure functions, testable in isolation.
- [ ] **Unit 3: Broadcast Presence on Join/Leave** — update `joinRoom`, `leaveRoom`, `leaveAllRooms` to broadcast `user_joined`, `user_left`, and `presence` events. Join checks new-user flag BEFORE adding to set; leave checks AFTER removing.
- [ ] **Unit 4: Send Initial Presence on Join** — `apps/api/src/routes/chat.routes.ts`: in the `join` case, after `joinRoom()`, send a targeted `presence` event to the joining client with current viewer count and user list (alongside existing history send).
- [ ] **Unit 5: Frontend State and Reducer** — `apps/web/src/contexts/chat-context.tsx`: add `viewerCount` and `users` to `ChatState`; add `SET_PRESENCE`, `USER_JOINED`, `USER_LEFT` reducer actions; handle `presence`, `user_joined`, `user_left` WS events; reset presence on `SET_ACTIVE_ROOM`.
- [ ] **Unit 6: Viewer Count Display** — `apps/web/src/components/chat/chat-panel.tsx` + `.module.css`: `viewerCount` span in tab bar with `margin-left: auto`, using design tokens.
- [ ] **Unit 7: Collapsible User List** — `apps/web/src/components/chat/chat-panel.tsx` + `.module.css`: toggle button with `aria-expanded`, scrollable user list (max 120px), renders only when `users.length > 0`.

## Implementation Order

1. Unit 1 — Shared types (backend + frontend depend on them). `bun run --filter @snc/shared build` after.
2. Unit 2 — Backend presence helpers. Pure functions, testable in isolation.
3. Unit 3 — Broadcast integration (depends on Unit 2).
4. Unit 4 — Route sends initial presence on join (depends on Units 1–3).
5. Unit 5 — Frontend reducer and WS handler (depends on Unit 1).
6. Unit 6 — Viewer count UI (depends on Unit 5).
7. Unit 7 — User list UI (depends on Unit 5).

Units 5–7 (frontend) can be developed in parallel with Units 2–4 (backend) after Unit 1 is complete.

## Testing

**API unit tests** (`apps/api/tests/services/chat-rooms.test.ts`):
- `getRoomPresence` — empty room, single user, multi-tab same user, mixed auth/anon.
- `hasOtherConnections` — true/false cases.
- `joinRoom` — broadcasts `user_joined` for new auth user; skips for anon; skips for second tab.
- `leaveRoom` — broadcasts `user_left` on last connection; skips when other tabs remain.
- `leaveAllRooms` — broadcasts presence to all rooms the client was in.

**Web unit tests** (`apps/web/tests/contexts/chat-context.test.ts`):
- `SET_PRESENCE`, `USER_JOINED`, `USER_LEFT`, `SET_ACTIVE_ROOM` reducer cases.

## Verification Checklist

- [ ] `bun run --filter @snc/shared build` passes with new types.
- [ ] `bun run --filter @snc/api test:unit` passes.
- [ ] `bun run --filter @snc/web test` passes.
- [ ] Joining a room displays current viewer count and user list.
- [ ] Opening a second tab increments viewer count but does not duplicate the user in the list.
- [ ] Closing all tabs for a user broadcasts `user_left` and decrements viewer count.
- [ ] Anonymous users increment viewer count but do not appear in user list.
- [ ] User list toggle is accessible (`aria-expanded`).
- [ ] No layout shift in chat panel header when viewer count changes.
- [ ] Room switch resets presence state before new room data arrives.
