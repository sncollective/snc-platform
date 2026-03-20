# Pattern: Cursor Encode/Decode

Base64URL keyset cursor utility with tie-breaking SQL for stable cursor pagination.

## Rationale
Offset-based pagination (`OFFSET N`) degrades with large datasets and produces inconsistent results when rows are inserted concurrently. Keyset pagination using encoded cursors solves both: the cursor encodes the last-seen row's sort key, and the SQL `OR` condition skips all previously seen rows efficiently via index.

## Examples

### Example 1: Cursor utility module
**File**: `apps/api/src/routes/cursor.ts:1`
```typescript
import { ValidationError } from "@snc/shared";

export const encodeCursor = (data: Record<string, string>): string =>
  Buffer.from(JSON.stringify(data)).toString("base64url");

export const decodeCursor = (
  cursor: string,
  fields: { timestampField: string; idField: string },
): { timestamp: Date; id: string } => {
  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf-8"),
    );
    if (
      typeof decoded[fields.timestampField] !== "string" ||
      typeof decoded[fields.idField] !== "string"
    ) {
      throw new ValidationError("Invalid cursor format");
    }
    const timestamp = new Date(decoded[fields.timestampField] as string);
    if (isNaN(timestamp.getTime())) {
      throw new ValidationError("Invalid cursor date");
    }
    return { timestamp, id: decoded[fields.idField] as string };
  } catch (e) {
    if (e instanceof ValidationError) throw e;
    throw new ValidationError("Invalid cursor");
  }
};
```

### Example 2: buildPaginatedResponse helper (extracted in phase 10)
**File**: `apps/api/src/routes/cursor.ts:36`
```typescript
/**
 * Given rows fetched with limit+1, determine if there's a next page,
 * pop the overflow row, and encode the cursor from the last item.
 * Returns { items: T[], nextCursor: string | null }.
 */
export function buildPaginatedResponse<T>(
  rows: T[],
  limit: number,
  cursorFields: (lastItem: T) => Record<string, string>,
): { items: T[]; nextCursor: string | null } {
  let nextCursor: string | null = null;
  if (rows.length > limit) {
    rows.pop();
    const lastItem = rows[rows.length - 1]!;
    nextCursor = encodeCursor(cursorFields(lastItem));
  }
  return { items: rows, nextCursor };
}
```

### Example 3: buildPaginatedResponse in booking list route
**File**: `apps/api/src/routes/booking.routes.ts:305`
```typescript
// DESC order for user's own bookings (newest first)
const rawItems = await db
  .select({ booking_requests, services })
  .from(bookingRequests)
  .innerJoin(services, eq(bookingRequests.serviceId, services.id))
  .where(and(...conditions))
  .orderBy(desc(bookingRequests.createdAt), desc(bookingRequests.id))
  .limit(limit + 1);

const { items: pagedItems, nextCursor } = buildPaginatedResponse(
  rawItems,
  limit,
  (last) => ({
    createdAt: last.booking_requests.createdAt.toISOString(),
    id: last.booking_requests.id,
  }),
);
```

### Example 4: buildPaginatedResponse in creator list route
**File**: `apps/api/src/routes/creator.routes.ts:279`
```typescript
const { items: rawRows, nextCursor } = buildPaginatedResponse(
  rows,
  limit,
  (last) => ({
    createdAt: last.createdAt.toISOString(),
    userId: last.userId,
  }),
);
```

## When to Use
- Any list endpoint that needs reliable, consistent pagination over large datasets
- Use `buildPaginatedResponse(rows, limit, cursorFields)` to encapsulate the limit+1 / pop / encode pattern — all new routes should use this helper rather than implementing it inline
- When sort order uses a timestamp column that may have duplicates (tie-breaking by ID ensures stability)
- When items can be inserted between page fetches (keyset handles this correctly; offset does not)
- For ASC-ordered queues (admin review lists), use `gt()` operators instead of `lt()` for the cursor condition

## When NOT to Use
- Very small static datasets where simple `LIMIT/OFFSET` is fine
- When arbitrary page jumps ("go to page 5") are required — cursors only support sequential traversal

## Common Violations
- **Encoding only the timestamp**: Without an ID tie-breaker, two rows with the same timestamp will cause rows to be skipped or repeated. Always encode both `timestamp` + unique `id`.
- **Using `LIMIT/OFFSET` with cursors**: The cursor *replaces* the offset; never add an `OFFSET` clause when using cursor conditions.
- **Skipping validation in `decodeCursor`**: Always validate field presence and timestamp parsability — malformed cursors should throw `ValidationError`, not crash with a 500.
- **Implementing limit+1 / pop / encode inline**: Use `buildPaginatedResponse` instead — ensures consistent behavior across all routes.
