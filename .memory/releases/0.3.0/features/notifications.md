---
id: feature-notifications
kind: feature
stage: done
tags: [community, content, streaming]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# Notifications

> Dispatch verified in logs; email delivery needs SMTP in prod. Subscribe flow needs prod testing (subscription flag off in dev).

## Sub-units (all done)

- [x] `creator_follows` table + follow/unfollow service
- [x] Notification preferences schema + API
- [x] Notification jobs + dispatch + worker *(dispatch verified in logs; email delivery needs SMTP in prod)*
- [x] Go-live integration *(verified via live stream test)*
- [x] Follow button + creator header
- [x] Subscribe flow update *(needs prod testing — subscription flag off in dev)*

## Deferred

Notification preferences UI nav link → `backlog/notification-preferences-ui-nav-link.md`

## Overview

Full notification pipeline: creator follows, audience resolution, notification preferences, job dispatch, background worker, email templates, go-live integration, and user-facing UI (follow button, subscribe flow update, preferences page).

Runs inside the existing API server's pg-boss infrastructure alongside media processing workers.

---

## Implementation Units

### Unit 1: Shared Notification Types

**File**: `packages/shared/src/notification.ts`

```typescript
import { z } from "zod";

export const NOTIFICATION_EVENT_TYPES = ["go_live", "new_content"] as const;
export const NOTIFICATION_CHANNELS = ["email"] as const;
export const NOTIFICATION_JOB_STATUSES = ["pending", "sent", "failed"] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export type NotificationJobStatus = (typeof NOTIFICATION_JOB_STATUSES)[number];

export const NotificationEventTypeSchema = z.enum(NOTIFICATION_EVENT_TYPES);
export const NotificationChannelSchema = z.enum(NOTIFICATION_CHANNELS);

export const NotificationPreferenceSchema = z.object({
  eventType: NotificationEventTypeSchema,
  channel: NotificationChannelSchema,
  enabled: z.boolean(),
});

export const NotificationPreferencesResponseSchema = z.object({
  preferences: z.array(NotificationPreferenceSchema),
});

export const UpdateNotificationPreferenceSchema = z.object({
  eventType: NotificationEventTypeSchema,
  channel: NotificationChannelSchema,
  enabled: z.boolean(),
});

export type NotificationPreference = z.infer<typeof NotificationPreferenceSchema>;
export type NotificationPreferencesResponse = z.infer<typeof NotificationPreferencesResponseSchema>;
export type UpdateNotificationPreference = z.infer<typeof UpdateNotificationPreferenceSchema>;
```

Re-export from `packages/shared/src/index.ts`.

**Acceptance Criteria**:

- [ ] Types exported from `@snc/shared`
- [ ] Shared package builds

---

### Unit 2: Database Schema — Follows

**File**: `apps/api/src/db/schema/notification.schema.ts`

Three tables:
- `creator_follows` — composite PK `(userId, creatorId)`, index on `creatorId`
- `notification_preferences` — composite PK `(userId, eventType, channel)`. Rows only created when user explicitly changes a preference; absence = default (enabled).
- `notification_jobs` — audit/tracking table with `id`, `userId`, `eventType`, `channel`, `payload` (jsonb), `status`, `attempts`, `lastError`, `sentAt`. Indexes on `status` and `userId`.

**Acceptance Criteria**:

- [ ] Migration generated via `bun run --filter @snc/api db:generate`
- [ ] All three tables created after `bun run --filter @snc/api db:migrate`
- [ ] Composite primary keys enforced

---

### Unit 3: Follow Service

**File**: `apps/api/src/services/follows.ts`

Functions:
- `followCreator(userId, creatorId)` — idempotent via `onConflictDoNothing`
- `unfollowCreator(userId, creatorId)` — idempotent
- `getFollowStatus(userId | null, creatorId)` — returns `{ isFollowing, followerCount }`
- `resolveAudience(creatorId)` — followers + active subscribers (deduplicated by userId)

**Implementation Notes**:

- `resolveAudience` subscriber query needs to join through `subscriptionPlans` to filter by `creatorId`. Simplified version should be expanded during implementation.
- Audience resolution excludes the creator themselves (defensive).

**Acceptance Criteria**:

