---
id: feature-chat-moderation
kind: feature
stage: review
tags: [streaming, community, admin-console]
release_binding: null
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# Chat Moderation Tools

Server-enforced chat moderation: slow mode, timeouts, bans, and word filters. Moderation authority follows existing access patterns — platform admins (via `user_roles`) moderate the platform room, while channel rooms can be moderated by admins OR the channel's creator profile owner (via `creator_members` with `owner` role). No new permissions infrastructure required.

All enforcement is server-side. The frontend receives moderation events and adapts the UI accordingly (disabled inputs, status banners, moderator-only controls).

## Implementation Units

- [ ] **Unit 1: Shared Protocol — Moderation Events and Schemas** — `packages/shared/src/chat.ts`: `SLOW_MODE_*` / `TIMEOUT_*` / `WORD_FILTER_*` constants; extend `ChatRoomSchema` with `slowModeSeconds`; `ModerationActionSchema`, `WordFilterSchema`; client event schemas (`ClientTimeoutEventSchema`, `ClientBanEventSchema`, `ClientUnbanEventSchema`, `ClientSetSlowModeEventSchema`) added to `ClientEventSchema` union; server event types (`ServerUserTimedOutEvent`, `ServerUserBannedEvent`, `ServerUserUnbannedEvent`, `ServerSlowModeChangedEvent`, `ServerMessageFilteredEvent`) added to `ServerEvent` union; REST query/response schemas for moderation history and word filters. Run `bun run --filter @snc/shared build` after.
- [ ] **Unit 2: Database Schema — Moderation Tables** — `apps/api/src/db/schema/chat.schema.ts`: add `slowModeSeconds integer NOT NULL DEFAULT 0` to `chatRooms`; new `chat_moderation_actions` table (append-only audit log with `action`, `expiresAt`); new `chat_word_filters` table. Indexes: `(roomId, createdAt)` on actions, `(targetUserId, roomId)` on actions, `(roomId)` on filters. Run `bun run --filter @snc/api db:generate` then `bun run --filter @snc/api db:migrate`.
- [ ] **Unit 3: Moderation Authorization Service** — `apps/api/src/services/chat-moderation-auth.ts`: `canModerateRoom(userId, roomId)` — platform rooms require `user_roles` admin; channel rooms require admin OR `creator_members` owner. `isUserBanned(userId, roomId)` — most recent ban/unban action, banned if last is `ban`. `isUserTimedOut(userId, roomId)` — most recent timeout action, timed out if `expiresAt > now()`.
- [ ] **Unit 4: Chat Moderation Service** — `apps/api/src/services/chat-moderation.ts`: `timeoutUser`, `banUser` (idempotent), `unbanUser` (returns `NotFoundError` if not banned), `setSlowMode`, `getModerationHistory` (cursor-paginated), `getActiveSanctions`. Each mutation calls `canModerateRoom` first. Moderator cannot sanction themselves.
- [ ] **Unit 5: Word Filter Service** — `apps/api/src/services/chat-word-filters.ts`: `addWordFilter` (validates regex via try/catch, max 100 per room, duplicate → `ConflictError`), `removeWordFilter`, `getWordFilters`, `isMessageFiltered` (plain-text case-insensitive substring + regex with `i` flag; regex wrapped in try/catch + pattern length guard for ReDoS defense).
- [ ] **Unit 6: Message Creation — Enforce Moderation Rules** — `apps/api/src/services/chat.ts`: add four sequential checks before insert — banned (cheapest), timed out, slow mode rate limit, word filter. `MESSAGE_FILTERED` error code is distinct so the WS handler can send the targeted `message_filtered` event. Moderators exempt from slow mode and word filters but NOT from bans/timeouts.
- [ ] **Unit 7: WebSocket Handler — Moderation Event Routing** — `apps/api/src/routes/chat.routes.ts`: new cases `timeout`, `ban`, `unban`, `set_slow_mode` in WS switch — each calls service + broadcasts to room on success or sends error to sender on failure. Update `message` case: `MESSAGE_FILTERED` error → `sendEvent(ws, { type: "message_filtered", ... })` (sender only, not broadcast).
- [ ] **Unit 8: REST Endpoints — Moderation Management** — `apps/api/src/routes/chat.routes.ts`: `GET /rooms/:roomId/moderation` (history, paginated), `GET /rooms/:roomId/moderation/active` (active sanctions), `GET /rooms/:roomId/filters` (list), `POST /rooms/:roomId/filters` (add), `DELETE /rooms/:roomId/filters/:filterId` (remove). Auth required; non-moderators → 403.
- [ ] **Unit 9: Frontend — Chat Context Moderation State** — `apps/web/src/contexts/chat-context.tsx`: add `slowModeSeconds`, `isTimedOut`, `timedOutUntil`, `isBanned`, `lastFilteredAt`, `isModerator` to `ChatState`; add actions `timeoutUser`, `banUser`, `unbanUser`, `setSlowMode`; add reducer actions `SET_SLOW_MODE`, `SET_TIMED_OUT`, `SET_BANNED`, `MESSAGE_FILTERED`, `SET_MODERATOR`; handle all new server events in WS handler; reset on room change.
- [ ] **Unit 10: Frontend — Moderation UI Controls** — `apps/web/src/components/chat/chat-moderation-panel.tsx` + `chat-user-actions.tsx` + updates to `chat-panel.tsx`: slow mode banner (all users when active), timeout banner (timed-out user), ban banner (banned user), filtered flash (3s auto-clear via `useEffect`), input disabled when `isTimedOut || isBanned`, `ChatModerationPanel` (slow mode slider; visible to moderators only), `ChatUserActions` context menu on message hover (timeout + ban with confirmation; moderators only).

