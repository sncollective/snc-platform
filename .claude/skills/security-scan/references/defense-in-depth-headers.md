# Rule: Defense-in-Depth Headers

> `secureHeaders()` middleware stays applied globally as an app-level complement to Caddy.

**Domain**: code

## Motivation

OWASP A05 (Security Misconfiguration). Caddy sets security headers at the reverse proxy layer, but the app should set them too. If Caddy is misconfigured, bypassed (internal traffic), or removed from the architecture, the app still protects itself. Hono's `secureHeaders()` handles X-Frame-Options, X-Content-Type-Options, and others with zero config.

## Before / After

### From this codebase: existing pattern (correct)

**Before:** *(what a violation would look like)*
```typescript
// app.ts — missing secureHeaders
const app = new Hono();
app.use("*", corsMiddleware);
// No secureHeaders — relies entirely on Caddy
```

**After:** *(the established pattern)*
```typescript
// app.ts — secureHeaders applied globally
const app = new Hono();
app.use("*", corsMiddleware);
app.use("*", secureHeaders());
```

### Synthetic example: removing headers for a specific route

**Before:**
```typescript
// Someone disables headers for an embed route
app.use("/embed/*", async (c, next) => {
  await next();
  c.res.headers.delete("X-Frame-Options"); // Removes protection entirely
});
```

**After:**
```typescript
// Override specific header for embed routes, don't remove all protection
app.use("/embed/*", secureHeaders({
  xFrameOptions: "SAMEORIGIN", // Allow framing from same origin only
}));
```

## Exceptions

- Embed routes that legitimately need `X-Frame-Options: SAMEORIGIN` instead of `DENY`
- API documentation routes (Scalar) may need relaxed CSP for script loading

## Scope

- Applies to: `apps/api/src/app.ts` global middleware setup
- Does NOT apply to: Caddy configuration (that's the infra board at `boards/infra/BOARD.md`)
