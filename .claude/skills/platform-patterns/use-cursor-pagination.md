# Pattern: useCursorPagination Hook

Generic React hook that accumulates paginated items across pages; `buildUrl(cursor)` callback decouples API details; `deps` array triggers full reset when filters change.

## Rationale
Three pages in the app (feed, creators list, creator detail) all need the same "load more" UX: show items, detect if more exist, append next page on button click, and reset when filter state changes. Extracting this into a generic hook with a `buildUrl` callback avoids duplicating fetch + state + reset logic at every call site.

## Examples

### Example 1: Hook implementation (full signature)
**File**: `apps/web/src/hooks/use-cursor-pagination.ts:3`
```typescript
export function useCursorPagination<T>({
  buildUrl,
  deps = [],
  fetchOptions,
  initialData,
}: {
  buildUrl: (cursor: string | null) => string;
  deps?: readonly unknown[];
  fetchOptions?: RequestInit;
  initialData?: { items: T[]; nextCursor: string | null };
}): {
  items: T[];
  nextCursor: string | null;
  isLoading: boolean;
  error: string | null;
  loadMore: () => void;
} {
  const [items, setItems] = useState<T[]>(initialData?.items ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialData?.nextCursor ?? null,
  );
  const [isLoading, setIsLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  // Track whether the initial seed has been consumed so we skip the first
  // useEffect fetch when initialData was provided by the server-side loader.
  const initialConsumedRef = useRef(!!initialData);

  // Keep the latest buildUrl and fetchOptions in refs so fetchPage always
  // calls the current versions without needing them as useCallback dependencies.
  const buildUrlRef = useRef(buildUrl);
  buildUrlRef.current = buildUrl;

  const fetchOptionsRef = useRef(fetchOptions);
  fetchOptionsRef.current = fetchOptions;

  // intentional: deps controls when fetchPage is recreated (filter reset);
  // buildUrl/fetchOptions are stored in refs and do not need to be listed here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchPage = useCallback(
    async (cursor: string | null, append: boolean) => {
      setError(null);
      setIsLoading(true);
      try {
        const url = buildUrlRef.current(cursor);
        const res = await fetch(url, fetchOptionsRef.current);
        if (!res.ok) {
          setError("Failed to load");
          return;
        }
        const data = (await res.json()) as {
          items: T[];
          nextCursor: string | null;
        };
        if (append) {
          setItems((prev) => [...prev, ...data.items]);
        } else {
          setItems(data.items);
        }
        setNextCursor(data.nextCursor);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setIsLoading(false);
      }
    },
    [...deps],  // deps triggers fetchPage recreation → effect fires → reset+refetch
  );

  useEffect(() => {
    if (initialConsumedRef.current) {
      initialConsumedRef.current = false;
      return;
    }
    setItems([]);
    setNextCursor(null);
    void fetchPage(null, false);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (nextCursor) {
      void fetchPage(nextCursor, true);
    }
  }, [fetchPage, nextCursor]);

  return { items, nextCursor, isLoading, error, loadMore };
}
```

### Example 2: Feed page — simple usage without deps
**File**: `apps/web/src/routes/feed.tsx:21`
```typescript
const { items, nextCursor, isLoading, loadMore } =
  useCursorPagination<FeedItem>({
    buildUrl: (cursor) =>
      buildFeedUrl({ filter: activeFilter, cursor, limit: 12 }),
    deps: [activeFilter],  // reset when filter changes
  });
```

### Example 3: Creator detail — deps reset on filter + creatorId
**File**: `apps/web/src/routes/creators/$creatorId.tsx:34`
```typescript
const { items, nextCursor, isLoading, loadMore } =
  useCursorPagination<FeedItem>({
    buildUrl: (cursor) =>
      buildContentUrl({
        creatorId: creator.userId,
        filter: activeFilter,
        cursor,
        limit: 12,
      }),
    deps: [activeFilter, creator.userId],
  });
```

