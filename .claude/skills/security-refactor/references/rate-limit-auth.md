# Rule: Rate Limit Auth Endpoints

> Auth endpoints (login, signup, OTP) have strict per-IP rate limits.

**Domain**: code

## Motivation

Credential stuffing and brute-force attacks target auth endpoints. Per-IP rate limiting (currently 10 req/min) makes automated attacks impractical. This is already implemented — codified to ensure new auth endpoints get the same treatment.

## Before / After

### From this codebase: existing pattern (correct)

**Before:** *(what a violation would look like)*
```typescript
// app.ts — new auth endpoint without rate limiting
app.post("/api/auth/magic-link", async (c) => {
  // No rate limit — attackers can enumerate emails
  return c.json(await sendMagicLink(c.req.valid("json")));
});
```

**After:** *(the established pattern)*
```typescript
// app.ts — auth endpoints get strict rate limiting
app.use("/api/auth/magic-link", createRateLimiter({ maxRequests: 10, windowMs: 60_000 }));
app.post("/api/auth/magic-link", async (c) => {
  return c.json(await sendMagicLink(c.req.valid("json")));
});
```

### Synthetic example: password reset without rate limiting

**Before:**
```typescript
app.post("/api/auth/forgot-password", async (c) => {
  // No rate limit — attackers can spam OTPs
  await sendResetOTP(c.req.valid("json").email);
  return c.json({ ok: true });
});
```

**After:**
```typescript
app.use("/api/auth/forgot-password", createRateLimiter({ maxRequests: 5, windowMs: 60_000 }));
app.post("/api/auth/forgot-password", async (c) => {
  await sendResetOTP(c.req.valid("json").email);
  return c.json({ ok: true });
});
```

## Exceptions

- Internal auth validation endpoints (session checks) don't need aggressive limits
- Rate limiting may be relaxed for trusted IP ranges in specific deployment contexts

## Scope

- Applies to: all routes under `/api/auth/` in `apps/api/src/app.ts`
- Does NOT apply to: non-auth API endpoints (which use the general 60 req/min limit)
