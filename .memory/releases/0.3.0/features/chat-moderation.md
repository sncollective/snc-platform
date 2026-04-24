---
id: feature-chat-moderation
kind: feature
stage: done
tags: [streaming, community, admin-console]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-21
related_decisions: []
related_designs: []
parent: null
---

# Chat Moderation Tools

Server-enforced chat moderation: slow mode, timeouts, bans, and word filters. Moderation authority follows existing access patterns — platform admins (via `user_roles`) moderate the platform room, while channel rooms can be moderated by admins OR the channel's creator profile owner (via `creator_members` with `owner` role). No new permissions infrastructure required.

All enforcement is server-side. The frontend receives moderation events and adapts the UI accordingly (disabled inputs, status banners, moderator-only controls).

## Implementation Units

- [x] **Unit 1: Shared Protocol — Moderation Events and Schemas** — `packages/shared/src/chat.ts`: `SLOW_MODE_*` / `TIMEOUT_*` / `WORD_FILTER_*` constants; extend `ChatRoomSchema` with `slowModeSeconds`; `ModerationActionSchema`, `WordFilterSchema`; client event schemas (`ClientTimeoutEventSchema`, `ClientBanEventSchema`, `ClientUnbanEventSchema`, `ClientSetSlowModeEventSchema`) added to `ClientEventSchema` union; server event types (`ServerUserTimedOutEvent`, `ServerUserBannedEvent`, `ServerUserUnbannedEvent`, `ServerSlowModeChangedEvent`, `ServerMessageFilteredEvent`) added to `ServerEvent` union; REST query/response schemas for moderation history and word filters. Run `bun run --filter @snc/shared build` after.
- [x] **Unit 2: Database Schema — Moderation Tables** — `apps/api/src/db/schema/chat.schema.ts`: add `slowModeSeconds integer NOT NULL DEFAULT 0` to `chatRooms`; new `chat_moderation_actions` table (append-only audit log with `action`, `expiresAt`); new `chat_word_filters` table. Indexes: `(roomId, createdAt)` on actions, `(targetUserId, roomId)` on actions, `(roomId)` on filters. Run `bun run --filter @snc/api db:generate` then `bun run --filter @snc/api db:migrate`.
- [x] **Unit 3: Moderation Authorization Service** — `apps/api/src/services/chat-moderation-auth.ts`: `canModerateRoom(userId, roomId)` — platform rooms require `user_roles` admin; channel rooms require admin OR `creator_members` owner. `isUserBanned(userId, roomId)` — most recent ban/unban action, banned if last is `ban`. `isUserTimedOut(userId, roomId)` — most recent timeout action, timed out if `expiresAt > now()`.
- [x] **Unit 4: Chat Moderation Service** — `apps/api/src/services/chat-moderation.ts`: `timeoutUser`, `banUser` (idempotent), `unbanUser` (returns `NotFoundError` if not banned), `setSlowMode`, `getModerationHistory` (cursor-paginated), `getActiveSanctions`. Each mutation calls `canModerateRoom` first. Moderator cannot sanction themselves.
- [x] **Unit 5: Word Filter Service** — `apps/api/src/services/chat-word-filters.ts`: `addWordFilter` (validates regex via try/catch, max 100 per room, duplicate → `ConflictError`), `removeWordFilter`, `getWordFilters`, `isMessageFiltered` (plain-text case-insensitive substring + regex with `i` flag; regex wrapped in try/catch + pattern length guard for ReDoS defense).
- [x] **Unit 6: Message Creation — Enforce Moderation Rules** — `apps/api/src/services/chat.ts`: add four sequential checks before insert — banned (cheapest), timed out, slow mode rate limit, word filter. `MESSAGE_FILTERED` error code is distinct so the WS handler can send the targeted `message_filtered` event. Moderators exempt from slow mode and word filters but NOT from bans/timeouts.
- [x] **Unit 7: WebSocket Handler — Moderation Event Routing** — `apps/api/src/routes/chat.routes.ts`: new cases `timeout`, `ban`, `unban`, `set_slow_mode` in WS switch — each calls service + broadcasts to room on success or sends error to sender on failure. Update `message` case: `MESSAGE_FILTERED` error → `sendEvent(ws, { type: "message_filtered", ... })` (sender only, not broadcast). **Also on `join`:** after sending presence, call `canModerateRoom(userId, roomId)` and emit `ServerModeratorStatusEvent` (sender-only) so the client can reveal moderator-gated UI. Anonymous joiners get `isModerator: false`. Added 2026-04-20 via grounded revision during review — the original Unit 9 + 10 specs assumed `isModerator` would be populated but no corresponding server event was specified.
- [x] **Unit 8: REST Endpoints — Moderation Management** — `apps/api/src/routes/chat.routes.ts`: `GET /rooms/:roomId/moderation` (history, paginated), `GET /rooms/:roomId/moderation/active` (active sanctions), `GET /rooms/:roomId/filters` (list), `POST /rooms/:roomId/filters` (add), `DELETE /rooms/:roomId/filters/:filterId` (remove). Auth required; non-moderators → 403.
- [x] **Unit 9: Frontend — Chat Context Moderation State** — `apps/web/src/contexts/chat-context.tsx`: add `slowModeSeconds`, `isTimedOut`, `timedOutUntil`, `isBanned`, `lastFilteredAt`, `isModerator` to `ChatState`; add actions `timeoutUser`, `banUser`, `unbanUser`, `setSlowMode`; add reducer actions `SET_SLOW_MODE`, `SET_TIMED_OUT`, `SET_BANNED`, `MESSAGE_FILTERED`, `SET_MODERATOR`; handle all new server events in WS handler; reset on room change.
- [x] **Unit 10: Frontend — Moderation UI Controls** — `apps/web/src/components/chat/chat-moderation-panel.tsx` + `chat-user-actions.tsx` + updates to `chat-panel.tsx`: slow mode banner (all users when active), timeout banner (timed-out user), ban banner (banned user), filtered flash (3s auto-clear via `useEffect`), input disabled when `isTimedOut || isBanned`, `ChatModerationPanel` (slow mode slider; visible to moderators only), `ChatUserActions` context menu on message hover (timeout + ban with confirmation; moderators only). *Note: `chat-user-actions.tsx` hover-kebab replaced by `chat-user-card.tsx` click-username popover in child story `chat-moderation-user-card-popover` (2026-04-20).*
- [x] **Unit 11: Session Rehydration + Error Surfacing** — added 2026-04-20 via grounded revision (Pass 1 review Finding D). The feature's earlier units wired WS *broadcasts* for moderation changes but did not rehydrate state on WS connect / room (re-)join, and did not surface WS errors to the user. Consequences observed in Pass 1: a banned user who tabs away and returns loses the banner (even though the server still rejects their sends), a late joiner misses slow-mode indication, a slow-mode-rate-limited or banned sender has messages silently swallowed.

  **Server-side — [apps/api/src/routes/chat.routes.ts](../../apps/api/src/routes/chat.routes.ts):** extend the `join` handler, after `moderator_status` emission, to emit a new **`ServerRoomStateEvent`** carrying all rehydration data for the joining client:

  ```typescript
  type ServerRoomStateEvent = {
    readonly type: "room_state";
    readonly roomId: string;
    readonly slowModeSeconds: number;           // from chat_rooms.slow_mode_seconds
    readonly isBanned: boolean;                 // from isUserBanned(userId, roomId) — false for anonymous
    readonly banModeratorUserName: string | null;  // from most recent ban action, if isBanned
    readonly isTimedOut: boolean;               // from isUserTimedOut(userId, roomId) — false for anonymous
    readonly timedOutUntil: string | null;      // ISO8601 expiresAt, if isTimedOut
    readonly timeoutModeratorUserName: string | null;  // from most recent active timeout action, if isTimedOut
  };
  ```

  Add to `ServerEvent` discriminated union in `packages/shared/src/chat.ts`. Implementation: fetch room's `slowModeSeconds`, call existing `isUserBanned` + `isUserTimedOut` (already in `chat-moderation-auth.ts`); for metadata, look up most-recent `ban` and `timeout` actions in `chat_moderation_actions` if either flag is true. Emit **only to the joining client** via `sendEvent(ws, ...)` (not `broadcastToRoom`).

  **Client-side — [apps/web/src/contexts/chat-context.tsx](../../apps/web/src/contexts/chat-context.tsx):** handle `room_state` in the WS message switch by dispatching:
  - `SET_SLOW_MODE` with `seconds: data.slowModeSeconds`
  - `SET_BANNED` with `banned: data.isBanned` (scoped by `userIdRef.current === own` already implicit — server sent room-state only to this client)
  - `SET_TIMED_OUT` with `until: data.timedOutUntil` if `data.isTimedOut`, else a new `CLEAR_TIMED_OUT` action (or `SET_TIMED_OUT { until: null }`).

  **Client-side error surfacing:** the `error` WS event case currently swallows errors. Surface moderator-relevant errors to the user via the existing `toaster` singleton ([components/ui/toast.tsx](../../apps/web/src/components/ui/toast.tsx)) with `toaster.error({ title, description })`. Error codes worth surfacing: `USER_BANNED`, `USER_TIMED_OUT`, `SLOW_MODE_RATE_LIMIT`, `FORBIDDEN`, `NOT_FOUND`, `INVALID_MESSAGE`, `UNAUTHORIZED`. `MESSAGE_FILTERED` stays as its own flash path (already implemented via `message_filtered` event, not `error`). Use human-readable titles per error code (map not free-form).

  **Reset on room change:** the existing `SET_ACTIVE_ROOM` reducer case already resets state — verify it clears timeout/ban/slowMode state so a subsequent `room_state` event cleanly replaces. If not, extend.

  **No `/implement` work on Units 1-10 — those are verified done.** Agent's entire scope is Unit 11.

