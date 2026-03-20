# Pattern: Result Type

`Result<T, E = AppError>` is a discriminated union (`ok: true | false`) for service-layer functions that can fail predictably; `ok()` and `err()` are the only constructors.

## Rationale

Service functions that can fail in known ways (e.g., entity not found, quota exceeded) should return `Result<T, E>` rather than throw. This forces callers to handle the failure path at compile time via TypeScript's discriminant narrowing on `.ok`, while keeping thrown exceptions reserved for truly unexpected errors.

## Examples

### Example 1: Type definitions and factory functions
**File**: `packages/shared/src/result.ts:6`
```typescript
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E = AppError> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Result<T, never> => ({
  ok: true,
  value,
});

export const err = <E>(error: E): Result<never, E> => ({
  ok: false,
  error,
});
```

### Example 2: Consuming a Result with discriminant narrowing
**File**: `packages/shared/tests/result.test.ts:57`
```typescript
it("narrows type when ok is true", () => {
  const result: Result<number> = ok(42);
  if (result.ok) {
    expect(result.value).toBe(42);
  }
});

it("narrows type when ok is false", () => {
  const result: Result<number, ValidationError> = err(new ValidationError("bad"));
  if (!result.ok) {
    expect(result.error).toBeInstanceOf(ValidationError);
  }
});
```

### Example 3: Service function signature using Result
**File**: `packages/shared/tests/result.test.ts:84`
```typescript
it("works with custom error types", () => {
  const result: Result<string, ValidationError> = err(
    new ValidationError("invalid email"),
  );
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.code).toBe("VALIDATION_ERROR");
  }
});
```

## When to Use

- Service-layer functions where failure is a predictable outcome (not a bug)
- When the caller must explicitly handle both success and failure paths
- Default `E = AppError` covers most cases; specify a narrower error type when useful

## When NOT to Use

- Route handlers — throw `AppError` subclasses there; `app.onError` catches them
- Operations where failure truly is exceptional (programming errors, unexpected states)
- Simple boolean checks — use `boolean` return type, not `Result<void, Error>`

## Common Violations

- Calling `result.value` without first narrowing on `result.ok` — TypeScript will catch this with strict mode
- Throwing inside a function that returns `Result<T>` instead of returning `err(...)` — defeats the purpose
- Using `Result` in route handlers instead of throwing typed `AppError` subclasses — layers have different error conventions
