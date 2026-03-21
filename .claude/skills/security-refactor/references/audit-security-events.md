# Rule: Audit Security Events

> Auth failures, authorization denials, role changes, and admin actions are logged with timestamp, actor, IP, and outcome.

**Domain**: code

## Motivation

OWASP A09 (Security Logging and Monitoring Failures). Without audit logs, you can't detect brute-force attempts, track unauthorized access, or investigate incidents. Structured security event logs enable alerting and forensics.

## Before / After

### From this codebase: auth failure with no logging

**Before:**
```typescript
// require-auth.ts — current pattern
if (!session) {
  throw new UnauthorizedError("Authentication required");
  // No record of the failed attempt
}
```

**After:**
```typescript
if (!session) {
  console.warn(JSON.stringify({
    event: "auth_failure",
    path: c.req.path,
    ip: c.req.header("x-forwarded-for")?.split(",")[0]?.trim(),
    timestamp: new Date().toISOString(),
  }));
  throw new UnauthorizedError("Authentication required");
}
```

### Synthetic example: role change without audit

**Before:**
```typescript
adminRoutes.post("/users/:id/roles", requireAuth, requireRole("admin"), async (c) => {
  const { role } = c.req.valid("json");
  await assignRole(c.req.param("id"), role);
  return c.json({ ok: true });
});
```

**After:**
```typescript
adminRoutes.post("/users/:id/roles", requireAuth, requireRole("admin"), async (c) => {
  const { role } = c.req.valid("json");
  await assignRole(c.req.param("id"), role);
  console.warn(JSON.stringify({
    event: "role_change",
    targetUser: c.req.param("id"),
    newRole: role,
    actor: c.var.user.id,
    ip: c.req.header("x-forwarded-for")?.split(",")[0]?.trim(),
    timestamp: new Date().toISOString(),
  }));
  return c.json({ ok: true });
});
```

## Exceptions

- Health check endpoints (no security relevance)
- Public feed reads (high volume, low security value)
- Successful auth is optional to log (focus on failures and sensitive ops)

## Scope

- Applies to: auth middleware, role middleware, admin routes, webhook handlers
- Does NOT apply to: read-only public endpoints, static assets
