---
tags: [community, ux-polish]
release_binding: null
created: 2026-04-20
---

# Chat sent message renders twice before refresh

When a user sends a chat message, it briefly appears twice in the message list, then collapses to one copy on page refresh. Classic optimistic-update + server-echo duplication: the client adds the message locally on send AND receives it again via the WebSocket broadcast from the server, with no client-side dedup on messageId.

Observed 2026-04-20 in the live-stream chat panel during the `design-system-adoption` review (non-blocking).

## Likely root cause

In [apps/web/src/contexts/chat-context.tsx](../../apps/web/src/contexts/chat-context.tsx) (or wherever chat state is managed), the `sendMessage` action probably appends an optimistic message to state immediately, then the server broadcasts the canonical message back via the WebSocket `message` event and the reducer appends it again. Refresh reloads from REST → single copy wins.

## Likely fix shape

Two clean paths:

1. **Server excludes sender from broadcast.** The server tracks each WS client's userId and skips the sender when broadcasting. Sender only sees their optimistic copy. Reliable, simple, but optimistic copy lacks server-assigned `id` / `createdAt` until the send-ack returns.
2. **Client dedups by messageId on receive.** On `message` WS event, reducer checks if a message with that `id` is already in state and merges instead of appending. Requires the optimistic message to carry a temporary id the server-echoed message can match against (or a `clientId` field round-tripped).

Option 2 is more robust (covers other duplication paths — reconnect-replay, cross-tab) but needs a small schema tweak to round-trip a clientId.

## Verification

- [ ] Send a message; exactly one copy appears immediately (no flicker-to-two-then-collapse)
- [ ] Message has server-assigned `createdAt` + `id` after send completes (no stuck "sending" state)
- [ ] Reconnect mid-session does not duplicate messages already in state
- [ ] Other tabs receive the new message exactly once
