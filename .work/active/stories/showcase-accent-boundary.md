---
id: showcase-accent-boundary
kind: story
stage: implementing
tags: [design-system]
parent: showcase-voice-presence
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-14
updated: 2026-08-14
---

# Showcase accent token boundary

## Brief
Per feature `showcase-voice-presence`: create `tokens/color/showcase.css` (sole owner:
`--showcase-accent/-hover/-on-accent`, both modes, seeded placeholders — dark #E5A83B/#D69A2E/
#241703, light provisional AA-passing amber); the `[data-surface="showcase"]` alias block
after `voices/resolution.css` in index.css order; pure `resolveRouteSurface(pathname)` in the
route-voice module (showcase: `/`, `/feed`, `/creators`, `/creators/$id`; excludes
`/manage/**` + press descendants); RouteVoiceOutlet emits `data-surface="showcase"` alongside
`data-route`.

## Acceptance
- Showcase surfaces resolve the warm accent through the three aliases (computed/structural
  fixtures per the established route-resolution test pattern); manage/press/voiced routes
  unchanged steel/voice.
- Contrast harness: showcase accent+on-accent pairs + composites over bg/elevated, both
  modes (seeded values must pass AA — choose the light seed accordingly).
- Checker green (tokens file = definition owner; no literals elsewhere).
- One-seam documented: the reversal-to-everywhere path is a named alias move.
