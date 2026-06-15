---
source_handle: react-docs-useeffect
source_class: tool-doc
fetched: 2026-06-15
source_url: https://react.dev/reference/react/useEffect
provenance: source-direct
version: react.dev (React 19 docs), accessed 2026-06-15
---

## Paraphrase

The official React reference for `useEffect`. Covers the setup/cleanup contract, the "Connecting to an external system" chat-server example (connect on setup, disconnect on cleanup), the re-run sequence when dependencies change, the cleanup-mirrors-setup principle, and the StrictMode development double-fire (one extra setup+cleanup cycle).

## Key passages

**Setup + cleanup contract:**
- "Your setup function may also optionally return a *cleanup* function. When your component commits, React will run your setup function. After every commit with changed dependencies, React will first run the cleanup function (if you provided it) with the old values, and then run your setup function with the new values. After your component is removed from the DOM, React will run your cleanup function."

**Connecting to an external system (chat-server example):**
```js
function ChatRoom({ roomId }) {
  const [serverUrl, setServerUrl] = useState('https://localhost:1234');
  useEffect(() => {
    const connection = createConnection(serverUrl, roomId);
    connection.connect();
    return () => {
      connection.disconnect();
    };
  }, [serverUrl, roomId]);
}
```
Setup = `connection.connect()`; cleanup = `connection.disconnect()`; deps `[serverUrl, roomId]` — when they change, cleanup runs then setup re-runs.

**Cleanup-mirrors-setup principle:**
- "Try to write every Effect as an independent process and think about a single setup/cleanup cycle at a time. It shouldn't matter whether your component is mounting, updating, or unmounting. When your cleanup logic correctly 'mirrors' the setup logic, your Effect is resilient to running setup and cleanup as often as needed."
- "The cleanup function should stop or undo whatever the setup function was doing. The rule of thumb is that the user shouldn't be able to distinguish between the setup being called once (as in production) and a *setup* → *cleanup* → *setup* sequence (as in development)."

**StrictMode development double-fire:**
- "When Strict Mode is on, React will **run one extra development-only setup+cleanup cycle** before the first real setup. This is a stress-test that ensures that your cleanup logic 'mirrors' your setup logic and that it stops or undoes whatever the setup is doing. If this causes a problem, [implement the cleanup function.]"
- "To help you find bugs, in development React runs setup and cleanup one extra time before the setup."
- Development sequence: Setup → Cleanup (stress-test) → Setup (actual).

**Dependency caveat:**
- "If some of your dependencies are objects or functions defined inside the component, there is a risk that they will **cause the Effect to re-run more often than needed.**" All reactive values used in the Effect must be declared as dependencies; the linter flags omissions.
