---
id: live-experience-redesign-layout-ergonomics-desktop-controls
kind: story
stage: implementing
tags: [streaming]
release_binding: null
depends_on: [live-experience-redesign-layout-ergonomics-mobile-tabs]
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: live-experience-redesign-layout-ergonomics
---

# Desktop control polish — resting visibility + recognizable icons

Implements **Unit 3** of the parent feature's design (read `## Implementation Units`
→ Unit 3 in the parent body). `depends_on: mobile-tabs` — same
`live.tsx`/`live.module.css` write-set, serialized behind it.

## Scope

`apps/web/src/routes/live.tsx`: replace the Unicode glyph children of the theater
toggle (⤢/✕) and chat toggle (→/←) with lucide-react icons (`Maximize2`/`X`,
`PanelRightClose`/`PanelRightOpen`, `size={16}`); keep aria-labels/titles/aria-pressed.
`apps/web/src/routes/live.module.css`: resting `opacity: 0.4` + `pointer-events: auto`
for both toggles (replacing the opacity-0/pointer-events-none resting state), full
opacity on `.controlVisible`, `:hover`, and `:focus-visible`. Tests:
`tests/unit/routes/live.test.tsx` (buttons contain `<svg>` instead of glyph text).

## Acceptance

- [ ] Toggles rest visibly (low opacity) and are clickable without prior mousemove;
      full opacity on hover/focus/controls-active
- [ ] Glyphs replaced with the named lucide icons at 16px
- [ ] `:focus-visible` raises opacity (keyboard parity)
- [ ] Existing aria-label-based tests pass; icon assertion added
