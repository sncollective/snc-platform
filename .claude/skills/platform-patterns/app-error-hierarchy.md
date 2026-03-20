# Pattern: AppError Hierarchy

Typed error subclasses extend `AppError` with a fixed `code` string and `statusCode`; middleware maps them to structured JSON via `instanceof`.

## Rationale

Plain `Error` throws lose HTTP status and machine-readable error codes at the API boundary. By encoding `code` and `statusCode` into the class, the single `errorHandler` middleware can map any `AppError` subclass to the correct HTTP response without a switch-case per error type.

## Examples

### Example 1: Base class and subclasses
**File**: `packages/shared/src/errors.ts:3`
```typescript
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super("NOT_FOUND", message, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message, 400);
  }
}
```

### Example 2: Hono error handler consuming the hierarchy
**File**: `apps/api/src/middleware/error-handler.ts:38`
```typescript
export const errorHandler: ErrorHandler = (e, c) => {
  if (e instanceof AppError) {
    const details = "details" in e ? (e as { details?: unknown }).details : undefined;
    return c.json(toErrorBody(e.code, e.message, details), e.statusCode as ContentfulStatusCode);
  }
  console.error("Unhandled error:", e);
  return c.json(toErrorBody("INTERNAL_ERROR", "Internal server error"), 500);
};
```

### Example 3: Custom subclass with `details` field in tests
**File**: `apps/api/tests/middleware/error-handler.test.ts:100`
```typescript
class DetailedError extends AppError {
  readonly details: Record<string, unknown>;
  constructor(message: string, details: Record<string, unknown>) {
    super("DETAILED_ERROR", message, 422);
    this.name = "DetailedError";
    this.details = details;
  }
}
```

## When to Use

- Any expected failure path in service or route code
- When the caller needs both an HTTP status code and a machine-readable `code` string
- Add a new subclass per distinct error category (e.g., `ConflictError`, `RateLimitError`)

## When NOT to Use

- Unknown/unexpected errors — let those fall through to the generic 500 branch in `errorHandler`
- Validation failures already handled by Zod/`zValidator` at the route level (use `ValidationError` for service-layer validation only)

## Common Violations

- Throwing `new Error("not found")` instead of `new NotFoundError(...)` — loses status code and code string
- Catching `AppError` in a route handler instead of letting `app.onError(errorHandler)` handle it — duplicates mapping logic
- Defining `statusCode` as a string instead of a number — breaks the cast in `errorHandler`