## Implementation Order

1. Unit 1 (shared protocol)
2. Unit 2 (DB schema)
3. Units 3 + 5 in parallel (auth service + word filter service — independent)
4. Unit 4 (moderation service — depends on Units 3 + 5)
5. Unit 6 (message creation enforcement — depends on Units 4 + 5)
6. Units 7 + 8 in parallel (WS handler + REST endpoints)
7. Units 9 + 10 sequential (context before components)
8. Unit 11 (rehydration + error surfacing — added Pass 1, depends on Units 1, 7, 9 all being shipped)

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
| 11 — Rehydration + Error Surfacing | Integration tests for `join` with (a) banned user, (b) timed-out user, (c) slow-mode room. Verify `room_state` event emitted with correct fields. Client unit tests: reducer handles `room_state` correctly; `error` WS events with the listed codes fire `toaster.error`; toaster is spied/mocked. |

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

---

## Review Pass 1 — 2026-04-20 (paused)

**Status:** `stage: review`, release_binding still `null`. **Not signed off** — pending Finding C's scoped UX redesign AND Finding D's rehydration / error-feedback implementation pass. User is pausing this review to explore the UI redesign independently before returning.

### Fixed in-flight and user-verified

- **F1 (rehydration gap, moderator-status-on-join)** — spec specified `SET_MODERATOR` reducer action and moderator-gated UI but nothing emitted the status. Added `ServerModeratorStatusEvent` to [chat.ts](../../packages/shared/src/chat.ts), emit from server `join` handler in [chat.routes.ts](../../apps/api/src/routes/chat.routes.ts), dispatch from client WS handler in [chat-context.tsx](../../apps/web/src/contexts/chat-context.tsx). Grounded-revised Unit 7 spec to capture this. User verified moderator controls now appear for Alex (admin) on Community / S/NC TV and for Maya on her own stream.
- **A — Slow-mode panel placement** — [chat-panel.tsx](../../apps/web/src/components/chat/chat-panel.tsx) rendered `ChatModerationPanel` below messages/input. Moved above messages, just after status banners. User verified.
- **B — Timeout/ban state scoping** — client WS handler dispatched `SET_TIMED_OUT` / `SET_BANNED` on any `user_timed_out` / `user_banned` broadcast, regardless of `targetUserId`. Added `data.targetUserId === userIdRef.current` check on all three (timeout/ban/unban). Also surfaced a related wire-up bug: [live.tsx](../../apps/web/src/routes/live.tsx) rendered `<ChatProvider>` without a `userId` prop, so `userIdRef.current` was always `null` (and `currentUserId` in reaction events too) — added `useSession()` + `userId={currentUserId}` threading. User verified: target sees banner, moderator doesn't.

