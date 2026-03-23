# Performance: Query Efficiency

> Flag database queries inside loops and independent queries that could be batched.

## What to Flag

- `await` inside `for`/`forEach`/`map` loops that hit the database (N+1 pattern)
- Sequential `await` calls for independent DB queries that could use `Promise.all`
- Missing Drizzle `with()` for relational loads — separate queries for parent + children when a single relational query would suffice
- Queries inside route handlers that could be moved to a service and batched

## What NOT to Flag

- Sequential queries where one depends on the other's result (data dependency)
- Post-fetch mapping in loops (iterating over results, not querying per iteration)
- Queries already wrapped in `Promise.all`
- Single-row lookups by primary key (no batching opportunity)
- For general independent async operations (HTTP calls, file I/O), see the `concurrent-awaits` rule in scan-stylistic — this category is DB-specific

## From This Codebase

**Not flaggable**: `dashboard.routes.ts` line 110 — `const [[totalRow], [pendingRow]] = await Promise.all([...])` correctly batches two independent count queries into one concurrent request.

**Not flaggable**: `emissions.routes.ts` line 138 — batches 5 separate queries with `const [summary, byScope, byCategory, monthly, entries] = await Promise.all([...])`.

**Not flaggable**: `content.routes.ts` line 749 — `await Promise.all(...)` for concurrent deletes.

**Flaggable pattern** (synthetic, based on codebase structure):
```typescript
// BAD: N+1 — queries user for each booking
const bookings = await db.select().from(bookingRequests);
for (const booking of bookings) {
  booking.user = await db.select().from(users).where(eq(users.id, booking.userId));
}

// GOOD: single relational query or batched lookup
const bookings = await db.query.bookingRequests.findMany({
  with: { user: true },
});
```

## Confidence

- N+1 query (await in loop body) → **high** (Fix lane)
- Independent queries not batched with Promise.all → **high** (Fix lane)
- Relational query opportunity (with() vs separate queries) → **medium** (Analyze lane)
