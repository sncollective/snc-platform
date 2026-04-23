---
id: story-chat-sent-message-double-render
kind: story
stage: implementing
tags: [community, ux-polish]
release_binding: null
created: 2026-04-20
updated: 2026-04-23
related_decisions: []
related_designs: []
parent: null
---

When a user sends a chat message, it briefly appears twice in the message list, then collapses to one copy on page refresh. Classic optimistic-update + server-echo duplication: the client adds the message locally on send AND receives it again via the WebSocket broadcast from the server, with no client-side dedup on messageId.

Observed 2026-04-20 in the live-stream chat panel during the `design-system-adoption` review (non-blocking). Most visible viewer-facing chat bug on the 0.3.0 release surface.

## Root cause

In `apps/web/src/contexts/chat-context.tsx` (or wherever chat state is managed), the `sendMessage` action appends an optimistic message to state immediately, then the server broadcasts the canonical message back via the WebSocket `message` event and the reducer appends it again. Refresh reloads from REST → single copy wins because duplicates don't exist server-side.

## Approach

**Option 2 — client dedup with `clientId` round-trip.** Covers the primary bug plus reconnect-replay and cross-tab duplication paths that option 1 (server-excludes-sender) misses. No DB migration — only a WebSocket message-shape change to add a `clientId` field, likely in `@snc/shared` if the type lives there.

Flow:
1. Client generates a `clientId` (UUID) when creating the optimistic message.
2. Client sends the message over WS (or REST, whichever the send path uses) with `clientId` attached.
3. Server echoes `clientId` back in the broadcast `message` event alongside its assigned `id` and `createdAt`.
4. Reducer on `message` event: if a state entry matches `clientId`, merge (promote from optimistic to canonical, backfilling `id` + `createdAt`) instead of appending.

## Tasks

- [ ] Add `clientId: string` (optional, UUID) to the chat WebSocket message shape in `@snc/shared` (or wherever the type is defined) — both send and broadcast directions.
- [ ] Server: echo incoming `clientId` back in the broadcast payload.
- [ ] Client: generate `clientId` on optimistic insert; dedup-or-merge in reducer on `message` event.
- [ ] Add unit coverage for the reducer's merge path (optimistic + canonical with matching clientId → single entry with server fields).

## Risks

**Medium.** Chat is event-day-critical. Regressing chat at the live show is worse than the duplicate-flicker bug. Pre-ship verification against a local + staging WS must cover all four points in §Verification before the story flips to `review`.

## Verification

- [ ] Send a message; exactly one copy appears immediately (no flicker-to-two-then-collapse)
- [ ] Message has server-assigned `createdAt` + `id` after send completes (no stuck "sending" state)
- [ ] Reconnect mid-session does not duplicate messages already in state
- [ ] Other tabs receive the new message exactly once
