---
source_handle: react-docs-synchronizing-with-effects
source_class: tool-doc
fetched: 2026-06-15
source_url: https://react.dev/learn/synchronizing-with-effects
provenance: source-direct
version: react.dev (React 19 docs, Learn section), accessed 2026-06-15
---

## Paraphrase

The official React Learn page on synchronizing with Effects, specifically the "How to handle the Effect firing twice in development" guidance. The load-bearing position: the correct response to the dev double-fire is proper cleanup, NOT suppressing the second run with a ref/flag. Carries the subscribe-to-events, chat-connection, non-React-widget, and animation patterns, each with cleanup.

## Key passages

**Reframe of the problem:**
- "**The right question isn't 'how to run an Effect once', but 'how to fix my Effect so that it works after remounting'.**"

**Anti-pattern — don't use refs to prevent the double-fire:**
- Header: "Don't use refs to prevent Effects from firing."
- Example of the wrong fix:
```js
const connectionRef = useRef(null);
useEffect(() => {
  // 🚩 This wont fix the bug!!!
  if (!connectionRef.current) {
    connectionRef.current = createConnection();
    connectionRef.current.connect();
  }
}, []);
```
- "**This makes it so you only see `'✅ Connecting...'` once in development, but it doesn't fix the bug.** When the user navigates away, the connection still isn't closed and when they navigate back, a new connection is created. As the user navigates across the app, the connections would keep piling up, the same as it would before the 'fix'."
- "**To fix the bug, it is not enough to just make the Effect run once. The effect needs to work after re-mounting, which means the connection needs to be cleaned up.**"

**Subscribing to events pattern:**
```js
useEffect(() => {
  function handleScroll(e) { /* ... */ }
  window.addEventListener('scroll', handleScroll);
  return () => window.removeEventListener('scroll', handleScroll);
}, []);
```
- "In development, your Effect will call `addEventListener()`, then immediately `removeEventListener()`, and then `addEventListener()` again with the same handler. So there would be only one active subscription at a time. This has the same user-visible behavior as calling `addEventListener()` once, as in production."

**Connecting to a chat server pattern:**
```js
useEffect(() => {
  const connection = createConnection();
  connection.connect();
  return () => connection.disconnect();
}, []);
```
- With proper cleanup, development shows: `"✅ Connecting..."` → `"❌ Disconnected."` → `"✅ Connecting..."`.
- "**This is the correct behavior in development.** By remounting your component, React verifies that navigating away and back would not break your code. Disconnecting and then connecting again is exactly what should happen!"

**Controlling non-React widgets (idempotent case needs no cleanup):**
- "Note that there is no cleanup needed in this case. In development, React will call the Effect twice, but this is not a problem because calling `setZoomLevel` twice with the same value does not do anything." (When a double-call is problematic — e.g. `dialog.showModal()` — implement cleanup `dialog.close()`.)
