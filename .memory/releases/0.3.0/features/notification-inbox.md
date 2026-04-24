---
id: feature-notification-inbox
kind: feature
stage: done
tags: [community, content]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-22
related_decisions: []
related_designs: []
parent: null
---

# In-App Notification Inbox

**Reviewed 2026-04-22.** Seeded demo notifications for Pat (4 unread, 12 total after top-up) and walked the happy path — bell badge, dropdown open, scrollbar past ~7 items, click-to-mark-read + navigate, mark-all-read, WebSocket count updates all work.

Two fix-in-flight findings surfaced and resolved:

1. **Dropdown bounced on page scroll.** The Ark UI Popover defaulted to `strategy: "absolute"`, positioning relative to the document. With the trigger inside the sticky nav, the positioner's document-space coordinates drifted as the page scrolled while floating-ui's `autoUpdate` lagged the recompute. Added `strategy: "fixed"` to the `positioning` prop at [notification-bell.tsx:42](platform/apps/web/src/components/notification-bell.tsx#L42) so the popover sits in viewport coords matching the sticky trigger.

2. **Dropdown rendered behind the nav bar (z-order).** Zag-JS's Popper applies `z-index: var(--z-index)` as an **inline style** on the positioner, which beat our `.positioner { z-index: var(--z-popover) }` class. The same issue was already solved on `menu.module.css` with `!important`; applied the same pattern at [popover.module.css:1-7](platform/apps/web/src/components/ui/popover.module.css#L1-L7) — `z-index: var(--z-popover) !important`. Applies across all Popover usages, not just notification-bell.

In-app notification system decoupled from chat. Notifications are stored in a database table and fetched via paginated REST API. The frontend polls on page load and periodic refresh. When the chat WebSocket is connected, the server pushes a lightweight `notification_count` event so the unread badge updates instantly without dedicated notification WebSocket infrastructure.

**Integration with notification dispatch:** `dispatchNotification()` should also create an `inbox_notifications` entry and push the WS nudge when a notification is dispatched. The inbox table is complementary to `notification_jobs` (which tracks email delivery state), not a replacement.

The key integration point is a userId-to-WebSocket-client index in the chat-rooms module. Currently `chat-rooms.ts` tracks clients by room membership only. This design adds a parallel `connectedUsers` map so the notification service can push count updates to any connected user without knowing which rooms they are in.

## Implementation Units

- [ ] **Unit 1: Shared Notification Inbox Types** — `packages/shared/src/notification-inbox.ts`: `INBOX_NOTIFICATION_TYPES`, `InboxNotificationType`, `InboxNotificationSchema`, `InboxNotificationsResponseSchema`, `InboxNotificationsQuerySchema`, `UnreadCountResponseSchema`. Re-export from `packages/shared/src/index.ts`. Build shared package after.
- [ ] **Unit 2: WebSocket Notification Count Event** — `packages/shared/src/chat.ts`: add `ServerNotificationCountEvent` (`type: "notification_count"`, `count: number`) to `ServerEvent` union.
- [ ] **Unit 3: Database Schema — Inbox Notifications** — `apps/api/src/db/schema/notification-inbox.schema.ts`: `inbox_notifications` table with `id`, `userId`, `type`, `title`, `body`, `actionUrl`, `read`, `createdAt`. Composite indexes: `(userId, read, createdAt)` and `(userId, createdAt)`. Run `bun run --filter @snc/api db:generate` then `bun run --filter @snc/api db:migrate`.
- [ ] **Unit 4: Connected Users Index** — `apps/api/src/services/chat-rooms.ts`: `connectedUsers` map (`userId → Set<ChatClient>`), `registerClient`, `unregisterClient`, `sendToUser`, `isUserConnected`. Anonymous clients are no-ops.
- [ ] **Unit 5: WebSocket Lifecycle Integration** — `apps/api/src/routes/chat.routes.ts`: call `registerClient` in `onOpen` (after ws patch), `unregisterClient` in `onClose`.
- [ ] **Unit 6: Notification Inbox Service** — `apps/api/src/services/notification-inbox.ts`: `createNotification`, `getNotifications` (cursor-paginated, `before` timestamp), `getUnreadCount`, `markRead` (idempotent, scoped to userId), `markAllRead`. `pushUnreadCount` is fire-and-forget (`void`). Pagination follows the `limit + 1` / `hasMore` pattern.
- [ ] **Unit 7: REST API Routes** — `apps/api/src/routes/notification-inbox.routes.ts`: `GET /` (paginated list), `GET /unread-count`, `PATCH /:id/read`, `POST /read-all`. All require auth. OpenAPI descriptions present.
- [ ] **Unit 8: Route Registration** — `apps/api/src/app.ts`: `app.route("/api/notifications", notificationInboxRoutes)`. No feature flag.
- [ ] **Unit 9: Frontend WebSocket Handler Update** — `apps/web/src/contexts/chat-context.tsx`: add `notificationCount: number` to `ChatState` (initial 0); add `SET_NOTIFICATION_COUNT` action; handle `notification_count` WS event.
- [ ] **Unit 10: Notification Bell Component** — `apps/web/src/components/notification-bell.tsx`: reads `notificationCount` from `useChat().state`; on dropdown open fetches `GET /api/notifications?limit=10`; click marks read + navigates to `actionUrl`; "Mark all read" button; badge capped at `99+`; on initial page load fetches `GET /api/notifications/unread-count` once to seed count.
- [ ] **Unit 11: Notification Bell Styles** — `apps/web/src/components/notification-bell.module.css`: `.bell`, `.badge`, `.dropdown`, `.notificationItem`, `.notificationItem.unread`, `.markAllRead`, `.emptyState`. Design tokens, badge pill, scrollable dropdown.

## Implementation Order

1. Units 1 + 2 (shared types + WS event) — no dependencies.
2. Units 3 + 4 in parallel — DB schema depends on Unit 1; connected users index is independent.
3. Unit 5 (WS lifecycle) — depends on Unit 4.
4. Unit 6 (inbox service) — depends on Units 1, 3, 4.
5. Units 7 + 8 (routes + registration) — depends on Unit 6.
6. Unit 9 (frontend WS handler) — depends on Unit 2.
7. Units 10 + 11 (bell component + styles) — depends on Units 7 and 9.

## Testing

**Service tests** (`apps/api/tests/services/notification-inbox.test.ts`): `createNotification`, `getNotifications` (paginated + cursor), `getUnreadCount`, `markRead` (idempotent), `markAllRead`, `pushUnreadCount` (mock `sendToUser`).

**Route tests** (`apps/api/tests/routes/notification-inbox.routes.test.ts`): happy path for all 4 endpoints; 401 when unauthenticated.

**Chat-rooms tests** (`apps/api/tests/services/chat-rooms.test.ts`): `registerClient`, `unregisterClient`, `sendToUser` (all clients for userId), no-op for unknown/anonymous.

**Frontend tests** (`apps/web/tests/contexts/chat-context.test.ts`): `SET_NOTIFICATION_COUNT` reducer action; `notification_count` WS event dispatch.

## Verification Checklist

- [ ] `bun run --filter @snc/shared build` passes.
- [ ] `bun run --filter @snc/api test:unit` passes.
- [ ] `bun run --filter @snc/web test` passes.
- [ ] `bun run --filter @snc/api db:generate` generates cleanly.
- [ ] `bun run --filter @snc/api db:migrate` applies.
- [ ] `GET /api/notifications` returns paginated results for authenticated user.
- [ ] `GET /api/notifications/unread-count` returns correct count.
- [ ] `PATCH /api/notifications/:id/read` marks notification read and pushes WS update.
- [ ] `POST /api/notifications/read-all` marks all read and pushes WS update.
- [ ] Creating a notification pushes `notification_count` to connected user via WS.
- [ ] Notification bell shows unread count badge.
- [ ] Clicking a notification marks it read and navigates to action URL.
- [ ] E2E golden path still passes (`bun run --filter @snc/e2e test`).
