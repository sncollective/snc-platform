---
id: live-experience-redesign-layout-ergonomics-player-chrome
kind: story
stage: implementing
tags: [streaming]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: live-experience-redesign-layout-ergonomics
---

# Player chrome — mini-player touch targets + mobile fullscreen verification

Implements **Unit 2** of the parent feature's design (read `## Implementation Units`
→ Unit 2 in the parent body).

## Scope

`apps/web/src/components/media/global-player.module.css`: raise `.expandButton` /
`.closeButton` to 44×44px hit areas with `padding: 10px; background-clip: content-box`
(24px visible circle preserved); compensate `.collapsedActions` offsets so the visible
circles keep today's position. Touch `global-player.tsx` only if the fullscreen slot
fix turns out to be needed.

**Fullscreen verification**: at a 375px viewport on a live channel, confirm the
Vidstack small video layout renders its fullscreen button under the current
`slots={{ timeSlider: null }}` config. Present → record in notes. Suppressed → apply
the named slot fix from the parent design and re-verify.

Absorbs backlog `a11y-viewer-mini-player-touch-target` — delete
`.work/backlog/a11y-viewer-mini-player-touch-target.md` in this story's commit.

## Acceptance

- [ ] Mini-player expand/close buttons: ≥44×44px hit areas, ~24px visible circles,
      positioned inside the overlay corner at both breakpoints
- [ ] Mobile fullscreen affordance confirmed (or slot fix applied) — user-confirmed
      via fix-verify loopback before close
- [ ] Backlog item file deleted
