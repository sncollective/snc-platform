---
tags: [testing, admin-console]
release_binding: null
created: 2026-04-21
---

# Testing: Pat Morgan admin user list render timeout (2026-04-15 CI run)

One failure — `admin-roles.spec.ts:6` chromium only. The spec expects Pat Morgan to be visible in the admin user list within 5s. Pat Morgan is present in `seed-demo.ts:265`; the page likely SSRs a table shell and then client-fetches users, and the render is not settling within 5s on the admin index route.

Part of a broader class of SSR shell + client fetch race failures in the test suite. Fix: investigate whether the admin users page SSRs user data or falls back to a client fetch, and determine whether converting to a TanStack Start loader (server-side data) would resolve the timing gap.

Surfaced in the 2026-04-15 first real CI exercise (27/109 failures, typecheck-gap Phase D).
