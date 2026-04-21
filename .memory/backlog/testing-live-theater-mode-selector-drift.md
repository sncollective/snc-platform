---
tags: [testing, streaming]
release_binding: null
created: 2026-04-21
---

# Testing: Live page Theater mode button selector drift (2026-04-15 CI run)

Two failures — `live-streaming.spec.ts:28` on chromium + mobile. The spec asserts `button "Theater mode"` on the live page. Release-0.2.4's "Live page controls hover behavior" item refactored TheaterOverlay to parent-driven visibility; the standalone Theater mode button affordance may have collapsed into the overlay controls or been renamed.

Fix: inspect the current live page DOM, identify the correct selector for the theater mode toggle, and update the spec. Pairs with the release-0.2.4 review pass.

Surfaced in the 2026-04-15 first real CI exercise (27/109 failures, typecheck-gap Phase D).
