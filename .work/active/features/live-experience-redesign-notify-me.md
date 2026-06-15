---
id: live-experience-redesign-notify-me
kind: feature
stage: review
tags: [streaming, community]
release_binding: null
depends_on: [live-experience-redesign-live-state]
gate_origin: null
created: 2026-06-12
updated: 2026-06-15
parent: live-experience-redesign
---

# Notify me when live

## Brief
The conversion loop for the offline state: a viewer who lands on `/live` while nothing
is airing can leave an email (or, when logged in, one-click subscribe) and get notified
when a channel goes live. Server-side this triggers from the live-state transition the
`live-state` sibling establishes (the same internal event the spine publishers emit) —
a pg-boss job sends the notification email via the existing SMTP path. Includes the
capture affordance on the offline surface (joining the calendar link that `page-states`
ships), the subscription storage, the send-on-live-transition job with basic
debouncing (a channel flapping live/offline must not spam), and unsubscribe.

Scoped into this epic by explicit user decision (2026-06-12 epic design: offline-state
affordance = calendar link AND notify-me), accepting that it pulls notification
plumbing into the redesign's blast radius. Does NOT cover general notification
preferences/infrastructure beyond this single notify-me loop — if a broader
notification system emerges later, this migrates into it.

## Epic context
- Parent epic: `live-experience-redesign`
- Position in epic: consumer of `live-state` — needs the server-side live-state
  representation as its trigger. Last in the dependency chain; transitively behind the
  spine features.

## Foundation references
- `docs/streaming.md` — channel/live model
- Email in dev: Mailpit (SMTP capture) — see AGENTS.md §Email in dev

## Design decisions (2026-06-15, user)

- **Capture model: OTP-signup** (not a separate anonymous-leads tier). Capturing an email
  creates/auths a real user via better-auth `emailOTP` — matching the `email-capture-at-shows`
  sibling's choice. Consequence: **no anonymous-subscriber table and no token-unsubscribe are
  needed** — the captured email becomes a user who manages the subscription through normal
  notification preferences / an in-app unsubscribe. Reuses the whole authenticated dispatch
  path. (Rejected: a true anonymous `notify_subscribers` table — lower friction but a new
  unauthenticated tier to maintain, and inconsistent with the sibling feature.)
- **Subscribe target: per-channel** (not per-creator-follow). A subscription is to a specific
  *channel* going live — works uniformly for the S/NC TV broadcast channel (no creator owner)
  AND creator channels. Fires off the `channel.live-state-changed {live:true}` transition.
  (Rejected: per-creator reuse — doesn't fit the ownerless broadcast channel, and the offline
  page has no creator context; any-channel — too coarse, over-notifies.)

## Architectural choice
Reuse the existing notification dispatch + email + pg-boss infrastructure
(`notification-dispatch.ts`, `notification-send.ts` handler, `NOTIFICATION_SEND` queue,
`sendEmail`); add a **per-channel subscription** alongside the existing per-creator follows,
and a **channel-go-live dispatch** triggered from the `channel.live-state-changed` publish
seam. The existing system dispatches per-creator from the SRS `on_publish` callback; notify-me
adds a parallel per-channel path — they do not collide (different audience source, different
trigger). Grounding: see the existing-system map in this session's notes
(`notification-dispatch.ts:88-150` resolveAudience; `channels.ts:282/297` the publish seam).

## Implementation Units

### Unit 1: schema — per-channel subscriptions + the event type
**File**: `apps/api/src/db/schema/notification.schema.ts`; `packages/shared/src/notification.ts`
**Story**: `notify-me-subscribe-api`
```ts
/** Users subscribed to a channel's go-live (the notify-me-when-live loop). */
export const channelNotifySubscriptions = pgTable("channel_notify_subscriptions", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  channelId: text("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.channelId] }),
  index("channel_notify_subs_channel_idx").on(t.channelId),
]);
```
- Add `"channel_go_live"` to `NOTIFICATION_EVENT_TYPES` (`packages/shared/src/notification.ts`).
- Reuse the `email-capture-at-shows` `consentLog` pattern for the capture consent (source
  `"notify:<channelId>"`). If that table isn't coded yet, this feature lands a minimal version
  per that design (coordinate to avoid a duplicate table).
- Migration via `drizzle-kit generate` ONLY (never hand-write SQL — `.claude/rules/drizzle-migrations.md`).
**Acceptance**: migration applies; subscribe is idempotent (re-subscribe = no-op via PK upsert).

