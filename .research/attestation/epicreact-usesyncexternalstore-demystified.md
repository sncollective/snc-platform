---
source_handle: epicreact-usesyncexternalstore-demystified
source_class: blog-post
fetched: 2026-06-15
source_url: https://www.epicreact.dev/use-sync-external-store-demystified-for-practical-react-development-w5ac0
provenance: source-direct
source_venue: Epic React (Kent C. Dodds)
---

## Paraphrase

A practitioner article by Kent C. Dodds on `useSyncExternalStore`. Frames it as the correct, robust tool for syncing with state outside React (browser APIs, vanilla-JS libraries, custom event systems), motivates it via the tearing problem under concurrent rendering, restates the subscribe/getSnapshot/getServerSnapshot pattern, and stresses the referential-stability requirement on `getSnapshot`.

## Key passages

**When to use it (versus useEffect+useState):**
- "If you're syncing with state outside React, `useSyncExternalStore` is the correct, robust solution."
- Use cases named: browser APIs (`navigator.onLine`, `document.visibilityState`, `window.matchMedia`), third-party vanilla-JS libraries managing state outside React, and "custom event systems React doesn't control."

**Why it matters — tearing under concurrent rendering:**
- "if an external store changes while React is in the middle of rendering a component tree, different components might read different versions" of the data. The article frames `useSyncExternalStore` as preventing this tearing, a guarantee that traditional `useEffect` + `useState` patterns lack under concurrent rendering.

**The three-part pattern:**
- `subscribe(callback)` — sets up listeners; must return an unsubscribe function.
- `getSnapshot()` — returns current external data; "must be pure and fast."
- `getServerSnapshot()` — optional; provides initial server-side value for SSR.

**Referential-stability requirement on getSnapshot:**
- "if the underlying data hasn't changed, `getSnapshot` should return the **same value by reference**." Without this, React's `Object.is` comparison triggers unnecessary re-renders. The article provides caching examples to maintain stability across calls.
