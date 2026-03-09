# Pattern: Web Fetch Client

Thin async functions in `apps/web/src/lib/` wrap each API endpoint using `apiGet<T>()` / `apiMutate<T>()` / `apiUpload<T>()` generic helpers from `fetch-utils.ts`. All three helpers handle session-cookie forwarding (`credentials: "include"`) and structured error extraction.

## Rationale

All API calls from the frontend need consistent session-cookie forwarding (`credentials: "include"`), URL construction with optional query params, and structured error extraction matching the `{ error: { message } }` response body shape. `apiGet`/`apiMutate`/`apiUpload` eliminate per-caller boilerplate; `throwIfNotOk` underlies all three and can still be imported directly for edge cases.

## Examples

### Example 1: apiGet, apiMutate, and apiUpload helpers in fetch-utils.ts
**File**: `apps/web/src/lib/fetch-utils.ts`
```typescript
/** GET with optional query params and optional AbortSignal. Always sends session cookie. */
export async function apiGet<T>(
  endpoint: string,
  params?: Record<string, string | number | undefined>,
  signal?: AbortSignal,
): Promise<T> {
  let url = endpoint;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) searchParams.set(key, String(value));
    }
    const qs = searchParams.toString();
    if (qs) {
      url = `${endpoint}?${qs}`;
    }
  }
  const response = await fetch(url, { credentials: "include", signal });
  await throwIfNotOk(response);
  return (await response.json()) as T;
}

/** POST with FormData body (multipart). Always sends session cookie. */
export async function apiUpload<T>(
  endpoint: string,
  formData: FormData,
): Promise<T> {
  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  await throwIfNotOk(response);
  return (await response.json()) as T;
}

/** POST/PATCH/DELETE with JSON body. Always sends session cookie.
 *  Returns undefined for 204 No Content responses (use apiMutate<void>). */
export async function apiMutate<T>(
  endpoint: string,
  options: { method?: string; body?: unknown },
): Promise<T> {
  const init: RequestInit = {
    method: options.method ?? "POST",
    credentials: "include",
    headers: options.body !== undefined
      ? { "Content-Type": "application/json" }
      : {},
  };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }
  const response = await fetch(endpoint, init);
  await throwIfNotOk(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
```

### Example 2: Dashboard lib uses apiGet and apiMutate
**File**: `apps/web/src/lib/dashboard.ts`
```typescript
import { apiGet, apiMutate } from "./fetch-utils.js";

export async function fetchRevenue(): Promise<RevenueResponse> {
  return apiGet<RevenueResponse>("/api/dashboard/revenue");
}

export async function fetchPendingBookings(params?: {
  cursor?: string;
  limit?: number;
}): Promise<PendingBookingsResponse> {
  return apiGet<PendingBookingsResponse>("/api/bookings/pending", params);
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

### Example 3: Content lib uses apiUpload for file uploads
**File**: `apps/web/src/lib/content.ts`
```typescript
import { apiGet, apiMutate, apiUpload } from "./fetch-utils.js";

export async function uploadContentFile(
  contentId: string,
  field: "media" | "thumbnail" | "coverArt",
  file: File,
): Promise<ContentResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return apiUpload<ContentResponse>(
    `/api/content/${contentId}/upload?field=${field}`,
    formData,
  );
}
```

### Example 4: Using apiMutate<void> for 204 No Content endpoints
```typescript
import { apiMutate } from "./fetch-utils.js";

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  return apiMutate<void>("/api/subscriptions/cancel", {
    body: { subscriptionId },
  });
}
```

## When to Use
- Every function in `apps/web/src/lib/` that calls a backend API endpoint
- Use `apiGet<T>(endpoint, params?, signal?)` for GET requests with optional query params and optional abort signal
- Use `apiMutate<T>(endpoint, { method, body })` for POST/PATCH/DELETE with JSON body; use `apiMutate<void>(...)` for endpoints returning 204 No Content
- Use `apiUpload<T>(endpoint, formData)` for multipart file uploads (avatar, banner, content media)

## When NOT to Use
- TanStack Start `loader` functions that construct their own fetch — `apiGet`/`apiMutate`/`apiUpload` are for lib modules consumed by hooks/components
- Server-side fetch calls (Node.js API layer) — those return `Result<T, AppError>` instead
- `useCursorPagination` hook constructs its own URL via `buildUrl()` callback — use `fetchOptions: { credentials: "include" }` there instead

## Common Violations
- Forgetting `credentials: "include"` — session cookie won't be sent, causing 401 on protected endpoints
- Importing `throwIfNotOk` directly when `apiGet`/`apiMutate`/`apiUpload` would suffice — adds unnecessary boilerplate
- Reading `response.json()` before calling `throwIfNotOk` — body stream is consumed and error message extraction fails
- Using raw `fetch()` instead of `apiMutate` for mutation endpoints — bypasses consistent error handling and 204 support
