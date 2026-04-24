---
id: feature-community-notifications
kind: feature
stage: done
tags: [community, content, calendar]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# Community Notifications

Tab bar notification badges + "Remind Me" event wiring. Extends the `notifications` infrastructure in this release.

## Tasks

- [x] Tab bar notification badge dot — `useNotificationCount()` in `bottom-tab-bar.tsx`
- [x] "Remind Me" — DB + shared types — `event_reminders` table, `event_reminder` notification type, Migration 0022
- [x] "Remind Me" — API endpoint — `POST /api/events/:eventId/remind` toggle + `GET /api/events/upcoming` enrichment
- [x] "Remind Me" — event card UI
- [x] "Remind Me" — landing page wiring
- [x] "Remind Me" — reminder dispatch job — `setInterval` cron (5min), 15min-before-event, dedup

---

## Design

Two notification features that extend the existing `notifications` infrastructure in this release.

### Existing infrastructure

- **NotificationProvider** (`contexts/notification-context.tsx`) — WebSocket-backed unread count, mounted at root with `userId` from auth state. `useNotificationCount()` hook returns live count.
- **NotificationBell** (`components/notification-bell.tsx`) — renders badge with count (clamps 99+), Ark Popover dropdown, calls `useNotifications()` for inbox actions.
- **Notification inbox API** — `GET /api/notifications` (paginated), `GET /api/notifications/unread-count`, `PATCH /api/notifications/:id/read`, `POST /api/notifications/read-all`.
- **Inbox notification types** — `go_live`, `subscription_welcome`, `new_content`, `system`.
- **Database** — `inbox_notifications` table (userId, type, title, body, actionUrl, read, createdAt).

---

### Feature 1: Tab bar notification badges

Show a notification badge dot on the bottom tab bar when the user has unread notifications. Mobile-only (tab bar is hidden on desktop where the header bell is visible).

**Design decisions:**

- **Which tabs get a badge?** Only a generic dot on the first tab (Home) — notifications aren't tab-specific yet. A single dot signals "you have unread notifications" and mirrors the header bell.
- **Dot vs count?** Dot only. The tab bar has limited space (icon + label), and the count is already visible in the header bell.
- **Auth gating?** `useNotificationCount()` already returns 0 when not authenticated (provider doesn't connect WS without userId). No additional gating needed.

**Unit 1: Badge dot component + CSS**

**Files:** `components/layout/bottom-tab-bar.tsx`, `bottom-tab-bar.module.css`

- Import `useNotificationCount` from `contexts/notification-context.tsx`
- Call `useNotificationCount()` at component top level
- On the Home tab item, render a badge dot when count > 0:
  ```tsx
  <Link ...>
    <div className={styles.tabIconWrapper}>
      <Icon size={20} />
      {isHomeTab && unreadCount > 0 && <span className={styles.badge} />}
    </div>
    <span className={styles.tabLabel}>{label}</span>
  </Link>
  ```
- CSS for `.tabIconWrapper`: `position: relative; display: inline-flex`
- CSS for `.badge`: `position: absolute; top: -2px; right: -4px; width: 8px; height: 8px; border-radius: 50%; background: var(--color-accent); pointer-events: none`

Tests (2): badge dot renders when unread count > 0; badge dot hidden when unread count is 0.

---

### Feature 2: "Remind Me" notification wiring

Enable the disabled bell button on landing page event cards. Authenticated users can tap to receive an in-app notification before the event starts.

**Design decisions:**

- **New notification type?** Yes — add `event_reminder` to `INBOX_NOTIFICATION_TYPES`. Distinct from `go_live` (which fires when a stream starts). Event reminders are user-initiated per-event opt-ins.
- **Data model?** New `event_reminders` table: `(userId, eventId) → unique`. No separate preferences matrix — the act of clicking "Remind Me" IS the preference. Clicking again removes the reminder (toggle).
- **When does the reminder fire?** A pg-boss scheduled job checks for events starting in the next 15 minutes and creates inbox notifications for users with reminders set. Cron job, not a real-time trigger.
- **Unauthenticated users?** Show the button but redirect to login on click (with return URL to landing page).
- **API surface:**
  - `POST /api/events/:eventId/remind` — toggle reminder (creates or deletes). Returns `{ reminded: boolean }`. Requires auth.
  - `GET /api/events/upcoming` — extend response to include `reminded: boolean` when authenticated (false for unauthenticated).

**Unit 1: Database + shared types**

**Files:** `apps/api/src/db/schema/event-reminder.schema.ts` (new), `packages/shared/src/notification-inbox.ts`, `packages/shared/src/calendar.ts`

- New `eventReminders` table:
  ```typescript
  export const eventReminders = pgTable("event_reminders", {
    userId: text("user_id").notNull(),
    eventId: text("event_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  }, (t) => [
    primaryKey({ columns: [t.userId, t.eventId] }),
  ]);
  ```
- Add `"event_reminder"` to `INBOX_NOTIFICATION_TYPES` in shared
- Add `reminded: z.boolean()` to `UpcomingEventSchema` (optional, defaults false)
- Generate migration with `bun run --filter @snc/api db:generate`

**Unit 2: API endpoint**

**Files:** `apps/api/src/routes/upcoming-events.routes.ts` (extend), `apps/api/src/services/event-reminder.ts` (new)

- New service `event-reminder.ts`:
  - `toggleReminder(userId, eventId): Promise<Result<{ reminded: boolean }>>` — insert or delete from `eventReminders`, return new state
  - `getUserReminders(userId, eventIds): Promise<Set<string>>` — batch lookup for loader enrichment
- New route `POST /api/events/:eventId/remind` — requires auth, calls `toggleReminder`
- Extend `GET /api/events/upcoming` — when auth context present, join `eventReminders` to include `reminded` boolean per event. When no auth, all events have `reminded: false`.

**Unit 3: Event card UI**

**Files:** `components/landing/event-card.tsx`, `event-card.module.css`

- Add `reminded: boolean` and `onToggleRemind?: () => void` to `EventCardProps`
- Replace disabled button with active button:
  - Unauthenticated: `onClick` navigates to login with redirect
  - Authenticated + not reminded: bell outline icon, calls `onToggleRemind`
  - Authenticated + reminded: filled bell icon, accent color, calls `onToggleRemind`
- CSS: remove `opacity: 0.5` and `cursor: not-allowed` from `.remindButton`, add `.reminded` variant
- Loading state: disable button during API call

**Unit 4: Landing page wiring**

**Files:** `routes/index.tsx`, `components/landing/coming-up.tsx`

- Update loader: pass auth cookie to `/api/events/upcoming` so `reminded` state is included for authenticated users
- `ComingUp` receives `events` with `reminded` field
- `ComingUp` manages remind toggle state locally (optimistic update on the array) and calls `apiMutate` to `POST /api/events/:eventId/remind`
- Pass `reminded` and `onToggleRemind` callback to each `EventCard`

**Unit 5: Reminder dispatch job**

**Files:** `apps/api/src/jobs/handlers/event-reminder.ts` (new), `apps/api/src/jobs/index.ts`

- New pg-boss cron job: `event-reminder-dispatch`, runs every 5 minutes
- Handler: query `eventReminders` joined with `calendar_events` where `startAt` is within the next 15 minutes and no inbox notification already sent for this (userId, eventId) pair
- For each match: call `createNotification()` with type `event_reminder`, title derived from event, actionUrl to the event/calendar page
- Deduplicate: check `inbox_notifications` for existing `event_reminder` with matching `actionUrl` before creating

Tests: handler unit test with mocked DB + `createNotification`.
