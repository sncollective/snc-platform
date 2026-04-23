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

When a user sends a chat message, it briefly appears twice in the message list, then collapses to one copy on page refresh. Observed 2026-04-20 in the live-stream chat panel during the `design-system-adoption` review (non-blocking). Most visible viewer-facing chat bug on the 0.3.0 release surface.

## Root cause

Not optimistic-insert + server-echo (there is no client-side optimistic insert today — `sendMessage` at `chat-context.tsx:415` just calls `safeSend` with no dispatch). Actual cause: **reconnect-loop + React strict-mode double-mount creates orphan WebSocket connections that all server-side-join the same chat room, so one server broadcast hits the same browser tab multiple times.**

Trace in dev (React 18 strict mode on):

1. Mount effect fires → `connect()` creates WS1, `wsRef.current = ws1`.
2. Strict-mode cleanup fires → `ws1.close()` queued (async).
3. Strict-mode remount → `connect()` creates WS2, `wsRef.current = ws2`.
4. WS1's `onclose` fires later → unconditionally sets `wsRef.current = null` (wiping WS2's ref) + schedules reconnect timeout.
5. Reconnect fires → `connect()` creates WS3, `wsRef.current = ws3`.
6. WS2 is open but orphaned (no ref in wsRef).
7. If user is in a room, `onopen` auto-rejoins (chat-context.tsx:255-262) → both WS2 and WS3 join room A server-side.
8. User sends message via WS3 → server broadcasts to room A → `broadcastToRoom` (chat-rooms.ts:170-180) iterates all members, hits both WS2 and WS3.
9. Both `ws.onmessage` handlers fire in the same tab → two `ADD_MESSAGE` dispatches → message renders twice.

Refresh collapses to one copy because the page reload drops all orphan sockets; REST-loaded history returns the single persisted DB row (server-side has no duplication).

Strict mode in dev is the most visible trigger but the same race exists in prod on any transient network blip that closes WS1 while the cleanup hasn't flagged it as intentional.

## Approach

Targeted fix in `apps/web/src/contexts/chat-context.tsx` — two guards on the `onclose` handler:

1. **Abort flag** — cleanup marks the WS as "don't reconnect" before calling `close()`.
2. **Identity check** — `onclose` only acts if `wsRef.current` still points at itself; orphan closes no-op.

```typescript
const connect = useCallback(() => {
  const ws = new WebSocket(...) as WebSocket & { __abortReconnect?: boolean };
  // ... onopen, onmessage unchanged ...
  ws.onclose = () => {
    if (ws.__abortReconnect) return;          // cleanup close — no reconnect
    if (wsRef.current !== ws) return;         // orphan close — already superseded
    dispatch({ type: "SET_CONNECTED", isConnected: false });
    wsRef.current = null;
    const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30_000);
    reconnectAttemptsRef.current += 1;
    reconnectTimeoutRef.current = setTimeout(connect, delay);
  };
  wsRef.current = ws;
}, []);

useEffect(() => {
  connect();
  return () => {
    clearTimeout(reconnectTimeoutRef.current);
    const ws = wsRef.current;
    if (ws) {
      (ws as WebSocket & { __abortReconnect?: boolean }).__abortReconnect = true;
      ws.close();
    }
  };
}, [connect]);
```

No shared-type changes. No server changes. No reducer changes. Root cause is duplicate *deliveries*, not duplicate *dispatches from a single delivery* — so client-side dedup is the wrong layer to fix it.

## Tasks

- [ ] Add the `__abortReconnect` flag + identity check in `chat-context.tsx` onclose handler.
- [ ] Update the cleanup path to set the flag before calling `close()`.
- [ ] Verify no-regression on legitimate reconnect: still reconnects on real network drop (not just cleanup close).

## Risks

**Low.** Localized to one hook in one file. No protocol changes, no DB, no types. The identity check is strictly defensive — it narrows the conditions under which reconnect fires, not widens them.

Main risk is a real-reconnect regression (network drop + cleanup race causing reconnect to be falsely suppressed). Covered by the identity check only firing when `wsRef.current !== ws` — which means some newer WS is already current, so the reconnect is genuinely unwanted. Real network drops leave `wsRef.current === ws` at the moment onclose fires, so reconnect still schedules.

## Verification

- [ ] Send a message in dev (strict mode on); exactly one copy appears (no flicker-to-two).
- [ ] Simulate network drop (DevTools → Network → Offline/Online toggle); reconnect fires, active room auto-rejoins.
- [ ] Component unmount (navigate away from chat page) → no orphan WS left, no stray reconnect timer.
- [ ] Reconnect mid-session does not duplicate messages already in state.
- [ ] Other tabs receive the new message exactly once.

## Revision note

Story was originally scoped (2026-04-20 backlog park; 2026-04-23 active promotion) with a `clientId` round-trip approach assuming optimistic-insert duplication. `/implement` grounding surfaced the actual cause — orphan WS connections from reconnect-loop + strict-mode remount — which is a different and smaller fix. Schema and server paths untouched.
