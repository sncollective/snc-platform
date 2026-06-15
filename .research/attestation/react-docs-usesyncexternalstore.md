---
source_handle: react-docs-usesyncexternalstore
source_class: tool-doc
fetched: 2026-06-15
source_url: https://react.dev/reference/react/useSyncExternalStore
provenance: source-direct
version: react.dev (React 19 docs), accessed 2026-06-15
---

## Paraphrase

The official React reference for `useSyncExternalStore`, the hook for subscribing a component to a store that lives outside React. Documents the three-parameter signature, the `subscribe`/`getSnapshot`/`getServerSnapshot` contracts, the immutability/caching requirements on `getSnapshot`, the subscribe-stability rule, and the browser-API subscription example.

## Key passages

**Purpose + signature:**
- "`useSyncExternalStore` is a React Hook that lets you subscribe to an external store."
- Signature: `const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot?)`.

**`subscribe` parameter contract:**
- "A function that takes a single `callback` argument and subscribes it to the store."
- "When the store changes, it should invoke the provided `callback`, which will cause React to re-call `getSnapshot` and (if needed) re-render the component."
- "The `subscribe` function should return a function that cleans up the subscription."

**`getSnapshot` parameter contract + caching requirement:**
- "A function that returns a snapshot of the data in the store that's needed by the component."
- "While the store has not changed, repeated calls to `getSnapshot` must return the same value."
- "If the store changes and the returned value is different (as compared by `Object.is`), React re-renders the component."
- "The store snapshot returned by `getSnapshot` must be immutable."
- Caveat: "If the underlying store has mutable data, return a new immutable snapshot if the data has changed. Otherwise, return a cached last snapshot."

**`getServerSnapshot` (optional) + SSR:**
- "A function that returns the initial snapshot of the data in the store." Used only during server rendering and hydration.
- "The server snapshot must be the same between the client and the server, and is usually serialized and passed from the server to the client."
- "If you omit this argument, rendering the component on the server will throw an error."

**Subscribe stability rule:**
- "If a different `subscribe` function is passed during a re-render, React will re-subscribe to the store using the newly passed `subscribe` function. You can prevent this by declaring `subscribe` outside the component." (Alternative noted: wrap with `useCallback`.)

**Suspension caveat (relevant to error/loading handling):**
- "It's not recommended to _suspend_ a render based on a store value returned by `useSyncExternalStore`. The reason is that mutations to the external store cannot be marked as non-blocking Transition updates, so they will trigger the nearest `Suspense` fallback, replacing already-rendered content on screen with a loading spinner, which typically makes a poor UX."

**Browser-API subscription example (`navigator.onLine`):**
```js
function getSnapshot() {
  return navigator.onLine;
}
function subscribe(callback) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}
```
With server support: `getServerSnapshot` returns a constant (e.g. `true`) so the server-rendered HTML matches.

**Troubleshooting "The result of `getSnapshot` should be cached":** the error occurs when `getSnapshot` returns a new object on every call; "Your `getSnapshot` object should only return a different object if something has actually changed."
