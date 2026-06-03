---
tags: [testing, ux-polish]
release_binding: null
created: 2026-04-20
---

# Testing: mobile nav and context sidebar hidden drift (2026-04-15 CI run)

Six e2e failures on mobile viewport: `navigation.spec.ts:6/50` mobile, `content-feed.spec.ts:45` mobile, `content-manage.spec.ts:6` mobile, `creator-manage.spec.ts:6` mobile, `admin-roles.spec.ts:19` mobile. Tests target `getByRole('navigation', ...)` for "Main navigation", "Admin navigation", and "Maya Chen navigation" — all `display:none` at mobile widths. The main nav has a bottom tab bar replacement ("Primary navigation"), but admin and creator-manage context shells have no mobile equivalent — `context-shell.module.css` simply hides the sidebar.

Two options:
1. Add a mobile context-nav surface (UX gap — requires design decision).
2. Split specs into viewport-specific files that only assert what's present at each width.

Resolution pairs with the release-0.2.7 review pass. Requires a UX decision before the spec rewrite.

Surfaced in the 2026-04-15 first real CI exercise (27/109 failures, typecheck-gap Phase D).