### Parked to backlog during review

- [playout-channel-chat-room-provisioning](../../.memory/backlog/playout-channel-chat-room-provisioning.md) — S/NC Music has no row in `chat_rooms` (CRUD / backfill gap)
- [live-channel-chat-room-duplicates](../../.memory/backlog/live-channel-chat-room-duplicates.md) — `ensureLiveChannelWithChat` creates a new room on each stream restart for the same channel

### Blocking sign-off

- **Finding C — Moderator UX not passable.** Current hover-kebab-menu on each message is cramped and unfamiliar. User explicitly rejected the shape. Twitch / YouTube / Discord convention is: click a username → user card / popout with moderation actions. Missing pieces beyond the shape: no **unban** button in `ChatUserActions` (spec's `unbanUser` service is wired but never surfaced in UI), and no visible feedback to the moderator after an action succeeds (clicking "1 min" does nothing observable from Alex's side). **Scoped 2026-04-20** as child story [chat-moderation-user-card-popover](../stories/chat-moderation-user-card-popover.md) citing [live-streaming-ux-patterns.md §2.8 + §3.3](../../research/live-streaming-ux-patterns.md). Implementing on the child; this finding unblocks when the child lands.
- **Finding D — State rehydration + error feedback gaps.** Related to F1's shape: the spec underspecified how client state rehydrates from server truth on WS connect / room (re-)join, and how server errors surface to the user.
  - **D1 (server)** — on `join`, after moderator-status emission, also call `isUserBanned(userId, roomId)` and `isUserTimedOut(userId, roomId)` and emit targeted `user_banned` / `user_timed_out` events to the joining user if either is true. Without this, a banned user who tabs away and returns loses the banner even though the server still rejects their sends.
  - **D2 (client)** — `error` WS event case at [chat-context.tsx:260-262](../../apps/web/src/contexts/chat-context.tsx#L260-L262) says *"Errors are displayed by the UI — no dispatch needed"* but there is no UI surfacing errors. Send attempts by banned / timed-out users are silently swallowed. Surface error codes (`USER_BANNED`, `USER_TIMED_OUT`, `MESSAGE_FILTERED`, `SLOW_MODE_RATE_LIMIT`) to the user as a transient banner or toast.
  - **Resolution plan:** when the user returns after the UI redesign, flip feature back to `stage: implementing`, grounded-revise the spec (add an explicit Unit / addendum for WS state rehydration + error surfacing), run `/implement` to sweep the rehydration layer in one pass. Then re-run `/review`.

### Outstanding test gaps from spec AC

Spec's Testing table called for dedicated test files for Unit 4 (moderation service), Unit 7 (WS handler integration), and Unit 8 (REST endpoints route tests). Present: `chat-moderation-auth.test.ts`, `chat-word-filters.test.ts`. Missing: Unit 4, 7, 8 tests. Likely deferrable per the pattern established in this session (imgproxy + optional-image test deferrals), but the rehydration layer added in the D pass should be tested (specifically the state-restoration-on-join behavior).

---

## Pass 2 — 2026-04-20 (implementing → review)

Flipped back to `review` after Unit 11 (Session Rehydration + Error Surfacing) landed. Pass 2 scope was Finding D from Pass 1: state rehydration on WS connect/rejoin + WS error surfacing to the user.

### What landed in Pass 2

- **`ServerRoomStateEvent` added to shared protocol.** Sender-only event carrying `slowModeSeconds`, `isBanned` + `banModeratorUserName`, `isTimedOut` + `timedOutUntil` + `timeoutModeratorUserName`. Emitted on WS `join` after `moderator_status` — only to the joining client.
- **`getRoomState` service helper** extracted into [chat-moderation-auth.ts](../../apps/api/src/services/chat-moderation-auth.ts) following the thin-handler convention. Parallelizes `isUserBanned` + `isUserTimedOut` lookups, only fetches moderator metadata when either flag is true.
- **Client `room_state` handler** dispatches `SET_SLOW_MODE` + `SET_BANNED` + `SET_TIMED_OUT` (with `until: null` for the clear case; reducer derives `isTimedOut = until !== null`).
- **WS `error` surfacing via `toaster.error`** for a whitelisted set of codes: `USER_BANNED`, `USER_TIMED_OUT`, `SLOW_MODE_RATE_LIMIT`, `FORBIDDEN`, `NOT_FOUND`, `INVALID_MESSAGE`, `UNAUTHORIZED`. `MESSAGE_FILTERED` stays on its existing flash path (separate event).
- **`SET_ACTIVE_ROOM` reset** audit: already complete; resets slow-mode, timeout, ban, filter-flash, isModerator, reactions. No changes needed.

### Tests

- `@snc/api`: +5 tests on `getRoomState` (null room, anon, banned, timed-out, clean user). **1473 passing.**
- `@snc/web`: +9 tests covering `room_state` reducer sequence, `SET_ACTIVE_ROOM` reset, WS `error` toaster dispatch, whitelist filtering (MESSAGE_FILTERED does not toast). **1565 passing.**
- `@snc/shared`: 657 passing.
- Build: clean.

### Child story status

- `chat-moderation-user-card-popover` — `stage: review` (Pass 1 spawned it via `/scope`, `/implement` landed it). That story's Unit 10-replacement UI + Pass 2's rehydration layer are two independent parts of the same review cycle. User will acceptance-test both together.

### Ready for re-review

Feature is back at `stage: review`, null binding. User should re-run `/review chat-moderation` (or review child + parent separately) to verify:

- Pass 1 fix A/B/F1 still holds (slow-mode panel position, target-scoped dispatch, moderator-status on join).
- Pass 2 Unit 11: banned user tabs away and returns → banner re-appears; timed-out user reloads → banner re-appears; late joiner on slow-mode room → indicator shown; banned user's send attempt shows a toast error instead of silent swallow.
- Child story Unit 10 replacement: click-username → popover, unban surface visible on banned users, action toasts confirm moderator operations.
