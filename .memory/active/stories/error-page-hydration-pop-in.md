---
id: story-error-page-hydration-pop-in
kind: story
stage: done
tags: [ux-polish]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-22
related_decisions: []
related_designs: []
parent: null
---

# Error Page Hydration Pop-In

The "Go back" button on `ErrorPage` relies on `window.history.back()`, which requires the client. Without gating, the button rendered enabled on SSR and flickered to its hydrated state on mount, plus triggered a hydration mismatch warning.

`ErrorPage` now initializes `isMounted = false`, flips true in a post-mount effect, and sets `disabled={!isMounted}` with `suppressHydrationWarning` on the "Go back" button ([error-page.tsx:22-26,63-64](platform/apps/web/src/components/error/error-page.tsx#L22-L64)). Matches SSR-disabled with client-hydrated-enabled without console noise.

Reviewed 2026-04-22 against an unknown-route 404: no flicker, no warning.
