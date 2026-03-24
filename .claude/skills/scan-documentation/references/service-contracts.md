# Rule: Service Contract Undocumented

> Service-layer functions returning `Result<T>` or discriminated unions must document their contract.

## Motivation

Service functions are the boundary between route handlers and business logic. They define the rules:
what conditions must be met, what the function does, and what outcomes are possible. A `Result<T>`
return type tells you "this can succeed or fail" but not *when* or *why* it fails.

These functions are the most important place for documentation in the codebase — they encode business
rules that aren't obvious from types alone.

## Before / After

### From this codebase: gold standard service documentation

**Already correct:** (actual code from `apps/api/src/services/content-access.ts`)
```typescript
/**
 * Check whether a user is allowed to access gated content from a specific
 * creator. Enforces subscription-based content gating with the following
 * rules:
 *
 * 1. Public content → always allowed
 * 2. No userId (unauthenticated) → not allowed
 * 3. User is a creator team member for this creator → allowed
 * 4. User is a stakeholder or any creator team member → allowed (free perk)
 * 5. User has an active subscription that covers this creator → allowed
 * 6. Otherwise → not allowed (SUBSCRIPTION_REQUIRED)
 *
 * "Active subscription" means:
 * - status = "active" (or "canceled" if currentPeriodEnd is still in the future)
 * - AND the plan is either platform-wide OR creator-specific matching the
 *   content's creator
 */
export const checkContentAccess = async (
  userId: string | null,
  contentCreatorId: string,
  contentVisibility: Visibility,
  prefetchedRoles?: string[],
): Promise<ContentGateResult> => { ... };
```

This documents the 5 priority rules, the meaning of "active subscription," and the discriminated
union return shape — none of which are obvious from the type signature.

### Synthetic example: undocumented Result-returning service

**Before:**
```typescript
export const getOrCreateCustomer = async (
  userId: string,
  email: string,
): Promise<Result<string>> => { ... };
```

**After:**
```typescript
/**
 * Look up or create a Stripe customer for the given user.
 * Returns the Stripe customer ID on success, or a 502 AppError if Stripe is unreachable.
 *
 * @throws Never — errors are returned as Result.error, not thrown
 */
export const getOrCreateCustomer = async (
  userId: string,
  email: string,
): Promise<Result<string>> => { ... };
```

The doc clarifies: what "get or create" means in Stripe terms, what the string value represents
(Stripe customer ID, not a name), the error scenario, and the error handling strategy.

## Exceptions

- **Trivial wrappers** — a service function that delegates to a single DB query with no business logic
  may not need more than a one-liner
- **Private helpers** — unexported functions within a service file don't need full contract docs
  (though a brief `/** */` is still useful)

## Scope

- **Scan:** `apps/api/src/services/` — all `.ts` files
- **Also check:** any exported function returning `Result<T, E>` or a custom discriminated union,
  regardless of directory
- **Exclude:** test files, type-only exports
