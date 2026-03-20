# Pattern: Drizzle Chainable Mock

Mock Drizzle ORM's fluent query builder using `vi.fn()` stubs wired in a chain. Intermediate nodes return objects with the next method; terminal nodes return resolved promises. Chains are re-wired in `beforeEach` after `vi.resetAllMocks()` clears them.

## Rationale

Drizzle queries are built via method chaining (`.select().from().where().orderBy().limit()`). Mocking the `db` object requires matching the chain shape exactly. Declaring each node as a separate `vi.fn()` lets tests override individual nodes (e.g., only the terminal `.limit()`) without touching the rest of the chain.

## Examples

### Example 1: SELECT + JOIN + INSERT chains
**File**: `apps/api/tests/routes/booking.routes.test.ts:17`
```typescript
// ── Mock DB Chains ──

// SELECT: db.select().from(table).where(...).orderBy(...)
const mockLimit = vi.fn();
const mockOrderBy = vi.fn();
const mockSelectWhere = vi.fn();

// JOIN chain: db.select().from(table).innerJoin(...).where(...).orderBy(...).limit(...)
const mockJoinLimit = vi.fn();
const mockJoinOrderBy = vi.fn();
const mockJoinWhere = vi.fn();
const mockInnerJoin = vi.fn();

const mockSelectFrom = vi.fn();
const mockSelect = vi.fn();

// INSERT: db.insert(table).values({}).returning()
const mockInsertReturning = vi.fn();
const mockInsertValues = vi.fn();
const mockInsert = vi.fn();

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
};
```

Re-wired in `beforeEach` after `vi.resetAllMocks()`:
```typescript
beforeEach(async () => {
  vi.resetAllMocks();

  // SELECT chain
  mockSelect.mockReturnValue({ from: mockSelectFrom });
  mockSelectFrom.mockReturnValue({ where: mockSelectWhere, innerJoin: mockInnerJoin });
  mockSelectWhere.mockReturnValue({ orderBy: mockOrderBy });
  mockOrderBy.mockResolvedValue([]);      // terminal — default empty

  // JOIN chain
  mockInnerJoin.mockReturnValue({ where: mockJoinWhere });
  mockJoinWhere.mockReturnValue({ orderBy: mockJoinOrderBy, limit: mockJoinLimit });
  mockJoinOrderBy.mockReturnValue({ limit: mockJoinLimit });
  mockJoinLimit.mockResolvedValue([]);    // terminal — default empty

  // INSERT chain
  mockInsert.mockReturnValue({ values: mockInsertValues });
  mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
  mockInsertReturning.mockResolvedValue([]);

  app = await setupBookingApp();
});
```

Per-test override example:
```typescript
it("returns services", async () => {
  const service = makeMockService();
  mockOrderBy.mockResolvedValue([service]);   // override only terminal node
  const res = await app.request("/api/services");
  expect(res.status).toBe(200);
});
```

### Example 2: SELECT + UPDATE chains
**File**: `apps/api/tests/routes/subscription.routes.test.ts:17`
```typescript
// SELECT
const mockSelectWhere = vi.fn();
const mockJoinWhere = vi.fn();
const mockInnerJoin = vi.fn(() => ({ where: mockJoinWhere }));
const mockSelectFrom = vi.fn(() => ({
  where: mockSelectWhere,
  innerJoin: mockInnerJoin,
}));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

// UPDATE: db.update(table).set({}).where(...).returning()
const mockUpdateReturning = vi.fn();
const mockUpdateWhere = vi.fn(() => {
  const promise = Promise.resolve(undefined);
  (promise as any).returning = mockUpdateReturning;
  return promise;
});
const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

const mockDb = {
  select: mockSelect,
  update: mockUpdate,
};
```

### Example 3: SELECT + INSERT + UPDATE chains with feed join
**File**: `apps/api/tests/routes/content.routes.test.ts:16`
```typescript
const mockSelectWhere = vi.fn();

// Feed query: select → from → innerJoin → where → orderBy → limit
const mockLimit = vi.fn();
const mockOrderBy = vi.fn(() => ({ limit: mockLimit }));
const mockSubLimit = vi.fn();
const mockFeedWhere = vi.fn(() => ({ orderBy: mockOrderBy, limit: mockSubLimit }));
const mockInnerJoin = vi.fn(() => ({ where: mockFeedWhere }));

const mockSelectFrom = vi.fn(() => ({
  where: mockSelectWhere,
  innerJoin: mockInnerJoin,
}));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

const mockInsertReturning = vi.fn();
const mockInsertValues = vi.fn(() => ({ returning: mockInsertReturning }));
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

const mockUpdateReturning = vi.fn();
const mockUpdateWhere = vi.fn(() => {
  const promise = Promise.resolve(undefined);
  (promise as any).returning = mockUpdateReturning;
  return promise;
});
const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

const mockDb = { select: mockSelect, insert: mockInsert, update: mockUpdate };
```

## When to Use

- Any API route test that needs to mock Drizzle DB queries
- Must use `vi.doMock("../../src/db/connection.js", () => ({ db: mockDb, sql: vi.fn() }))` to inject the mock db

## When NOT to Use

- Integration tests that use a real PostgreSQL container — those use the actual `db` object
- Tests for pure utility functions that don't touch the database

## Common Violations

- Forgetting to call `vi.resetAllMocks()` in `beforeEach` and re-establish chains — stale return values cause test pollution
- Setting chain return values in the `vi.fn()` declaration instead of `beforeEach` — those get cleared by `vi.resetAllMocks()`
- Omitting a chain node (e.g., missing `.orderBy`) — Drizzle queries calling that method will throw "not a function"
- Using `.mockResolvedValue()` on intermediate nodes (should be `.mockReturnValue()`) or `.mockReturnValue()` on terminal nodes (should be `.mockResolvedValue()`)
