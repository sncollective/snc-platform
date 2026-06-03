---
tags: [refactor, stylistic]
release_binding: null
created: 2026-04-20
---

# Creator Routes — Consider `createFactory()` for Typed Middleware Composition

Optional migration from `new Hono<AuthEnv>()` with mixed `optionalAuth`/`requireAuth` middleware to `createFactory()` for typed middleware composition. Current approach works; `createFactory()` would give tighter type inference on middleware-added vars. Low effort, fully optional. Land only if other creator-routes work touches the route construction pattern.

P3 — low priority, fully optional.
