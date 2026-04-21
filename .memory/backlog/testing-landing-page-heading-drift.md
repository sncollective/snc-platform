---
tags: [testing, ux-polish]
release_binding: null
created: 2026-04-21
---

# Testing: landing page heading drift (2026-04-15 CI run)

`landing.spec.ts:4` asserts h2 "Featured Creators" and region "Featured creators". The release-0.2.7 landing redesign replaced this section with h2 "Creators" and new section headings ("Fresh Drops", "What's On", "Coming Up"). Two failures: chromium + mobile.

Fix: rewrite the landing spec assertions against the new section voice. Pairs with the release-0.2.7 review pass.

Surfaced in the 2026-04-15 first real CI exercise (27/109 failures, typecheck-gap Phase D).