- [ ] Follow is idempotent (no error on double-follow)
- [ ] Unfollow is idempotent (no error on unfollow when not following)
- [ ] Follow status returns correct `isFollowing` and `followerCount`
- [ ] Audience resolution includes followers + subscribers, deduplicated

---

### Unit 4: Notification Dispatch Service

**File**: `apps/api/src/services/notification-dispatch.ts`

`dispatchNotification(event)` — resolves audience, checks per-user preferences (default enabled = no row), enqueues one pg-boss job per eligible recipient, records audit entry in `notification_jobs`. Graceful no-op when pg-boss is not started.

**Implementation Notes**:

- Preference check queries per-user. Batch-optimize for large audiences during implementation if needed.
- Designed for fire-and-forget from route handlers.

**Acceptance Criteria**:

- [ ] Audience resolved (followers + subscribers, deduplicated)
- [ ] Users who opted out are skipped
- [ ] One pg-boss job enqueued per eligible recipient
- [ ] Audit record created in `notification_jobs` table
- [ ] Graceful no-op when pg-boss is not started

---

### Unit 5: Email Templates

**Files**:
- `apps/api/src/email/templates/go-live.ts` — `formatGoLiveEmail({ creatorName, liveUrl })`
- `apps/api/src/email/templates/new-content.ts` — `formatNewContentEmail({ creatorName, contentTitle, contentUrl })`

Each returns `{ subject, html, text }`.

**Acceptance Criteria**:

- [ ] Each template returns `{ subject, html, text }`
- [ ] HTML includes unsubscribe context (footer text)
- [ ] Plain text fallback included

---

### Unit 6: Notification Worker (pg-boss handler)

**File**: `apps/api/src/jobs/handlers/notification-send.ts`

`handleNotificationSend` — selects email template based on `eventType`, sends email, updates `notification_jobs` status. Throws on failure to trigger pg-boss retry.

**Acceptance Criteria**:

- [ ] Handler sends correct email template based on event type
- [ ] Updates `notification_jobs` status to "sent" on success
- [ ] Updates status to "failed" with error message on failure
- [ ] Throws on failure to trigger pg-boss retry

---

### Unit 7: Register Notification Worker

**File**: `apps/api/src/jobs/register-workers.ts`

Add `NOTIFICATION_SEND: "notification/send"` to `JOB_QUEUES`. Register worker with `retryLimit: 3`, `retryDelay: 60`, `localConcurrency: 3`, `deleteAfterSeconds: 30 days`.

**Acceptance Criteria**:

- [ ] Notification queue created on startup
- [ ] Worker registered with correct concurrency
- [ ] Jobs processed after enqueue

---

### Unit 8: Go-Live Integration

**File**: `apps/api/src/routes/streaming.routes.ts`

In the `on_publish` callback handler, after `ensureLiveChannelWithChat` completes, fire-and-forget `dispatchNotification` with `eventType: "go_live"` and creator name + live URL in payload. Uses `void` prefix — does not block the SRS callback response.

**Acceptance Criteria**:

- [ ] Go-live notification dispatched when a creator starts streaming
- [ ] Notification dispatch does not block the SRS callback response
- [ ] Correct creator name and live URL in payload

---

### Unit 9: Follow/Unfollow API Endpoints

**File**: `apps/api/src/routes/follow.routes.ts`

Routes (recommend mounting at `/api/creators/:creatorId/follow`):
- `GET /:creatorId` — optional auth, returns `{ isFollowing, followerCount }`
- `POST /:creatorId` — requires auth, follows (204)
- `DELETE /:creatorId` — requires auth, unfollows (204)

**Acceptance Criteria**:

- [ ] GET returns follow status + count (works for anonymous users with `isFollowing: false`)
- [ ] POST follows (idempotent, returns 204)
- [ ] DELETE unfollows (idempotent, returns 204)
- [ ] Auth required for POST/DELETE

---

### Unit 10: Notification Preferences API

**File**: `apps/api/src/routes/notification-preferences.routes.ts`

Mount at `/api/me/notifications`.
- `GET /` — returns full matrix (all event types x channels) with defaults (enabled when no row)
- `PUT /` — upserts a single preference via `onConflictDoUpdate`

**Acceptance Criteria**:

- [ ] GET returns full preference matrix (all event types x channels) with defaults
- [ ] PUT upserts a single preference
- [ ] Auth required for both endpoints

