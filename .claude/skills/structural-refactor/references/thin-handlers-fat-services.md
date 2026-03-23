# Rule: Thin Handlers, Fat Services

> Route handlers parse, validate, delegate, and respond (~30 lines). Business logic lives in services/.

## Motivation

Hono route handlers that inline business logic, DB queries, and complex operations become
untestable monoliths. Services are pure TypeScript — no Hono imports, no HTTP concerns, testable
without HTTP context. This matches the existing pattern used for `stripe.ts`, `shopify.ts`, and
`content-access.ts`, which return `Result<T, AppError>`.

## Before / After

### From this codebase: inline DB queries in route handlers

**Before:**
```typescript
// creator.routes.ts — handler does DB query + slug logic + permission check inline
app.patch('/:creatorId', requireAuth(), async (c) => {
  const creatorId = c.req.param('creatorId');
  const user = c.get('user');
  const data = c.req.valid('json');

  // 15 lines: check creator exists
  const existing = await db.select().from(creatorProfiles).where(eq(creatorProfiles.id, creatorId));
  if (!existing.length) throw new NotFoundError('Creator not found');

  // 10 lines: check permissions
  const roles = c.get('roles');
  const isOwner = existing[0].userId === user.id;
  const isMember = await db.select().from(creatorMembers)...
  if (!isOwner && !isMember) throw new ForbiddenError('Not authorized');

  // 20 lines: slug generation, update query, response formatting
  ...
});
```

**After:**
```typescript
// creator.routes.ts — thin handler
app.patch('/:creatorId', requireAuth(), async (c) => {
  const creatorId = c.req.param('creatorId');
  const userId = c.get('user').id;
  const data = c.req.valid('json');
  const result = await updateCreatorProfile(creatorId, userId, data);
  if (!result.ok) return c.json({ error: result.error }, result.error.statusCode);
  return c.json(result.value);
});

// services/creator.ts — all logic here
export async function updateCreatorProfile(
  creatorId: string, userId: string, data: UpdateCreatorProfile
): Promise<Result<CreatorProfileResponse, AppError>> {
  // Permission check, slug generation, DB update — all testable without HTTP
}
```

### Synthetic example: service returning Result type

**Before:**
```typescript
// Complex inline error handling in route
app.post('/checkout', async (c) => {
  try {
    const customer = await stripe.customers.create({ email });
    const session = await stripe.checkout.sessions.create({ ... });
    return c.json({ url: session.url });
  } catch (err) {
    if (err.type === 'StripeCardError') return c.json({ error: 'Card declined' }, 402);
    if (err.type === 'StripeRateLimitError') return c.json({ error: 'Too busy' }, 503);
    throw err;
  }
});
```

**After:**
```typescript
// Route: thin
app.post('/checkout', async (c) => {
  const result = await createCheckoutSession(c.req.valid('json'));
  if (!result.ok) return c.json({ error: result.error }, result.error.statusCode);
  return c.json(result.value);
});

// Service: returns Result<T, AppError>, wraps external errors
export async function createCheckoutSession(data: CheckoutRequest): Promise<Result<...>> {
  const customer = await getOrCreateCustomer(data.email);
  if (!customer.ok) return customer;
  // ...
}
```

## Exceptions

- **Trivial handlers** — a `GET /health` that returns `c.json({ ok: true })` does not need
  a service function. If the handler is under ~10 lines with no business logic, keep it inline.
- **Middleware-heavy routes** — if the route's complexity is in middleware composition (auth,
  rate limiting, role checks) rather than handler logic, the handler can stay inline.
- **One-off admin endpoints** — rarely-used endpoints that don't justify a service function.

## Scope

- Applies to: `apps/api/src/routes/*.routes.ts` handlers
- Services go to: `apps/api/src/services/` (matching existing pattern)
- Services must NOT import from `hono` — they receive and return plain TypeScript types
- Services should return `Result<T, AppError>` for operations that can fail predictably
