---
tags: [testing, streaming]
release_binding: null
created: 2026-04-21
---

# Testing: admin playout "Playlist" heading drift (2026-04-15 CI run)

Two failures — `admin-roles.spec.ts:31` on chromium + mobile. The spec asserts `heading "Playlist"` on `/admin/playout`. The heading was removed when release-0.2.1's "Playout channel architecture Phase 1/2" and "Dynamic Liquidsoap config generation" items restructured `apps/web/src/routes/admin/playout.tsx` (still in Review at time of CI run).

Fix: update the selector to match the current heading structure on the playout admin page. Pairs with the release-0.2.1 review pass.

Surfaced in the 2026-04-15 first real CI exercise (27/109 failures, typecheck-gap Phase D).
