# Pattern: Content Access Gate

`checkContentAccess(userId, creatorId, visibility)` returns a `ContentGateResult` discriminated union; callers inspect `gate.allowed` and branch on `gate.reason` to produce the correct HTTP error (401 vs 403).

## Rationale

Content access rules are complex (public / unauthenticated / stakeholder+team member bypass / platform subscription / creator subscription) and must be applied consistently across multiple route handlers. Extracting the logic into a pure async function with an explicit discriminated union return type keeps each handler focused on its HTTP concerns while reusing the same rules everywhere. The discriminated type forces callers to handle both branches of `allowed`, and the `reason` field lets callers differentiate 401 (authentication required) from 403 (subscription required) without rechecking the same logic.

Draft access is handled separately by `requireDraftAccess()`, which uses the `viewPrivate` creator permission (true for all team roles: owner, editor, viewer). Admins bypass; stakeholders must be on the creator's team.

## Examples

### Example 1: ContentGateResult discriminated union type
**File**: `apps/api/src/services/content-access.ts:11`
```typescript
export type ContentGateResult =
  | { allowed: true }
  | { allowed: false; reason: string; creatorId: string };
```

### Example 2: Two-phase access check (batch context + per-item)
**File**: `apps/api/src/services/content-access.ts`

The access logic uses a two-phase approach: `buildContentAccessContext()` pre-fetches memberships and subscriptions once, then `hasContentAccess()` runs synchronously per item. `checkContentAccess()` composes both for single-item endpoints.

The 5 priority rules in `hasContentAccess`:
```typescript
export const hasContentAccess = (
  ctx: ContentAccessContext,
  contentCreatorId: string,
  contentVisibility: Visibility,
): boolean => {
  if (contentVisibility === "public") return true;          // 1. Public → allowed
  if (ctx.userId === null) return false;                    // 2. Unauthenticated → denied
  if (ctx.memberCreatorIds.has(contentCreatorId)) return true; // 3a. Specific team member
  if (ctx.roles.includes("stakeholder")) return true;       // 3b. Stakeholder role
  if (ctx.hasPlatformSubscription) return true;             // 3c. Platform sub or any team member
  if (ctx.subscribedCreatorIds.has(contentCreatorId)) return true; // 4. Creator subscription
  return false;                                              // 5. Denied
};
```

Stakeholders and any creator team member get `hasPlatformSubscription: true` in `buildContentAccessContext`, skipping the subscription query entirely.

### Example 3: Feed endpoint soft-gates denied items (batch path)
**File**: `apps/api/src/routes/content.routes.ts:174`
```typescript
const items = rawItems.map((row) => {
  const item = resolveFeedItem(row);
  if (!hasContentAccess(accessCtx, row.creatorId, row.visibility)) {
    item.mediaUrl = null;
    item.body = null;  // Nullify — don't remove; metadata stays in feed
  }
  return item;
});
```

### Example 4: Detail endpoint uses requireDraftAccess + applyContentGate
**File**: `apps/api/src/routes/content.routes.ts:376`
```typescript
await requireDraftAccess(row, user?.id ?? null, roles);
const response = await applyContentGate(row, user?.id ?? null, resolveContentUrls(row), roles);
```

`requireDraftAccess` throws 404 for unauthorized draft access (uses `viewPrivate` permission). `applyContentGate` nullifies `mediaUrl`/`body` on denied subscriber content without throwing.

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
