---
id: feature-patron-badges
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

# Patron Badges in Chat

Show patron badges next to usernames in chat messages. Badges are denormalized onto each message at send time so they are historically accurate — they reflect the user's subscription status at the moment they sent the message, not their current status.

Two badge types:
- **`platform`** — user has an active platform-level subscription
- **`creator`** — user has an active subscription to the channel's creator

A user can have both simultaneously. Badge resolution happens in `createMessage()`. The room's `channelId` links to `channels.creatorId`, which identifies the creator for the `creator` badge check. The platform room has no `channelId`, so only `platform` badges apply there.

## Implementation Units

- [ ] **Unit 1: Badge Type in Shared Package** — `packages/shared/src/chat.ts`: `BADGE_TYPES`, `BadgeType`, extend `ChatMessageSchema` with `badges: z.array(z.enum(BADGE_TYPES))`. Run `bun run --filter @snc/shared build` after.
- [ ] **Unit 2: Schema Migration — Add `badges` Column** — `apps/api/src/db/schema/chat.schema.ts`: `badges text[] NOT NULL DEFAULT '{}'`. Run `bun run --filter @snc/api db:generate` then `bun run --filter @snc/api db:migrate`. Never hand-write migration SQL.
- [ ] **Unit 3: Badge Resolution Service** — `apps/api/src/services/chat.ts`: private `resolveUserBadges(userId, room)` helper. Platform badge: any active platform subscription. Creator badge: active creator subscription to this channel's creator. `past_due` does not qualify. Pass the already-fetched room row to avoid a second query.
- [ ] **Unit 4: Integrate Badges into `createMessage()`** — call `resolveUserBadges`, persist `badges` on insert, update `toMessageResponse` to map `badges` column. Wrap badge resolution in try/catch — failure must not block message send (graceful degradation: `badges: []`).
- [ ] **Unit 5: Frontend Badge Rendering** — `apps/web/src/components/chat/chat-panel.tsx` + `.module.css`: `BADGE_LABELS` constant (`platform` → "Patron", `creator` → "Sub"); render badge pills between username and content; `data-badge` attribute for CSS variant styling.

## Implementation Order

1. Unit 1 — Shared types.
2. Unit 2 — Schema migration (add `badges` column, generate + apply).
3. Units 3 + 4 — Badge resolution service and `createMessage()` integration (same file, implement together).
4. Unit 5 — Frontend rendering.

Units 1 + 2 must land first. Units 3 + 4 are a single change. Unit 5 can be done in parallel with 3 + 4 after Unit 1 is in place.

## Testing

**API unit tests** (`apps/api/tests/services/chat.test.ts`):
- `resolveUserBadges` with no subscriptions → `[]`.
- `resolveUserBadges` with active platform subscription → `["platform"]`.
- `resolveUserBadges` with active creator subscription in matching channel → `["creator"]`.
- `resolveUserBadges` with active creator subscription in non-matching channel → `[]`.
- `resolveUserBadges` with both subscriptions → `["platform", "creator"]`.
- `resolveUserBadges` with `past_due` subscription → `[]`.
- `createMessage` persists badges; `getMessageHistory` returns them.
- `createMessage` graceful degradation: subscription query failure yields `badges: []`, message still created.

**Web unit tests** (`apps/web/tests/components/chat/chat-panel.test.tsx`):
- No badge markup for empty badges array.
- "Patron" text + `data-badge="platform"` for platform badge.
- "Sub" text + `data-badge="creator"` for creator badge.
- Correct ordering when both badges present (platform first).

## Verification Checklist

- [ ] `bun run --filter @snc/shared build` passes with new types.
- [ ] `bun run --filter @snc/api db:generate` produces a clean migration.
- [ ] `bun run --filter @snc/api db:migrate` applies without errors.
- [ ] `bun run --filter @snc/api test:unit` passes.
- [ ] `bun run --filter @snc/web test` passes.
- [ ] Manual: send a message with no subscriptions — no badge rendered.
- [ ] Manual: send a message with a platform subscription — "Patron" badge appears.
- [ ] Manual: send a message in a channel room with a creator subscription — "Sub" badge appears.
- [ ] Manual: scroll up through history — badges on old messages reflect status at send time.
- [ ] Badge resolution does not noticeably delay message send (< 10ms added latency).

## Note

E2E badge testing is deferred until a test fixture strategy for subscriptions exists. The subscription feature flag gates this in non-production environments where Stripe keys are unavailable.
