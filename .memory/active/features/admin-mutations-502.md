---
id: feature-admin-mutations-502
kind: feature
stage: done
tags: [admin-console]
release_binding: 0.2.1
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# Admin Mutations 502

## Sub-units (all done)

- [x] Remove Nitro routeRules API proxy from `vite.config.ts`

## Overview

POST, PATCH, PUT, and DELETE requests to `/api/**` return 502 when triggered from
admin pages (`/admin/playout`, `/admin/simulcast`, `/admin/creators`). GET requests
to the same endpoints work correctly.

Brief: board item "Admin mutations 502" — `[from role-based-nav]`

### Root Cause

`vite.config.ts` configures Nitro `routeRules` with a wildcard proxy:

```ts
// platform/apps/web/vite.config.ts (lines 151–157)
nitro: {
  preset: "node-server",
  routeRules: {
    "/api/**": {
      proxy: { to: "http://localhost:3000/api/**" },
    },
  },
},
```

This routeRules configuration is compiled into the Nitro runtime and active in both
dev and production. The `NitroDevApp` (dev) and built Nitro SSR server (prod) both
install this proxy rule.

**How the proxy fires for mutations:**

In the Vite dev server, the `nitroDevMiddlewarePre` hook intercepts all requests
where `sec-fetch-dest` is `document | iframe | frame | empty` or absent — which
includes every browser `fetch()` call (mutations send `sec-fetch-dest: empty`).
These requests are passed to `ctx.devApp.fetch(req)`, which is the `NitroDevApp`
running the compiled routeRules.

The routeRules proxy handler calls h3's `proxyRequest()`:

```js
// nitro/dist/runtime/internal/route-rules.mjs
export const proxy = ((m) => function proxyRouteRule(event) {
  let target = m.options?.to;  // "http://localhost:3000/api/**"
  // ...resolves path...
  return proxyRequest(event, target, { ...m.options });
});
```

h3's `proxyRequest` reads `event.req.body` for `PayloadMethods` (POST/PATCH/PUT/DELETE):

```js
// h3/dist/h3-Dol7UbDx.mjs (line 1152-1169)
async function proxyRequest(event, target, opts = {}) {
  const requestBody = PayloadMethods.has(event.req.method) ? event.req.body : void 0;
  // ...
  return proxy(event, target, {
    fetchOptions: { method, body: requestBody, duplex: requestBody ? "half" : void 0 }
  });
}
```

The `NodeRequest.body` getter (srvx) converts the Node.js `IncomingMessage` to a
Web `ReadableStream` via `Readable.toWeb(nodeReq)`. When `proxyRequest` reads this
stream and passes it to `fetch()`, the stream is consumed. If anything in the
middleware chain prior to the proxy already read or locked the stream — or if the
Node.js → Web stream bridge has a duplex framing issue at this alpha Nitro version —
the upstream `fetch()` throws and h3 catches it as a 502:

```js
// h3/dist/h3-Dol7UbDx.mjs (line 1178-1183)
try {
  response = await fetch(target, fetchOptions);
} catch (error) {
  throw new HTTPError({ status: 502, cause: error });
}
```

GET requests are unaffected because `requestBody` is `void 0` for GET/HEAD — no
stream is involved.

**Why the proxy is redundant:**

Caddy already routes `/api/*` directly to the Hono API (`localhost:3000`) in both
dev (`Caddyfile.dev`) and production (`deploy/Caddyfile.prod.example`). The Nitro
SSR server at `:3001` never receives `/api/**` requests from the browser via Caddy.

The routeRules proxy only fires when a request reaches Nitro at `:3001` with an
`/api/**` path — which happens in dev when the browser connects to `:3001` directly
(bypassing Caddy), or when an internal Nitro handler tries to make an API call with
a relative URL. Neither case is the intended flow.

SSR-side data fetching (`fetchApiServer`, `fetchAuthStateServer`) already bypasses
this proxy entirely — they use `API_INTERNAL_URL ?? localhost:3000` directly via
Node.js `fetch()` in `api-server.ts`.

**Fix:** Remove the `routeRules` proxy block from `vite.config.ts`. This eliminates
the redundant proxy layer without affecting any existing functionality.

---

## Implementation Units

### Unit 1: Remove Nitro routeRules API Proxy

**File**: `platform/apps/web/vite.config.ts`

Remove the `routeRules` section from the `nitro` config block. The `preset` key
stays — it is needed for production builds.

```ts
// Before (lines 151–158):
nitro: {
  preset: "node-server",
  routeRules: {
    "/api/**": {
      proxy: { to: "http://localhost:3000/api/**" },
    },
  },
},

// After:
nitro: {
  preset: "node-server",
},
```

**Implementation Notes:**

- No other files change — the routeRules block is self-contained in `vite.config.ts`.
- `fetchApiServer` and `fetchAuthStateServer` in `apps/web/src/lib/api-server.ts`
  connect directly to `API_INTERNAL_URL ?? VITE_API_URL ?? localhost:3000` and are
  not affected by routeRules.
- `apiMutate`, `apiGet`, `apiUpload` in `fetch-utils.ts` use relative URLs
  (`/api/**`). In the browser, these resolve against the current origin (`:3080` via
  Caddy), which routes `/api/*` to `:3000`. This path is unchanged.
- Caddy's dev config (`Caddyfile.dev`) and prod config
  (`deploy/Caddyfile.prod.example`) both have `handle /api/*` before the catch-all,
  so API requests never reach Nitro.

**Acceptance Criteria:**

- [ ] `vite.config.ts` has no `routeRules` key under `nitro`
- [ ] `nitro: { preset: "node-server" }` remains

---

## Implementation Order

1. **Unit 1**: Remove the `routeRules` block — single-file, single hunk

---

## Testing

### Manual Smoke Test

```bash
# Restart dev servers to pick up vite.config.ts change
pm2 restart web

# Navigate to http://localhost:3080/admin/playout
# 1. Skip current track (POST /api/playout/channels/:id/skip)
# 2. Remove a queue item (DELETE /api/playout/channels/:id/queue/items/:entryId)
# 3. Insert a queue item via "+ Play Next" (POST /api/playout/channels/:id/queue/items)
# 4. Assign content to pool (POST /api/playout/channels/:id/content)
# 5. Remove pool content (DELETE /api/playout/channels/:id/content)

# Navigate to http://localhost:3080/admin/simulcast
# 6. Create a destination (POST /api/simulcast)
# 7. Update a destination (PATCH /api/simulcast/:id)
# 8. Delete a destination (DELETE /api/simulcast/:id)

# Navigate to http://localhost:3080/admin/creators
# 9. Update creator status (PATCH /api/admin/creators/:id/status)
```

### Regression: SSR Fetches Still Work

```bash
# Navigate to http://localhost:3080/admin/playout — page should load
# with channel list (SSR via fetchApiServer → localhost:3000 directly)
# No 502 in SSR auth or loader data
pm2 logs web --lines 50 | grep -i "error\|502\|warn"
```

### Build Verification

```bash
bun run --filter @snc/web build
# Should compile without TypeScript errors
```

---

## Verification Checklist

```bash
# 1. Config change applied
grep -n "routeRules" platform/apps/web/vite.config.ts
# → should return no results

# 2. Dev server restarts cleanly
pm2 restart web && pm2 logs web --lines 20

# 3. Mutation smoke tests (see Testing section above)
# All 9 admin mutations return 2xx — no 502

# 4. SSR still loads admin pages without error
# /admin/playout channel list renders on first load

# 5. Build succeeds
bun run --filter @snc/web build
```
