# Pattern: vi-import-original-partial-mock

Partially mock a module with `vi.mock(module, async (importOriginal) => ...)` to replace
only the async/side-effectful exports while preserving real pure utility functions.

## Rationale

Some modules export a mix of pure utility functions (e.g., `hasPlatformSubscription`,
`formatDate`) and async fetchers (e.g., `fetchPlans`, `createCheckout`). Using a plain
`vi.mock()` factory would require re-implementing all the pure functions. Using
`importOriginal`, the real module is imported and spread, then specific functions are
overridden — keeping pure logic testable as-is.

## Examples

### Example 1: Preserve pure utility, mock async fetchers (subscription module)

**File**: `apps/web/tests/unit/components/landing/landing-pricing.test.tsx:44`
```typescript
const { mockFetchPlans, mockCreateCheckout, mockFetchMySubscriptions } = vi.hoisted(() => ({
  mockFetchPlans: vi.fn(),
  mockCreateCheckout: vi.fn(),
  mockFetchMySubscriptions: vi.fn(),
}));

vi.mock("../../../../src/lib/subscription.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/lib/subscription.js")>();
  return {
    ...actual,                                // keeps hasPlatformSubscription, cancelSubscription
    fetchPlans: mockFetchPlans,               // override async fetchers
    createCheckout: mockCreateCheckout,
    fetchMySubscriptions: mockFetchMySubscriptions,
  };
});
```

### Example 2: Preserve all format utilities, mock only formatDate

**File**: `apps/web/tests/unit/components/subscription-list.test.tsx:9`
```typescript
const { mockFormatDate } = vi.hoisted(() => ({
  mockFormatDate: vi.fn(),
}));

vi.mock("../../../src/lib/format.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/lib/format.js")>();
  return {
    ...actual,               // keeps formatRelativeDate, formatTime, formatPrice, etc.
    formatDate: mockFormatDate,
  };
});
```

### Example 3: Same pattern in pricing route test

**File**: `apps/web/tests/unit/routes/pricing.test.tsx`
```typescript
vi.mock("../../../src/lib/subscription.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/lib/subscription.js")>();
  return {
    ...actual,
    fetchPlans: mockFetchPlans,
    fetchMySubscriptions: mockFetchMySubscriptions,
  };
});
```

### Example 4: Always pair with vi.hoisted() for mock factory references

The mock factories must be declared before `vi.mock()` runs. Use `vi.hoisted()` to
lift the `vi.fn()` declarations:

**File**: `apps/web/tests/unit/components/landing/hero-section.test.tsx:13`
```typescript
// Step 1: hoist mock function references
const { mockFetchPlans, mockCreateCheckout, mockFetchMySubscriptions } = vi.hoisted(() => ({
  mockFetchPlans: vi.fn(),
  mockCreateCheckout: vi.fn(),
  mockFetchMySubscriptions: vi.fn(),
}));

// Step 2: partial mock using importOriginal
vi.mock("../../../../src/lib/subscription.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/lib/subscription.js")>();
  return { ...actual, fetchPlans: mockFetchPlans, createCheckout: mockCreateCheckout,
    fetchMySubscriptions: mockFetchMySubscriptions };
});

// Step 3: import the component AFTER all mocks
import { HeroSection } from "../../../../src/components/landing/hero-section.js";
```

## When to Use

- A module exports both pure utility functions and async/side-effectful functions
- You want to keep real utility logic (e.g., `hasPlatformSubscription`) exercised in tests
- Replacing the entire module would require duplicating non-trivial pure logic

## When NOT to Use

- All exports in the module need to be mocked — use a plain `vi.mock()` factory instead
- The module only exports async functions — no advantage over plain `vi.mock()`
- Use with `vi.doMock()` + dynamic `import()` (for eagerly-initialized singletons) — see
  `vi-doMock-dynamic-import.md` for that pattern

## Common Violations

- **Forgetting `vi.hoisted()`**: mock function references won't be available inside the
  `vi.mock()` factory unless hoisted — this causes "Cannot access before initialization" errors.
- **Not spreading `actual`**: omitting `...actual` silently drops all real exports, making
  pure utility functions return `undefined`.
- **Using `importOriginal` with `vi.doMock()`**: `importOriginal` is only available in
  the static `vi.mock()` factory form.
