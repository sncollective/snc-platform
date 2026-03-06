# Pattern: Content Access Gate

`checkContentAccess(userId, creatorId, visibility)` returns a `ContentGateResult` discriminated union; callers inspect `gate.allowed` and branch on `gate.reason` to produce the correct HTTP error (401 vs 403).

## Rationale

Content access rules are complex (public / unauthenticated / owner bypass / creator role bypass / platform subscription / creator subscription) and must be applied consistently across multiple route handlers. Extracting the logic into a pure async function with an explicit discriminated union return type keeps each handler focused on its HTTP concerns while reusing the same rules everywhere. The discriminated type forces callers to handle both branches of `allowed`, and the `reason` field lets callers differentiate 401 (authentication required) from 403 (subscription required) without rechecking the same logic.

## Examples

### Example 1: ContentGateResult discriminated union type
**File**: `apps/api/src/middleware/content-gate.ts:11`
```typescript
export type ContentGateResult =
  | { allowed: true }
  | { allowed: false; reason: string; creatorId: string };
```

### Example 2: 6-rule priority logic inside checkContentAccess
**File**: `apps/api/src/middleware/content-gate.ts:34`
```typescript
export const checkContentAccess = async (
  userId: string | null,
  contentCreatorId: string,
  contentVisibility: string,
): Promise<ContentGateResult> => {
  // Rule 1: Public content → always allowed (no DB query)
  if (contentVisibility === "public") return { allowed: true };

  // Rule 2: Unauthenticated → not allowed
  if (userId === null) {
    return { allowed: false, reason: "AUTHENTICATION_REQUIRED", creatorId: contentCreatorId };
  }

  // Rule 3: Owner bypass — creator can always access their own content
  if (userId === contentCreatorId) return { allowed: true };

  // Rule 4: Creator role bypass — contributor members get free access
  const roles = await getUserRoles(userId);
  if (roles.includes("creator")) return { allowed: true };

  // Rule 5: Active subscription check (active OR canceled-but-not-expired,
  //         platform-wide OR creator-specific matching this creator)
  const rows = await db
    .select({ id: userSubscriptions.id })
    .from(userSubscriptions)
    .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
    .where(
      and(
        eq(userSubscriptions.userId, userId),
        or(
          eq(userSubscriptions.status, "active"),
          and(eq(userSubscriptions.status, "canceled"), gt(userSubscriptions.currentPeriodEnd, now)),
        ),
        or(
          eq(subscriptionPlans.type, "platform"),
          and(eq(subscriptionPlans.type, "creator"), eq(subscriptionPlans.creatorId, contentCreatorId)),
        ),
      ),
    )
    .limit(1);

  if (rows.length > 0) return { allowed: true };

  // Rule 6: No matching subscription
  return { allowed: false, reason: "SUBSCRIPTION_REQUIRED", creatorId: contentCreatorId };
};
```

### Example 3: Caller hides media URL on metadata endpoint (soft gate)
**File**: `apps/api/src/routes/content.routes.ts:333`
```typescript
if (row.visibility === "subscribers") {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  const userId = session?.user?.id ?? null;
  const gate = await checkContentAccess(userId, row.creatorId, row.visibility);
  if (!gate.allowed) {
    response.mediaUrl = null;  // Omit URL — don't throw; metadata is still visible
  }
}
```

### Example 4: Caller throws 401 vs 403 on media streaming endpoint (hard gate)
**File**: `apps/api/src/routes/content.routes.ts:587`
```typescript
if (row.visibility === "subscribers") {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  const userId = session?.user?.id ?? null;
  const gate = await checkContentAccess(userId, row.creatorId, row.visibility);
  if (!gate.allowed) {
    if (gate.reason === "AUTHENTICATION_REQUIRED") {
      throw new UnauthorizedError("Authentication required");   // → 401
    }
    throw new ForbiddenError("Subscription required to access this content");  // → 403
  }
}
```

## When to Use
- Any route that conditionally exposes or restricts content based on subscription status
- When the same access rules must be applied consistently across multiple handlers
- When the caller needs to distinguish authentication failure (401) from authorization failure (403)

## When NOT to Use
- Simple role-based access that only needs `requireRole()` — no subscription query needed
- Public-only routes — skip the check entirely; don't call this with `visibility === "public"`

## Common Violations
- Throwing a generic `ForbiddenError` without checking `gate.reason`: callers lose the ability to return 401 vs 403 appropriately
- Inlining the subscription JOIN query in each route handler: duplicates complex SQL and risks diverging access rules
- Calling `checkContentAccess` before checking `row.visibility`: the function short-circuits on `"public"`, but the outer `if (row.visibility === "subscribers")` guard avoids unnecessary function calls entirely
