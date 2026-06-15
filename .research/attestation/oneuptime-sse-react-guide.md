---
source_handle: oneuptime-sse-react-guide
source_class: blog-post
fetched: 2026-06-15
source_url: https://oneuptime.com/blog/post/2026-01-15-server-sent-events-sse-react/view
provenance: source-direct
source_venue: OneUptime engineering blog
---

## Paraphrase

A practical engineering-blog guide to implementing SSE in React. Covers the basic EventSource-in-useEffect pattern with mandatory cleanup, named-event handling via `addEventListener`, connection-lifecycle state tracking, an explicit recommendation for a single connection with event routing over multiple connections, and the custom-hook + context-provider patterns for app-wide reuse.

## Key passages

**EventSource setup with cleanup:**
```javascript
useEffect(() => {
  const eventSource = new EventSource('/api/messages/stream');
  eventSource.onopen = () => { setIsConnected(true); };
  eventSource.onmessage = (event) => { /* handle */ };
  eventSource.onerror = (event) => { /* handle */ };
  return () => { eventSource.close(); };
}, []);
```
"Always close on cleanup" is stated as the critical principle; the guide warns that "Missing cleanup!" causes connection leaks.

**Named event handling:**
```javascript
eventSource.addEventListener('notification', (event) => {
  const notification = JSON.parse(event.data);
});
```
The guide notes this lets you "Listen to custom event types" from a single connection.

**Connection lifecycle states:**
- Recommends tracking connection state with values like `'connecting' | 'connected' | 'reconnecting' | 'failed'`, driven by `onopen`, `onerror`, and closure detection.

**Single vs. multiple connections (explicit recommendation):**
- "Use a single connection with event routing instead of multiple connections" — advocates "One endpoint" with different event listeners rather than separate EventSource instances per event type.

**Custom hook + context provider:**
- A `useSSE` hook structure handling URL, callbacks, event types, JSON parsing; returns `{ data, error, isConnected, reconnect, close }`.
- For app-wide state, an `SSEProvider` wrapping components, exposing `{ isConnected, subscribe, connectionState }` and a `useSSEEvent` hook for subscribing to specific event types across the tree.
