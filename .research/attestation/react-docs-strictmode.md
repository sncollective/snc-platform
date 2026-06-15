---
source_handle: react-docs-strictmode
source_class: tool-doc
fetched: 2026-06-15
source_url: https://react.dev/reference/react/StrictMode
provenance: source-direct
version: react.dev (React 19 docs), accessed 2026-06-15
---

## Paraphrase

The official React reference for `StrictMode`. Documents the development-only checks, focused on "re-run Effects an extra time to find bugs caused by missing Effect cleanup." Carries the chat-connection example that leaks without cleanup and the fix.

## Key passages

**What StrictMode does to Effects:**
- "Your components will re-run Effects an extra time to find bugs caused by missing Effect cleanup."
- "When Strict Mode is on, React will also run **one extra setup+cleanup cycle in development for every Effect.** This may feel surprising, but it helps reveal subtle bugs that are hard to catch manually."

**The leaking chat-connection bug (missing cleanup):**
```js
function ChatRoom({ roomId }) {
  useEffect(() => {
    const connection = createConnection(serverUrl, roomId);
    connection.connect();
    // ❌ Missing cleanup!
  }, [roomId]);
  return <h1>Welcome to the {roomId} room!</h1>;
}
```
Without StrictMode the bug is subtle — switching rooms accumulates connections that are never destroyed (memory leak, network problems).

**How StrictMode exposes it:**
- "**With Strict Mode, you immediately see that there is a problem** (the number of active connections jumps to 2). Strict Mode runs an extra setup+cleanup cycle for every Effect. This Effect has no cleanup logic, so it creates an extra connection but doesn't destroy it. This is a hint that you're missing a cleanup function."

**The fix (cleanup):**
```js
useEffect(() => {
  const connection = createConnection(serverUrl, roomId);
  connection.connect();
  return () => connection.disconnect();  // ✅ Cleanup function
}, [roomId]);
```
- "Strict Mode lets you notice such mistakes early in the process. When you fix your Effect by adding a cleanup function in Strict Mode, you *also* fix many possible future production bugs."
