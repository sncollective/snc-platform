---
source_handle: remix-utils-use-event-source
source_class: github-readme
fetched: 2026-06-15
source_url: https://github.com/sergiodxa/remix-utils/blob/main/src/react/use-event-source.ts
provenance: source-direct
source_venue: remix-utils (sergiodxa / Sergio Xalambrí — Remix-ecosystem maintainer)
---

## Paraphrase

Source code of the `useEventSource` hook and `EventSourceProvider` from remix-utils (by Sergio Xalambrí). A well-regarded community implementation of connection-sharing: a single `EventSource` is shared across hook instances that target the same URL+options, kept in a reference-counted `Map` held in React context. Named-event listeners are added in a `useEffect` with cleanup; latest message data lives in component state. (Note: this implementation keys the shared connection on URL/credentials, not on topic — topic multiplexing over one connection is a layer the consumer builds on top.)

## Key passages

**Connection-sharing map (keyed by URL + credentials):**
```typescript
let key = [url.toString(), init?.withCredentials].join("::");
let value = map.get(key) ?? {
  count: 0,
  source: new EventSource(url, init),
};
```
"Multiple hook instances with identical URLs/options reuse the single EventSource, reducing connection overhead."

**EventSourceProvider holds the map in context:**
```typescript
const context = createContext<EventSourceMap>(
  new Map<string, { count: number; source: EventSource }>(),
);
export const EventSourceProvider = context.Provider;
```
Consuming components retrieve the map via `useContext(context)`.

**Reference counting (increment on mount, decrement + close on cleanup):**
```typescript
++value.count;
map.set(key, value);
// ... in cleanup:
--value.count;
if (value.count <= 0) {
  value.source.close();
  map.delete(key);
}
```
"When all instances unmount, the connection closes automatically."

**Named-event subscription in useEffect with cleanup:**
```typescript
value.source.addEventListener(event, handler);
// ...
return () => {
  value.source.removeEventListener(event, handler);
  --value.count;
  if (value.count <= 0) {
    value.source.close();
    map.delete(key);
  }
};
```

**Latest message in state:**
```typescript
let [data, setData] = useState<string | null>(null);
function handler(event: MessageEvent) {
  setData(event.data || "UNKNOWN_EVENT_DATA");
}
```
