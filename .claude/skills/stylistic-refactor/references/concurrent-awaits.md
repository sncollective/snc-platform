# Style: Concurrent Awaits

> Use `Promise.all` for independent async operations; never sequential awaits for independent work.

## Motivation

Sequential `await` calls for independent operations waste time — each waits for the previous
to complete before starting. `Promise.all` runs them concurrently, which is especially
important in route loaders (SSR latency), dashboard endpoints (multiple DB queries), and
any function that fetches from multiple sources. In a platform with Stripe, Shopify, and
database calls, this adds up fast.

## Before / After

### From this codebase: dashboard booking counts

**Before:** (actual code from `apps/api/src/routes/dashboard.routes.ts`)
```typescript
const [[totalRow], [pendingRow]] = await Promise.all([
  db.select({ count: count() }).from(bookingRequests),
  db
    .select({ count: count() })
    .from(bookingRequests)
    .where(eq(bookingRequests.status, "pending")),
]);
```
Two independent DB queries run concurrently. This already follows the pattern.

### From this codebase: landing page loader

**Before:** (actual code from `apps/web/src/routes/index.tsx`)
```typescript
const [creators, recentContent, plans] = await Promise.all([
  isFeatureEnabled("creator")
    ? (fetchApiServer({ data: "/api/creators?limit=8" }) as Promise<CreatorListResponse>)
        .then((r) => r.items)
        .catch(() => [] as CreatorListResponse["items"])
    : ([] as CreatorListResponse["items"]),
  isFeatureEnabled("content")
    ? (fetchApiServer({ data: "/api/content?limit=6" }) as Promise<FeedResponse>)
        .then((r) => r.items)
        .catch(() => [] as FeedResponse["items"])
    : ([] as FeedResponse["items"]),
  // ... plans fetch
]);
```
Three independent API calls run concurrently with individual error handling.

### Synthetic example: sequential awaits anti-pattern

**Before:**
```typescript
async function loadCreatorDashboard(creatorId: string) {
  const profile = await fetchCreatorProfile(creatorId);
  const contentCount = await getContentCount(creatorId);
  const subscriberCount = await getSubscriberCount(creatorId);
  const recentRevenue = await getMonthlyRevenue(3);

  return { profile, contentCount, subscriberCount, recentRevenue };
}
```

**After:**
```typescript
async function loadCreatorDashboard(creatorId: string) {
  const [profile, contentCount, subscriberCount, recentRevenue] = await Promise.all([
    fetchCreatorProfile(creatorId),
    getContentCount(creatorId),
    getSubscriberCount(creatorId),
    getMonthlyRevenue(3),
  ]);

  return { profile, contentCount, subscriberCount, recentRevenue };
}
```

## Exceptions

- **Dependent operations** — if operation B needs the result of operation A, they must be sequential. `const user = await getUser(id); const posts = await getPosts(user.creatorId);` is correct.
- **Rate-limited APIs** — if an external API (Stripe, Shopify) has tight rate limits, sequential calls may be intentional to avoid 429s. Comment the reason.
- **Transaction ordering** — database operations within a transaction must follow the transaction's ordering requirements.
- **Error short-circuiting** — if a failure in the first call means the second is pointless, sequential `await` with an early return between them is clearer than `Promise.all` + post-hoc checking.

## Scope

- Applies to: route loaders, route handlers, service functions, any async function with 2+ independent awaits
- Does NOT apply to: test files (sequential setup is often intentional for clarity), migration scripts
