# Style: No Floating Promises

> Every promise must be awaited, returned, or explicitly voided.

## Motivation

A "floating" promise is an async call whose result is silently ignored. If it rejects, the
error vanishes — no log, no user feedback, no crash. In a platform handling payments (Stripe),
file uploads (S3), and user data, a silently swallowed error can mean lost revenue or corrupted
state. TypeScript doesn't catch this by default; it requires discipline (or the
`@typescript-eslint/no-floating-promises` rule).

## Before / After

### From this codebase: properly handled async

**Before:** (actual pattern from `apps/api/src/routes/webhook.routes.ts`)
```typescript
// Every async call is awaited
const result = await verifyWebhookSignature(rawBody, sig);
if (!result.ok) {
  return c.json({ error: result.error.message }, 400);
}

await db.insert(paymentEvents).values({ stripeEventId: event.id });
```
All promises are awaited. Errors propagate to the error handler middleware.

### Synthetic example: floating promise in cleanup

**Before:**
```typescript
async function handleContentDelete(c: Context<AuthEnv>): Promise<Response> {
  const content = await findActiveContent(id);
  if (!content) throw new NotFoundError("Content not found");

  await db.update(contentTable).set({ deletedAt: new Date() }).where(eq(contentTable.id, id));

  // BUG: floating promise — if storage deletion fails, no one knows
  storage.delete(content.mediaKey);
  storage.delete(content.thumbnailKey);

  return c.json({ success: true });
}
```

**After:**
```typescript
async function handleContentDelete(c: Context<AuthEnv>): Promise<Response> {
  const content = await findActiveContent(id);
  if (!content) throw new NotFoundError("Content not found");

  await db.update(contentTable).set({ deletedAt: new Date() }).where(eq(contentTable.id, id));

  // Storage deletion is best-effort — log failures but don't block the response
  const keys = [content.mediaKey, content.thumbnailKey].filter(Boolean);
  const results = await Promise.allSettled(keys.map((key) => storage.delete(key)));
  for (const result of results) {
    if (result.status === "rejected") {
      c.var.logger.warn({ error: String(result.reason) }, "Failed to delete storage file");
    }
  }

  return c.json({ success: true });
}
```

### Synthetic example: floating promise in event handler

**Before:**
```typescript
function UserMenu({ serverAuth }: { readonly serverAuth?: AuthState }) {
  const handleLogout = () => {
    // BUG: floating promise — if signOut fails, user sees no error
    authClient.signOut();
  };

  return <button onClick={handleLogout}>Log out</button>;
}
```

**After:**
```typescript
function UserMenu({ serverAuth }: { readonly serverAuth?: AuthState }) {
  const handleLogout = async () => {
    try {
      await authClient.signOut();
    } catch {
      // Redirect to login regardless — session may be partially invalidated
      window.location.href = "/login";
    }
  };

  return <button onClick={() => void handleLogout()}>Log out</button>;
}
```
Note the `void` keyword — it explicitly marks the promise as intentionally unhandled by
the click handler, while the async function itself handles errors internally.

## Exceptions

- **Fire-and-forget with `void`** — if a promise is intentionally unhandled, prefix with `void` to signal intent: `void analytics.track("page_view")`. This makes the decision explicit.
- **Event handlers in JSX** — React event handlers can't be async directly. Use `void asyncFn()` or wrap in a sync handler that calls the async function with error handling.
- **`useEffect` cleanup** — React effects can't return promises. Fire-and-forget inside effects is acceptable when the effect manages its own error handling internally.

## Scope

- Applies to: all TypeScript files — route handlers, services, React components, hooks, utilities
- Does NOT apply to: test files (Vitest handles unhandled rejections), one-line `void` expressions that explicitly acknowledge the floating promise
