---
tags: [streaming]
release_binding: null
created: 2026-04-21
---

# Live-page layout chrome decision — site-width-container vs Twitch-shape full-bleed on /live

Scoping spike blocking the live-page-controls-hover redesign (currently at drafting) and likely reshaping the theater/fullscreen/PiP layout-modes model in live-streaming-ux-patterns.md research. Site-width keeps one design-system posture across routes and aligns with cooperative-platform-as-site framing; full-bleed on /live admits "/live is a distinct surface" (Twitch/Kick/YouTube Live convention — avatar top-right, compressed nav top-left, 340px chat side-panel with player taking remaining width) and gives theater/fullscreen/PiP a natural native model rather than toggle-within-container. Knock-on effects: mobile-nav approach on /live, responsive breakpoints specific to /live, whether chat collapse "expands" the player or just hides the panel, and several already-done items (landing-page, context-shell-mobile-sub-nav) that tacitly assume a single layout model. Decide before /design re-runs on live-page-controls-hover.