## Implementation Order

1. Unit 1 (shared protocol)
2. Unit 2 (DB schema)
3. Units 3 + 5 in parallel (auth service + word filter service — independent)
4. Unit 4 (moderation service — depends on Units 3 + 5)
5. Unit 6 (message creation enforcement — depends on Units 4 + 5)
6. Units 7 + 8 in parallel (WS handler + REST endpoints)
7. Units 9 + 10 sequential (context before components)

## Testing

| Unit | Approach |
|---|---|
| 1 — Shared Protocol | Parse valid/invalid through each schema; verify union rejects unknown types. `bun run --filter @snc/shared test` |
| 2 — DB Schema | Generate migration + apply; verify tables. |
| 3 — Moderation Auth | Unit tests with Drizzle mocks: admin/owner authorized; non-authorized → ForbiddenError; ban/timeout status. |
| 4 — Moderation Service | Unit tests: timeout/ban/unban records, setSlowMode, history pagination, active sanctions filter. |
| 5 — Word Filter Service | Add/remove filters, duplicate detection, regex validation, max count, `isMessageFiltered` plain + regex. |
| 6 — Message Creation | Banned blocked, timed-out blocked, slow mode, filtered, moderator exemption. |
| 7 — WS Handler | Integration via `app.request()` with WS upgrade; moderation events; `message_filtered` to sender only. |
| 8 — REST Endpoints | Route tests: happy path CRUD, 401, 403, 404. |
| 9 — Frontend Context | Reducer transitions; reset on room change. |
| 10 — Frontend UI | Panel renders only for moderators; banners for correct states; input disabled; flash auto-clears. |

## Verification Checklist

- [ ] `bun run --filter @snc/shared build` passes (types compile).
- [ ] `bun run --filter @snc/api db:generate` generates cleanly.
- [ ] `bun run --filter @snc/api db:migrate` applies without errors.
- [ ] `bun run --filter @snc/shared test` passes.
- [ ] `bun run --filter @snc/api test:unit` passes.
- [ ] `bun run --filter @snc/web test` passes.
- [ ] `bun run --filter @snc/api build` passes.
- [ ] `bun run --filter @snc/web build` passes.
- [ ] E2E smoke test passes (`bun run --filter @snc/e2e test`).