### Example 4: Creators list — no deps (static URL)
**File**: `apps/web/src/routes/creators/index.tsx:15`
```typescript
const { items, nextCursor, isLoading, loadMore } =
  useCursorPagination<CreatorListItem>({
    buildUrl: (cursor) => buildCreatorsUrl({ cursor, limit: 24 }),
  });
```

### Example 5: Authenticated endpoint — `fetchOptions: { credentials: "include" }`
**File**: `apps/web/src/routes/settings/bookings.tsx`
```typescript
const { items, nextCursor, isLoading, error, loadMore } =
  useCursorPagination<BookingWithService>({
    buildUrl: (cursor) =>
      `/api/bookings/mine${cursor ? `?cursor=${cursor}` : ""}`,
    fetchOptions: { credentials: "include" },
  });

// Render error state when present
if (error) return <p className={styles.status}>{error}</p>;
```
**Why**: Auth-gated endpoints require `credentials: "include"` so the browser sends the session cookie. Omitting this causes a silent 401 — `fetch()` succeeds at the network layer but the API returns an empty or error response. Always pass `fetchOptions: { credentials: "include" }` for any endpoint under `/api/` that requires authentication.

### Example 6: SSR-seeded usage — `initialData` from loader
**File**: `apps/web/src/routes/feed.tsx`
```typescript
// In the route loader (runs server-side):
export const Route = createFileRoute("/feed")({
  loader: async () => {
    const data = await fetchFeedPage({ cursor: null, limit: 12 });
    return { initialFeed: data };
  },
  component: FeedPage,
});

// In the component:
function FeedPage() {
  const { initialFeed } = Route.useLoaderData();

  const { items, nextCursor, isLoading, loadMore } =
    useCursorPagination<FeedItem>({
      buildUrl: (cursor) => buildFeedUrl({ filter: activeFilter, cursor, limit: 12 }),
      deps: [activeFilter],
      initialData: initialFeed,  // skips first client-side fetch; uses SSR data
    });
}
```
**Why**: Passing `initialData` pre-seeds the hook with server-rendered content, eliminating the loading spinner on initial page load. The hook tracks whether the initial data has been consumed via an internal ref and skips the first `useEffect` fetch. When `deps` change (e.g., the user changes the filter), the hook resets and fetches from the server normally.

## When to Use
- Any component that fetches a paginated list and needs "load more" UX
- When the list should reset and re-fetch from page 1 when filter state changes — pass filter values in `deps`
- The API endpoint must return `{ items: T[]; nextCursor: string | null }`
- Pass `fetchOptions: { credentials: "include" }` when the endpoint requires authentication (e.g., `/api/bookings/mine`, `/api/subscriptions/mine`) — omitting this causes silent 401 failures on auth-gated routes
- Pass `initialData` when the route loader already fetched the first page server-side — this pre-seeds the hook and eliminates the initial client-side loading spinner

## When NOT to Use
- Fixed-size lists with no pagination (just fetch directly in a loader or effect)
- When items should *replace* rather than *accumulate* on filter change — this hook handles that via the `deps` reset

## Common Violations
- **Omitting `deps` when filters exist**: If the URL depends on component state (filters, IDs) but those are not in `deps`, changing a filter won't reset the accumulated items list, showing stale data from the old filter.
- **Putting `buildUrl` in `deps`**: `buildUrl` is an inline arrow function that changes on every render; it's stored in a ref intentionally. Only put stable external dependencies (filter values, IDs) in `deps`.
- **Calling `loadMore` when `isLoading` is true**: The UI should disable the load-more button when `isLoading` is true to prevent duplicate in-flight requests.
- **Omitting `fetchOptions: { credentials: "include" }` on auth-gated endpoints**: The browser will not send the session cookie for cross-origin or same-origin fetch calls unless `credentials: "include"` is explicitly set. The fetch will appear to succeed but the API will return a 401 or empty response — a silent failure that is hard to diagnose. Always pass this option for any endpoint that requires an authenticated session.
