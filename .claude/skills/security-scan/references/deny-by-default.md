# Rule: Deny by Default

> All routes require `requireAuth` unless explicitly marked public. Sensitive operations require verified email.

**Domain**: code

## Motivation

OWASP A01 (Broken Access Control) is the #1 web application risk. Deny-by-default means new routes are secure automatically — developers must opt *in* to public access, not opt *out* of protection. Verified email for sensitive ops prevents account takeover via unverified email addresses.

## Before / After

### From this codebase: unprotected route

**Before:**
```typescript
// A new route added without auth middleware
contentRoutes.get("/preview/:id", async (c) => {
  const content = await getContent(c.req.param("id"));
  return c.json(content);
});
```

**After:**
```typescript
contentRoutes.get("/preview/:id", requireAuth, async (c) => {
  const content = await getContent(c.req.param("id"));
  return c.json(content);
});
```

### Synthetic example: sensitive operation without email verification

**Before:**
```typescript
creatorRoutes.post("/profile", requireAuth, async (c) => {
  // Creates creator profile — no email verification check
  const data = c.req.valid("json");
  return c.json(await createCreatorProfile(c.var.user.id, data));
});
```

**After:**
```typescript
creatorRoutes.post("/profile", requireAuth, requireVerifiedEmail, async (c) => {
  const data = c.req.valid("json");
  return c.json(await createCreatorProfile(c.var.user.id, data));
});
```

## Exceptions

- Public feed endpoints (`GET /api/content/feed`) use `optionalAuth` — authenticated users see personalized content, anonymous users see public content
- Health check endpoint (`GET /api/health`)
- Auth endpoints themselves (sign-in, sign-up, verify-email, forgot-password)
- Webhook endpoints (use signature verification instead of session auth)

## Scope

- Applies to: all route handlers in `apps/api/src/routes/`
- Does NOT apply to: static asset serving, auth callback routes, webhook routes