### Unit 2: subscribe service + public route (OTP-signup)
**File**: `apps/api/src/services/notify-when-live.ts`; `apps/api/src/routes/notify.routes.ts`
(mounted in `app.ts`)
**Story**: `notify-me-subscribe-api`
```ts
/** Subscribe a user to a channel's go-live. Idempotent (PK upsert). */
export const subscribeToChannel = (userId: string, channelId: string, policyVersion: string)
  : Promise<Result<void, AppError>>;   // upsert subscription + consentLog insert
export const unsubscribeFromChannel = (userId: string, channelId: string)
  : Promise<Result<void, AppError>>;
```
- `POST /api/notify-when-live` — public, behind `rateLimiter`. Body `{ channelId, email,
  consent: literal true, policyVersion }`. Flow: send OTP (better-auth `emailOTP`) →
  on verify, the now-authenticated user is subscribed + consent logged. Mirror the
  `email-capture-at-shows` OTP-signin extension (Unit 3 there) so the OTP path is shared, not
  duplicated. Idempotent.
- `DELETE /api/notify-when-live/:channelId` — `requireAuth`; unsubscribe (in-app, for the
  captured user). This is the unsubscribe affordance (no token flow needed — it's a real user).
**Acceptance**: happy-path + auth-failure tests; `consent` not literal-true → 422, no write;
re-subscribe is a no-op.

### Unit 3: channel-go-live dispatch
**File**: `apps/api/src/services/notify-dispatch.ts` (or extend `notification-dispatch.ts`)
**Story**: `notify-me-dispatch`
- Add a `dispatchChannelGoLive(channelId)` that resolves the per-channel audience
  (`channelNotifySubscriptions` join `users.email`, preference-checked like the existing
  path), inserts `notificationJobs` rows (eventType `channel_go_live`), and enqueues the
  `NOTIFICATION_SEND` job — reusing the existing job + `sendEmail` path 1:1.
- **Trigger**: call it from the `channel.live-state-changed {live:true}` publish seam
  (`channels.ts:282/297` and the broadcast-takeover at `playout-channels.routes.ts:211`). Fire
  ONLY on the false→true edge. **Debounce**: a channel flapping live/offline must not spam —
  guard with a short per-channel cooldown (e.g. suppress a repeat go-live dispatch within N
  minutes; in-memory holder like `playout-live-state.ts`, or a `last_notified_at` column).
- Extend `notification-send.ts` `formatEmail` with a `channel_go_live` case (a
  `formatChannelGoLiveEmail` template adapted from `formatGoLiveEmail` — channel name + live
  URL instead of creator name).
**Acceptance**: a false→true channel transition enqueues one job per subscriber; a second
go-live within the cooldown does NOT re-dispatch; offline→live→offline→live respects the edge.

### Unit 4: offline-page capture UI
**File**: `apps/web/src/routes/live.tsx` (`OfflinePlaceholder`) + a `NotifyMeForm` component
**Story**: `notify-me-offline-ui`
- Extend `OfflinePlaceholder` (currently calendar link only, `live.tsx:543`) with a
  notify-me form: email input + consent checkbox + submit → `POST /api/notify-when-live`, then
  the OTP verify step. Logged-in users get a one-click subscribe (skip email entry).
- Which channel? The offline page has no airing channel to pick. Default to a sensible target
  — the broadcast channel (S/NC TV) as the "notify me when S/NC TV is live" anchor, OR a small
  channel picker of known channels. **Open design sub-question** — resolve at implement:
  simplest is "notify me when S/NC TV goes live" (the always-present broadcast channel).
**Acceptance**: form submits + shows OTP step; logged-in one-click works; success confirmation;
the existing calendar link stays.

## Implementation order
1. Unit 1 (schema) → 2. Unit 2 (subscribe API, depends 1) → 3. Unit 3 (dispatch, depends 1) →
4. Unit 4 (UI, depends 2). Stories: `notify-me-subscribe-api` (U1+U2), `notify-me-dispatch`
(U3, depends subscribe-api for the schema), `notify-me-offline-ui` (U4, depends subscribe-api).

## Testing
- U2: route happy/auth-fail + idempotency; consent-required.
- U3: dispatch edge + debounce (fake timers); audience resolution; one job per subscriber.
- U4: form submit + OTP step + logged-in one-click (web component test).
- Live stack: subscribe via the form (Mailpit captures the OTP), drive a channel go-live,
  confirm the go-live email lands in Mailpit.

## Risks
- **OTP-signin coordination with `email-capture-at-shows`**: both extend the better-auth OTP
  path. If that feature's OTP extension (its Unit 3) isn't landed, notify-me lands a shared
  version — coordinate to avoid two divergent OTP flows. Check its state at implement.
- **consentLog table ownership**: `email-capture-at-shows` Unit 1 defines `consentLog`. If
  unbuilt, notify-me creates it (per that design); if built, reuse. One table, not two.
- **Debounce correctness**: the false→true edge + cooldown is the load-bearing anti-spam logic;
  get the edge detection right (the publish seam already fires per real transition, but a
  restart could re-fire — pair with the cooldown).
- **Channel target on the offline page**: defaulting to S/NC TV broadcast is the simplest;
  a picker is the fuller answer. Deferred to implement (Unit 4).
