# Pattern: Cursor Encode/Decode

Base64URL keyset cursor utility with `buildCursorCondition` for tie-breaking SQL and `buildPaginatedResponse` for limit+1 pagination. Located at `apps/api/src/lib/cursor.ts`.

## Rationale
Offset-based pagination (`OFFSET N`) degrades with large datasets and produces inconsistent results when rows are inserted concurrently. Keyset pagination using encoded cursors solves both: the cursor encodes the last-seen row's sort key, and the SQL `OR` condition skips all previously seen rows efficiently via index.

## Examples

### Example 1: Cursor utility module
**File**: `apps/api/src/lib/cursor.ts:1`
```typescript
import type { Column, SQL } from "drizzle-orm";
import { and, eq, gt, lt, or } from "drizzle-orm";
import { ValidationError } from "@snc/shared";

export const encodeCursor = (data: Readonly<Record<string, string>>): string =>
  Buffer.from(JSON.stringify(data)).toString("base64url");

/**
 * Decodes a base64url cursor and returns the raw JSON object.
 * Use for cursors whose fields are opaque strings (e.g., Shopify endCursor)
 * rather than the typed keyset `{ timestamp, id }` expected by `decodeCursor`.
 */
export const decodeRawCursor = (cursor: string): Record<string, string> => {
  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf-8"),
    );
    if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) {
      throw new ValidationError("Invalid cursor format");
    }
    return decoded as Record<string, string>;
  } catch (e) {
    if (e instanceof ValidationError) throw e;
    throw new ValidationError("Invalid cursor");
  }
};

export const decodeCursor = (
  cursor: string,
  fields: { timestampField: string; idField: string },
): { timestamp: Date; id: string } => {
  // ... validates and parses typed keyset cursor (timestamp + id)
};
```

### Example 2: buildCursorCondition helper
**File**: `apps/api/src/lib/cursor.ts:61`
```typescript
/**
 * Builds the keyset pagination WHERE condition for a timestamp + id cursor.
 * DESC: rows where timestamp < decoded OR (timestamp = decoded AND id < decoded)
 * ASC:  rows where timestamp > decoded OR (timestamp = decoded AND id > decoded)
 */
export function buildCursorCondition(
  timestampCol: Column,
  idCol: Column,
  decoded: { timestamp: Date; id: string },
  direction: "asc" | "desc",
): SQL {
  const cmp = direction === "desc" ? lt : gt;
  return or(
    cmp(timestampCol, decoded.timestamp),
    and(eq(timestampCol, decoded.timestamp), cmp(idCol, decoded.id)),
  ) as SQL;
}
```

### Example 3: buildPaginatedResponse helper (non-mutating)
**File**: `apps/api/src/lib/cursor.ts:79`
```typescript
/**
 * Given rows fetched with limit+1, determine if there's a next page,
 * slice to limit (non-mutating), and encode the cursor from the last item.
 */
export function buildPaginatedResponse<T>(
  rows: T[],
  limit: number,
  cursorFields: (lastItem: T) => Record<string, string>,
): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  let nextCursor: string | null = null;
  if (hasMore) {
    const lastItem = items[items.length - 1]!;
    nextCursor = encodeCursor(cursorFields(lastItem));
  }
  return { items, nextCursor };
}
```

### Example 4: buildPaginatedResponse in booking list route
**File**: `apps/api/src/routes/booking.routes.ts`
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

### Example 5: buildPaginatedResponse in creator list route
**File**: `apps/api/src/routes/creator.routes.ts`
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
- Use `buildPaginatedResponse(rows, limit, cursorFields)` to encapsulate the limit+1 / slice / encode pattern — all new routes should use this helper rather than implementing it inline
- Use `buildCursorCondition(timestampCol, idCol, decoded, direction)` for the keyset WHERE clause — handles both ASC and DESC via a `direction` parameter
- Use `decodeRawCursor` for opaque cursors (e.g., Shopify `endCursor`) where fields aren't timestamp+id
- When sort order uses a timestamp column that may have duplicates (tie-breaking by ID ensures stability)
- When items can be inserted between page fetches (keyset handles this correctly; offset does not)

## When NOT to Use
- Very small static datasets where simple `LIMIT/OFFSET` is fine
- When arbitrary page jumps ("go to page 5") are required — cursors only support sequential traversal

## Common Violations
- **Encoding only the timestamp**: Without an ID tie-breaker, two rows with the same timestamp will cause rows to be skipped or repeated. Always encode both `timestamp` + unique `id`.
- **Using `LIMIT/OFFSET` with cursors**: The cursor *replaces* the offset; never add an `OFFSET` clause when using cursor conditions.
- **Skipping validation in `decodeCursor`**: Always validate field presence and timestamp parsability — malformed cursors should throw `ValidationError`, not crash with a 500.
- **Implementing limit+1 / slice / encode inline**: Use `buildPaginatedResponse` instead — ensures consistent behavior across all routes.
- **Inlining cursor WHERE conditions**: Use `buildCursorCondition` instead — handles ASC/DESC direction and the `or(cmp, and(eq, cmp))` pattern correctly.
