# Pattern: Dual-Layer Fixtures

Each domain has two fixture files: one in `apps/api/tests/helpers/` with DB-layer shapes (Date objects, storage keys) and one in `apps/web/tests/helpers/` with API response shapes (ISO strings, URLs). Both export `makeMock{Domain}(overrides?: Partial<T>): T` factories.

## Rationale

The API returns JSON (ISO strings, media URLs) while the database holds Date objects and storage keys. Tests at each layer need shapes matching the actual data their code processes. Keeping both sets of fixtures in their respective test helpers prevents type mismatches and makes the DB↔API contract explicit.

## Examples

### Example 1: Booking fixtures — API layer (Date objects)
**File**: `apps/api/tests/helpers/booking-fixtures.ts:29`
```typescript
type DbServiceRow = {
  id: string;
  name: string;
  createdAt: Date;   // Date object — matches Drizzle $inferSelect
  updatedAt: Date;
  // ...
};

export const makeMockService = (
  overrides?: Partial<DbServiceRow>,
): DbServiceRow => ({
  id: "svc_test_recording",
  name: "Recording Session",
  description: "Professional studio recording session with engineer.",
  pricingInfo: "$50/hour",
  active: true,
  sortOrder: 0,
  createdAt: new Date("2026-01-15T10:00:00.000Z"),  // Date object
  updatedAt: new Date("2026-01-15T10:00:00.000Z"),  // Date object
  ...overrides,
});
```

### Example 2: Booking fixtures — Web layer (ISO strings)
**File**: `apps/web/tests/helpers/booking-fixtures.ts:5`
```typescript
import type { Service, BookingWithService } from "@snc/shared";

export const makeMockService = (
  overrides?: Partial<Service>,
): Service => ({
  id: "svc_test_recording",
  name: "Recording Session",
  createdAt: "2026-01-15T10:00:00.000Z",   // ISO string — matches JSON response
  updatedAt: "2026-01-15T10:00:00.000Z",   // ISO string
  // ...
  ...overrides,
});

export const makeMockBookingWithService = (
  overrides?: Partial<BookingWithService>,
): BookingWithService => ({
  id: "bk_test_001",
  // ...
  service: {                               // nested object inline (web fixtures only)
    id: "svc_test_recording",
    name: "Recording Session",
    createdAt: "2026-01-15T10:00:00.000Z",
    // ...
  },
  ...overrides,
});
```

### Example 3: Content fixtures — both layers
**File**: `apps/api/tests/helpers/content-fixtures.ts` — `makeMockDbContent()` with `thumbnailKey: "thumbs/key.jpg"` and `Date` objects

**File**: `apps/web/tests/helpers/content-fixtures.ts` — `makeMockFeedItem()` with `thumbnailUrl: "http://localhost:3000/api/content/..."` and ISO strings

### Example 4: Creator fixtures — both layers
**File**: `apps/api/tests/helpers/creator-fixtures.ts` — `makeMockDbCreatorProfile()` with `avatarKey`, `bannerKey` (storage keys) and `Date` objects

**File**: `apps/web/tests/helpers/creator-fixtures.ts` — `makeMockCreatorListItem()` with `avatarUrl`, `bannerUrl` (derived URLs) and ISO strings

## When to Use

- API route tests: import from `apps/api/tests/helpers/{domain}-fixtures.ts`
- Web component/lib tests: import from `apps/web/tests/helpers/{domain}-fixtures.ts`
- Shared package tests: use inline constants (no fixture file needed, schemas are the types)

## When NOT to Use

- Don't use API-layer fixtures in web tests — `Date` objects will not match JSON strings
- Don't use web-layer fixtures in API route tests — ISO strings won't match Drizzle rows

## Common Violations

- Importing the wrong layer's fixture (e.g., using `makeMockService` from `api/tests/helpers` in a web component test) — types will differ and TypeScript may not catch it if shapes are similar
- Defining `Date` objects in web fixtures — web layer always receives ISO strings from `JSON.parse`
- Omitting nested objects in web fixtures that the component expects (e.g., `BookingWithService.service`) — leads to runtime property access errors in tests
- Using `new Date()` (non-deterministic) in fixtures instead of fixed ISO strings
- Non-format default values (IDs, names, booleans, enums) differing between API and web fixtures for the same entity — vertical slice analysis flags these
