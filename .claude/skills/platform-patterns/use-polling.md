# use-polling

Mount-safe fixed-interval polling uses the shared `usePolling<T>()` hook instead of ad hoc `setInterval` / `useEffect` loops.

## When to use
Use for client-side async snapshots that need a degraded polling fallback, especially when a push signal such as Spine/SSE can call `refetch()` for out-of-cycle cache invalidation. Seed SSR data through `initial` when available; pass `key` when a selected id changes and the loop must reset.

## Instances
- `apps/web/src/hooks/use-polling.ts:53` — canonical hook: recursive `setTimeout`, mounted guard, latest-fetcher ref, optional `initial`/`key`/`immediate`, and stable `refetch()`.
- `apps/web/src/routes/live.tsx:109` — `useChannelList()` polls `/api/streaming/status` every 15s, seeds from route-loader data, and calls `refetch()` on live Spine events / reconnect.
- `apps/web/src/components/playout/editorial-surface.tsx:44` — `useChannelQueue()` polls queue status every 3s, resets by `channelId`, records freshness stamps on successful fetches, and uses Spine events for immediate refresh.

## Canonical sketch
```tsx
const { data, isLoading, refetch } = usePolling<Resource>(
  () => apiGet<Resource>(`/api/resource/${resourceId}`),
  15_000,
  { initial: loaderData.initial, key: resourceId },
);

useSpineTopic("resource", refetch);
```

## Required behavior
- Let `usePolling` own teardown: it clears the pending timeout and avoids state updates after unmount.
- Keep the fetcher idempotent. The hook may run immediately, on each timeout, and on explicit `refetch()` calls.
- Use `initial` for SSR/loader data so the page does not immediately overwrite a known snapshot unless `immediate: true` is intentional.
- Use `key` for dependency changes that should reset the loop and data seed; do not rely on re-created fetcher closures to resubscribe.

## Anti-patterns
Don't create parallel bespoke polling loops with `setInterval`; don't use fixed sleeps in components; don't make mutation side effects part of the polling fetcher; don't surface transient fetch failures by clearing good data unless the product explicitly needs that state.
