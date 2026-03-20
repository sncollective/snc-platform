# Pattern: Fake Timers Deterministic Testing

`vi.useFakeTimers()` + `vi.setSystemTime(date)` freeze the system clock in each test, making time-dependent logic (date formatting, date range calculations, polling intervals) fully deterministic. Always restore with `vi.useRealTimers()` after the test.

## Rationale

Code that calls `new Date()`, `Date.now()`, or `setTimeout` produces non-deterministic results in tests. Vitest's fake timers replace these with controllable stubs, letting tests assert exact behavior for "current month", "relative date formatting", "X minutes ago", and polling loops without flaky timing dependencies.

## Examples

### Example 1: Revenue aggregation service — freeze month boundary
**File**: `apps/api/tests/services/revenue.test.ts:55`
```typescript
it("groups invoices by year and month and sums amount_paid", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-15T12:00:00Z"));

  const invoices = [
    makeMockStripeInvoice({ amount_paid: 1000, created: /* March 5 */ }),
    makeMockStripeInvoice({ amount_paid: 500,  created: /* Feb 15  */ }),
  ];
  mockInvoicesList.mockReturnValue(makeAsyncIterable(invoices));

  const result = await getMonthlyRevenue(3);
  expect(result.value[0]).toEqual({ month: 3, year: 2026, amount: 1000 });
  expect(result.value[1]).toEqual({ month: 2, year: 2026, amount: 500 });

  vi.useRealTimers();
});
```

### Example 2: formatRelativeDate utility — freeze "now" for relative labels
**File**: `apps/web/tests/unit/lib/format.test.ts:12`
```typescript
const NOW = new Date("2026-02-26T12:00:00Z");

it("returns 'just now' for dates less than 60 seconds ago", () => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  const thirtySecondsAgo = new Date(NOW.getTime() - 30 * 1000).toISOString();
  expect(formatRelativeDate(thirtySecondsAgo)).toBe("just now");
  vi.useRealTimers();
});

it("returns 'Xm ago' for dates less than 60 minutes ago", () => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  const fiveMinutesAgo = new Date(NOW.getTime() - 5 * 60 * 1000).toISOString();
  expect(formatRelativeDate(fiveMinutesAgo)).toBe("5m ago");
  vi.useRealTimers();
});
```

### Example 3: Checkout success page — advance fake timers for polling
**File**: `apps/web/tests/unit/routes/checkout-success.test.tsx:107`
```typescript
it("polls for subscription activation and shows success when found", async () => {
  vi.useFakeTimers();
  mockFetchMySubscriptions
    .mockResolvedValueOnce([])
    .mockResolvedValue([makeMockUserSubscription({ status: "active" })]);

  render(<CheckoutSuccessPage />);
  // Advance time to trigger polling interval
  await vi.advanceTimersByTimeAsync(3000);
  expect(screen.getByText(/subscription activated/i)).toBeInTheDocument();

  vi.useRealTimers();
});
```

## When to Use
- Any test for logic that reads the current date/time (`new Date()`, `Date.now()`)
- Testing functions that calculate relative time ("X minutes ago", "current month revenue")
- Testing polling loops or `setTimeout`/`setInterval` with `vi.advanceTimersByTimeAsync()`
- Testing time-range queries (start-of-month, end-of-year boundaries)

## When NOT to Use
- Tests that don't involve time-dependent logic — fake timers add overhead
- Integration tests against a real database — use real timers there

## Common Violations
- **Forgetting `vi.useRealTimers()`**: Leaks fake timers into subsequent tests, causing failures. Always restore, even in `afterEach` if multiple tests use fake timers.
- **Not setting system time**: `vi.useFakeTimers()` alone freezes the clock at the time the test suite started, producing inconsistent results. Always follow with `vi.setSystemTime(specificDate)`.
- **Asserting exact timestamps without freezing time**: `expect(result.date).toBe(new Date().toISOString())` is flaky. Use fake timers + a fixed date instead.
