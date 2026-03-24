# Rule: Exported Functions Undocumented

> Every exported function in Always-tier scope must have a `/** */` comment explaining its purpose.

## Motivation

Exported functions are the API surface of a module. When another file imports a function, the developer
(or agent) relies on IDE hover tooltips to understand what it does, what it expects, and what can go
wrong. Without a `/** */` comment, the tooltip shows only the type signature — which answers "what
shape" but not "why" or "when."

The platform already has strong examples of well-documented exports. This rule catches the gaps.

## Before / After

### From this codebase: undocumented dashboard helpers

**Before:** (actual code from `apps/web/src/lib/dashboard.ts`)
```typescript
export async function fetchRevenue(): Promise<RevenueResponse> {
  return apiGet<RevenueResponse>("/api/dashboard/revenue");
}

export async function fetchSubscribers(): Promise<SubscriberSummary> {
  return apiGet<SubscriberSummary>("/api/dashboard/subscribers");
}

export async function reviewBooking(
  id: string,
  data: ReviewBookingRequest,
): Promise<BookingWithService> {
  const result = await apiMutate<{ booking: BookingWithService }>(
    `/api/bookings/${encodeURIComponent(id)}/review`,
    { method: "PATCH", body: data },
  );
  return result.booking;
}
```

**After:**
```typescript
/** Fetch monthly revenue data for the cooperative dashboard. */
export async function fetchRevenue(): Promise<RevenueResponse> {
  return apiGet<RevenueResponse>("/api/dashboard/revenue");
}

/** Fetch subscriber count summary for the cooperative dashboard. */
export async function fetchSubscribers(): Promise<SubscriberSummary> {
  return apiGet<SubscriberSummary>("/api/dashboard/subscribers");
}

/**
 * Approve or deny a pending booking request.
 * Unwraps the nested `booking` field from the API response.
 */
export async function reviewBooking(
  id: string,
  data: ReviewBookingRequest,
): Promise<BookingWithService> {
  const result = await apiMutate<{ booking: BookingWithService }>(
    `/api/bookings/${encodeURIComponent(id)}/review`,
    { method: "PATCH", body: data },
  );
  return result.booking;
}
```

### From this codebase: well-documented exports (gold standard)

**Already correct:** (actual code from `apps/web/src/lib/fetch-utils.ts`)
```typescript
/**
 * Extracts the error message from a non-OK response.
 * Tries to parse JSON body for `error.message`, falls back to `statusText`.
 */
export async function extractErrorMessage(response: Response): Promise<string> { ... }

/** GET with optional query params. Always sends session cookie. */
export async function apiGet<T>(endpoint: string, ...): Promise<T> { ... }

/** POST/PATCH/DELETE with JSON body. Always sends session cookie. */
export async function apiMutate<T>(endpoint: string, ...): Promise<T> { ... }
```
These are correct — concise, intent-focused, no type restatement.

## Exceptions

- **`index.ts` re-exports** — barrel files that re-export from other modules don't need docs (the source module has them)
- **Self-documenting one-liners** — `export const API_BASE_URL = "/api"` doesn't need `/** The API base URL. */`
- **Test files** — test helpers and fixtures don't need JSDoc
- **Trivial private helpers** — unexported functions under 10 lines with clear names

## Scope

- **Scan:** `apps/api/src/`, `apps/web/src/`, `packages/shared/src/` — all `.ts` and `.tsx` files
- **Exclude:** `tests/`, `*.test.ts`, `*.spec.ts`, `index.ts` (barrel re-exports), `*.schema.ts` (Drizzle schemas), `*.module.css`
- **Focus on Always-tier:** exported functions from `packages/shared/`, `services/`, middleware factories, `lib/` utilities, hooks, context providers
