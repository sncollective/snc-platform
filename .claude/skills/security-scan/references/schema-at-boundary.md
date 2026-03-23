# Rule: Schema at Boundary

> Every handler accepting input must use `zValidator` with a Zod schema.

**Domain**: code

## Motivation

OWASP A03 (Injection) is prevented by validating all external input before processing. Zod schemas at the API boundary ensure type safety and reject malformed data before it reaches business logic. This is already the established pattern — this rule ensures it stays enforced as the codebase grows.

## Before / After

### From this codebase: existing pattern (correct)

**Before:** *(what a violation would look like)*
```typescript
contentRoutes.post("/", requireAuth, async (c) => {
  const data = await c.req.json(); // Raw, unvalidated input
  const content = await createContent(data);
  return c.json(content, 201);
});
```

**After:** *(the established pattern)*
```typescript
contentRoutes.post("/", requireAuth, validator("json", CreateContentSchema), async (c) => {
  const data = c.req.valid("json"); // Typed, validated input
  const content = await createContent(data);
  return c.json(content, 201);
});
```

### Synthetic example: query parameters

**Before:**
```typescript
routes.get("/search", async (c) => {
  const q = c.req.query("q"); // Unvalidated, could be anything
  const results = await search(q!);
  return c.json(results);
});
```

**After:**
```typescript
routes.get("/search", validator("query", SearchQuerySchema), async (c) => {
  const { q } = c.req.valid("query");
  const results = await search(q);
  return c.json(results);
});
```

## Exceptions

- Webhook routes that parse raw body for signature verification (validate after signature check)
- File upload routes that use multipart parsing (validated via `UploadPurpose` discriminated constraints)

## Scope

- Applies to: all route handlers in `apps/api/src/routes/` that accept JSON, query, or param input
- Does NOT apply to: middleware, internal service functions, seed scripts
