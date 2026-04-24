---
id: story-live-page-auto-scroll
kind: story
stage: done
tags: [streaming, ux-polish]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-22
related_decisions: []
related_designs: []
parent: null
---

# Live Page Auto-Scroll

Auto-scroll on `/live` page load — investigated and addressed. TanStack Router's `scrollRestoration: true` at `router.tsx:8` handles the scroll-to-top on navigation; no bespoke scroll behavior on `/live` itself.

Reviewed 2026-04-22: no scroll issue observed.