---

### Unit 11: Follow Button Component

**File**: `apps/web/src/components/creator/follow-button.tsx`

`FollowButton({ creatorId, isAuthenticated })` — fetches follow status from `/api/creators/${creatorId}/follow`, shows "Follow"/"Following" state, optimistic count update on toggle, disabled for unauthenticated users with title hint.

**Acceptance Criteria**:

- [ ] Shows "Follow" / "Following" state
- [ ] Optimistic count update on toggle
- [ ] Disabled for unauthenticated users with title hint
- [ ] Loading state while fetching initial status

---

### Unit 12: Integrate Follow Button into Creator Pages

**File**: `apps/web/src/components/creator/creator-header.tsx`

Add `FollowButton` alongside existing action buttons.

**File**: `apps/web/src/routes/live.tsx`

Add follow button to the live page for authenticated viewers.

**Acceptance Criteria**:

- [ ] Follow button visible on creator profile page
- [ ] Follow button visible on live page (for the streaming creator)

---

### Unit 13: Subscribe Flow — "Also Follow?" Prompt

**File**: `apps/web/src/components/creator/creator-header.tsx` (or checkout flow component)

"Also follow for notifications?" checkbox during subscription checkout (default checked). Follow happens before Stripe redirect. If checkout is abandoned, the follow persists — acceptable behavior.

**Acceptance Criteria**:

- [ ] "Also follow for notifications?" checkbox visible during subscribe flow
- [ ] Default checked
- [ ] Follow happens before checkout redirect

---

### Unit 14: Notification Preferences UI

**File**: `apps/web/src/routes/settings/notifications.tsx`

Settings page at `/settings/notifications`. Route requires auth (redirects to login if not). Loader fetches `/api/me/notifications`. Toggle buttons with `aria-pressed`, optimistic update with revert on failure.

**Note**: Nav link hookup is deferred — see `backlog/notification-preferences-ui-nav-link.md`.

**Acceptance Criteria**:

- [ ] Page shows all event type x channel combinations
- [ ] Toggle updates preference via API
- [ ] Optimistic update with revert on failure
- [ ] Accessible toggle buttons

---

## Implementation Order

1. **Unit 1** — Shared types in `@snc/shared`
2. **Unit 2** — Database schema + migration
3. **Unit 3** — Follow service
4. **Unit 4** — Notification dispatch service
5. **Unit 5** — Email templates
6. **Unit 6** — Notification worker handler
7. **Unit 7** — Register worker in pg-boss
8. **Unit 9** — Follow API endpoints
9. **Unit 10** — Notification preferences API
10. **Unit 8** — Go-live integration (hooks into streaming routes)
11. **Unit 11** — Follow button component
12. **Unit 12** — Integrate follow button into pages
13. **Unit 13** — Subscribe flow update
14. **Unit 14** — Notification preferences UI

## Testing

### Unit Tests: `apps/api/tests/services/follows.test.ts`

- Follow/unfollow idempotency
- Follow status query
- Audience resolution with deduplication

### Unit Tests: `apps/api/tests/services/notification-dispatch.test.ts`

- Mock pg-boss, test job enqueue per recipient
- Test preference opt-out filtering
- Test no-op when pg-boss not started

### Unit Tests: `apps/api/tests/jobs/handlers/notification-send.test.ts`

- Mock `sendEmail`, test each event type template selection
- Test status updates on success/failure
- Test retry behavior (throw on failure)

### Unit Tests: `apps/api/tests/routes/follow.routes.test.ts`

- Auth required for POST/DELETE
- GET works anonymous (isFollowing: false)
- Follow + unfollow cycle

### Unit Tests: `apps/api/tests/routes/notification-preferences.routes.test.ts`

- GET returns full matrix with defaults
- PUT upserts preference
- Auth required

### Unit Tests: `apps/web/tests/components/follow-button.test.tsx`

- Renders "Follow" when not following
- Renders "Following" when following
- Disabled for unauthenticated users
- Optimistic count update

## Verification Checklist

```bash
bun run --filter @snc/shared build
bun run --filter @snc/api db:generate
bun run --filter @snc/api db:migrate
bun run --filter @snc/api test:unit
bun run --filter @snc/web test
```
