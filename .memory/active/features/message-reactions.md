---
id: feature-message-reactions
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

# Message Reactions

Allow authenticated chat users to react to messages with a curated set of six emojis: 👍 ❤️ 😂 😮 😢 🔥. Reactions are togglable — clicking an emoji you've already used removes it. Each emoji displays a count pill below the message; the current user's own reactions are visually highlighted.

**Key architecture decisions:**
- **Separate table** (`chat_message_reactions`) with compound unique on `(messageId, userId, emoji)`. Avoids JSONB queries; toggle/count is a single upsert/delete.
- **Reactions excluded from `ChatMessage`** — not sent in `history` or `message` events. A companion `reactions_batch` event delivers reactions for the initial history batch immediately after `history`.
- **WebSocket for real-time** — `reaction_updated` broadcast when any reaction changes.
- **REST for lazy load** — `GET /api/chat/rooms/:roomId/messages/:messageId/reactions` for out-of-join-flow cases.
- **Auth required** for reactions. Banned users cannot react. Closed rooms reject add-reactions (remove is allowed).

## Implementation Units

- [ ] **Unit 1: Shared Types — Reaction Events and Constants** — `packages/shared/src/chat.ts`: `REACTION_EMOJIS` const tuple, `ReactionEmoji` type, `MessageReaction` type (`emoji`, `count`, `reactedByMe`); `ClientAddReactionEventSchema`, `ClientRemoveReactionEventSchema` added to `ClientEventSchema` union; `ServerReactionUpdatedEvent` (`type`, `roomId`, `messageId`, `emoji`, `count`, `reactedByUserId | null`, `userIds`) and `ServerReactionsBatchEvent` (`type`, `roomId`, `reactions: Record<string, MessageReaction[]>`) added to `ServerEvent` union. Run `bun run --filter @snc/shared build` after.
- [ ] **Unit 2: Database Schema — Reactions Table** — `apps/api/src/db/schema/chat.schema.ts`: `chat_message_reactions` with `id`, `messageId`, `userId`, `roomId` (denormalized for batch query), `emoji`, `createdAt`. Compound unique on `(messageId, userId, emoji)`. Indexes on `messageId` and `roomId`. Cascade deletes on `messageId` and `userId`. Run `bun run --filter @snc/api db:generate` then `bun run --filter @snc/api db:migrate`.
- [ ] **Unit 3: Reaction Service** — `apps/api/src/services/chat-reactions.ts`: `addReaction` (idempotent via `.onConflictDoNothing()`, then fetch authoritative count), `removeReaction` (idempotent; closed-room check skipped — unreacting in a closed room is allowed), `getReactionsForMessage` (grouped by emoji), `getReactionsBatch` (single `inArray` query over all messageIds; O(1) for join).
- [ ] **Unit 4: WebSocket Handler and REST Endpoint** — `apps/api/src/routes/chat.routes.ts`: update `join` case to send `reactions_batch` after history; add `add_reaction` + `remove_reaction` WS cases (broadcast `reaction_updated` to room on success); add `GET /rooms/:roomId/messages/:messageId/reactions` REST endpoint (unauthenticated read OK; `reactedByMe` based on session if present).
- [ ] **Unit 5: Frontend State — Reaction Reducer Actions** — `apps/web/src/contexts/chat-context.tsx`: add `reactions: ReadonlyMap<string, readonly MessageReaction[]>` to `ChatState` (initial `new Map()`); add `addReaction`, `removeReaction` to `ChatActions`; `SET_REACTIONS_BATCH` (populate map) + `UPDATE_REACTION` (update single emoji without clobbering others; count 0 removes entry); `SET_ACTIVE_ROOM` resets `reactions: new Map()`; handle `reactions_batch` + `reaction_updated` WS events. Thread `currentUserId` into `ChatProvider` via prop.
- [ ] **Unit 6: Frontend UI — Reaction Pills and Picker** — `apps/web/src/components/chat/chat-panel.tsx`: render `reactionRow` below each message with per-emoji pills (click toggles add/remove; `aria-pressed`; `reactionPillActive` when `reactedByMe`); `ReactionPicker` component (`apps/web/src/components/chat/reaction-picker.tsx`) with opacity-0 "+" trigger (reveals on `.message:hover`), `role="dialog"` panel opening upward, 6 emoji buttons, outside-click close. New CSS modules: `reaction-picker.module.css` + additions to `chat-panel.module.css`. Picker not rendered when room is closed, user is banned, or disconnected.

## Implementation Order

1. Unit 1 (shared types) — build + verify.
2. Unit 2 (DB schema migration).
3. Units 3 + 5 in parallel — reaction service (depends on Unit 2) + frontend state (depends on Unit 1).
4. Units 4 + 6 — WS handler / REST (depends on Unit 3) + frontend UI (depends on Unit 5).

## Testing

**API unit tests** (`apps/api/tests/services/chat-reactions.test.ts`): `addReaction` inserts + idempotent + two-user count + banned/closed-room/unknown-message errors; `removeReaction` decrements + idempotent; `getReactionsBatch` empty input + grouping + `reactedByMe`.

**API route tests** (`apps/api/tests/routes/chat.routes.test.ts`): REST lazy-load happy path + unauthenticated access; WS `add_reaction` unauthenticated → `UNAUTHORIZED`; WS `add_reaction` valid → `reaction_updated` broadcast.

**Web unit tests** (`apps/web/tests/components/chat/chat-panel.test.tsx`): reaction pills render for `count > 0`; no row when empty; `reactionPillActive` when `reactedByMe`; click dispatches correct action.

**Web unit tests** (`apps/web/tests/components/chat/reaction-picker.test.tsx`): "+" opens panel; outside click closes; emoji click calls `onReact` + closes; already-reacted emoji active + calls `onUnreact`.

**Web unit tests** (`apps/web/tests/contexts/chat-context.test.ts`): `SET_REACTIONS_BATCH` populates map; `UPDATE_REACTION` updates single emoji without clobbering; count 0 removes entry; `SET_ACTIVE_ROOM` clears map.

## Verification Checklist

- [ ] `bun run --filter @snc/shared build` passes with new reaction types.
- [ ] `bun run --filter @snc/api db:generate` produces a clean migration.
- [ ] `bun run --filter @snc/api db:migrate` applies without errors.
- [ ] `bun run --filter @snc/api test:unit` passes.
- [ ] `bun run --filter @snc/web test` passes.
- [ ] Manual: react to a message — pill appears with count 1.
- [ ] Manual: second user reacts with same emoji — count increments in real time for both.
- [ ] Manual: click active reaction pill — count decrements, highlight removed.
- [ ] Manual: own reaction highlighted; others' reactions are not.
- [ ] Manual: open picker — all 6 emojis visible; already-reacted highlighted.
- [ ] Manual: switch rooms — reactions from previous room not visible in new room.
- [ ] Manual: closed room — "+" picker not rendered.
- [ ] Manual: banned user — "+" picker not rendered.
- [ ] Reaction delivery latency imperceptible (< 100ms round trip on local dev).
