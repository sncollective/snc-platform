# Pattern: Route Private Helpers

Route files group shared logic into private helper functions and shared error-response constants, eliminating duplication across multiple handlers in the same file.

## Rationale

When multiple route handlers in a single file share the same query, authorization check, or response-mapping logic, that logic is extracted into a file-private helper (no `export`). Similarly, OpenAPI error-response shapes are defined once as `const ERROR_4xx` objects and referenced by all routes that can produce that status. This keeps each handler focused on its own business logic without repeating boilerplate.

## Examples

### Example 1: Shared query + authorization helpers used across routes
**File**: `apps/api/src/lib/content-helpers.ts:88-113` (imported by `apps/api/src/routes/content.routes.ts:31`)
```typescript
export const findActiveContent = async (
  id: string,
): Promise<ContentRow | undefined> => {
  const rows = await db
    .select()
    .from(content)
    .where(and(eq(content.id, id), isNull(content.deletedAt)));
  return rows[0];
};

export const requireContentOwnership = async (
  id: string,
  userId: string,
): Promise<ContentRow> => {
  const existing = await findActiveContent(id);
  if (!existing) {
    throw new NotFoundError("Content not found");
  }
  await requireCreatorPermission(userId, existing.creatorId, "manageContent");
  return existing;
};
```

### Example 2: Response-mapping helper shared by write routes
**File**: `apps/api/src/lib/content-helpers.ts:53-85` (imported by `apps/api/src/routes/content.routes.ts:31`)
```typescript
export const resolveContentUrls = (row: ContentRow): ContentResponse => {
  const { thumbnailUrl, thumbnail } = buildThumbnail(
    row.id,
    row.thumbnailKey,
    row.updatedAt,
  );
  return {
    id: row.id,
    creatorId: row.creatorId,
    type: row.type,
    title: row.title,
    body: row.body ?? null,
    thumbnailUrl,
    thumbnail,
    mediaUrl: row.mediaKey
      ? `/api/content/${row.id}/media${cacheBust(row.updatedAt)}`
      : null,
    updatedAt: toISO(row.updatedAt),
    processingStatus: row.processingStatus ?? null,
  };
};
```

### Example 3: Shared OpenAPI error-response constants
**File**: `apps/api/src/lib/openapi-errors.ts:13-31` (imported by `apps/api/src/routes/content.routes.ts:29`)
```typescript
export const ERROR_400 = {
  description: "Validation error",
  content: { "application/json": { schema: resolver(ErrorResponse) } },
} as const;

export const ERROR_401 = {
  description: "Unauthenticated",
  content: { "application/json": { schema: resolver(ErrorResponse) } },
} as const;

export const ERROR_403 = {
  description: "Forbidden",
  content: { "application/json": { schema: resolver(ErrorResponse) } },
} as const;

export const ERROR_404 = {
  description: "Not found",
  content: { "application/json": { schema: resolver(ErrorResponse) } },
} as const;

// Usage in describeRoute():
describeRoute({
  responses: { 400: ERROR_400, 401: ERROR_401, 403: ERROR_403 },
});
```

## When to Use

- Logic (query, auth check, response mapping) repeated in 2+ handlers in the **same route file** — extract to a private helper
- OpenAPI error-response objects that are identical across multiple routes in the same file — hoist to a shared constant
- Keep the helper **unexported** (no `export` keyword) — it belongs to the file's implementation, not the public API

## When NOT to Use

- Logic shared across **multiple route files** — put it in a middleware or a separate service module
- Single-use logic — inline it in the handler; don't premature-extract

## Common Violations

- Exporting private helpers — increases coupling and makes refactoring harder
- Copy-pasting `findActiveContent` or `resolveContentUrls` into a second route file — extract to a shared service instead
- Inlining the same `{ description: "Validation error", ... }` object in every `describeRoute()` call — hoist to `ERROR_4xx` constants
