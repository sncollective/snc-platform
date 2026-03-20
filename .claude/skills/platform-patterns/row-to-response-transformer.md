# Pattern: Row-to-Response Transformer

Private helper functions that convert DB row shapes (Date objects, storage keys) to API response shapes (ISO strings, derived URLs). Each route file defines its own `toXxxResponse()` functions in the `// ── Private Helpers ──` section.

## Rationale

Drizzle returns `Date` objects and raw storage keys; the API contract requires ISO strings and computed URLs. Centralizing this conversion in named helpers keeps handlers concise, makes the transformation explicit, and enables composition (e.g., `toBookingWithServiceResponse` calls `toServiceResponse` for the nested object).

## Examples

### Example 1: Simple flat transformer
**File**: `apps/api/src/routes/booking.routes.ts:51`
```typescript
// ── Private Types ──
type ServiceRow = typeof services.$inferSelect;

// ── Private Helpers ──
const toServiceResponse = (row: ServiceRow): Service => ({
  id: row.id,
  name: row.name,
  description: row.description,
  pricingInfo: row.pricingInfo,
  active: row.active,
  sortOrder: row.sortOrder,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});
```

### Example 2: Composed transformer with nested object
**File**: `apps/api/src/routes/booking.routes.ts:66`
```typescript
const toBookingWithServiceResponse = (
  booking: BookingRequestRow,
  service: ServiceRow,
): BookingWithService => ({
  id: booking.id,
  userId: booking.userId,
  serviceId: booking.serviceId,
  preferredDates: booking.preferredDates,
  notes: booking.notes,
  status: booking.status as BookingStatus,
  reviewedBy: booking.reviewedBy ?? null,
  reviewNote: booking.reviewNote ?? null,
  createdAt: booking.createdAt.toISOString(),
  updatedAt: booking.updatedAt.toISOString(),
  service: toServiceResponse(service),   // composed from sibling transformer
});
```

### Example 3: Transformer with URL derivation from storage keys
**File**: `apps/api/src/routes/content.routes.ts:61`
```typescript
const resolveContentUrls = (row: ContentRow): ContentResponse => ({
  id: row.id,
  creatorId: row.creatorId,
  type: row.type as ContentType,
  title: row.title,
  body: row.body ?? null,
  thumbnailUrl: row.thumbnailKey
    ? `/api/content/${row.id}/thumbnail`
    : null,
  mediaUrl: row.mediaKey
    ? `/api/content/${row.id}/media`
    : null,
  publishedAt: row.publishedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});
```

### Example 4: Plan transformer for subscription domain
**File**: `apps/api/src/routes/subscription.routes.ts:59`
```typescript
const toPlanResponse = (row: PlanRow): SubscriptionPlan => ({
  id: row.id,
  name: row.name,
  type: row.type as PlanType,
  creatorId: row.creatorId ?? null,
  price: row.price,
  interval: row.interval as PlanInterval,
  active: row.active,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});
```

## When to Use

- Any route handler that maps DB rows to API response shapes
- When dates need `.toISOString()` conversion
- When storage keys need to become media/resource URLs
- When a response embeds a nested object from a joined table (compose transformers)

## When NOT to Use

- Don't put business logic (access checks, DB queries) in transformers — they are pure functions
- Don't share transformers across route files — keep them private to their route module
- Don't transform in the middle of a handler — always call the transformer at the end before returning

## Common Violations

- Calling `.toISOString()` inline inside handlers instead of in the transformer — breaks DRY
- Forgetting nullable fields: use `?? null` for optional columns, `?.toISOString() ?? null` for nullable dates
- Adding DB queries inside a transformer — transformers must be synchronous and pure
- Return type not referencing the shared type (e.g., `Service` from `@snc/shared`) — inline return types create drift risk; vertical slice analysis checks this
