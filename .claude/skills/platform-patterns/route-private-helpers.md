# Pattern: Route Private Helpers

Route files group shared logic into private helper functions and shared error-response constants, eliminating duplication across multiple handlers in the same file.

## Rationale

When multiple route handlers in a single file share the same query, authorization check, or response-mapping logic, that logic is extracted into a file-private helper (no `export`). Similarly, OpenAPI error-response shapes are defined once as `const ERROR_4xx` objects and referenced by all routes that can produce that status. This keeps each handler focused on its own business logic without repeating boilerplate.

## Examples

### Example 1: Shared query + authorization helpers used across 4 routes
**File**: `apps/api/src/routes/content.routes.ts:89`
```typescript
// Used by GET /:id, PATCH /:id, DELETE /:id, and POST /:id/upload
const findActiveContent = async (
  id: string,
): Promise<ContentRow | undefined> => {
  const rows = await db
    .select()
    .from(content)
    .where(and(eq(content.id, id), isNull(content.deletedAt)));
  return rows[0];
};

// Wraps findActiveContent + ownership check; throws typed errors on failure
const requireContentOwnership = async (
  id: string,
  userId: string,
): Promise<ContentRow> => {
  const existing = await findActiveContent(id);
  if (!existing) {
    throw new NotFoundError("Content not found");
  }
  if (existing.creatorId !== userId) {
    throw new ForbiddenError("Not the content owner");
  }
  return existing;
};
```

### Example 2: Response-mapping helper shared by all write routes
**File**: `apps/api/src/routes/content.routes.ts:67`
```typescript
// Transforms DB row (storage keys) → API response (URL paths)
// Used by POST /, PATCH /:id, DELETE cascade cleanup, POST /:id/upload
const resolveContentUrls = (row: ContentRow): ContentResponse => ({
  id: row.id,
  creatorId: row.creatorId,
  type: row.type as ContentType,
  title: row.title,
  body: row.body ?? null,
  description: row.description ?? null,
  visibility: row.visibility as Visibility,
  thumbnailUrl: row.thumbnailKey ? `/api/content/${row.id}/thumbnail` : null,
  mediaUrl: row.mediaKey ? `/api/content/${row.id}/media` : null,
  coverArtUrl: row.coverArtKey ? `/api/content/${row.id}/cover-art` : null,
  publishedAt: row.publishedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});
```

### Example 3: Shared OpenAPI error-response constants
**File**: `apps/api/src/routes/content.routes.ts:121`
```typescript
// Defined once at the top of the file; referenced in every describeRoute() call
const ERROR_400 = {
  description: "Validation error",
  content: { "application/json": { schema: resolver(ErrorResponse) } },
} as const;

const ERROR_401 = {
  description: "Unauthenticated",
  content: { "application/json": { schema: resolver(ErrorResponse) } },
} as const;

const ERROR_403 = {
  description: "Forbidden",
  content: { "application/json": { schema: resolver(ErrorResponse) } },
} as const;

const ERROR_404 = {
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
