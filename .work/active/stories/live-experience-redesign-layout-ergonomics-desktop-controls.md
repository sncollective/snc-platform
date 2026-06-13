---
id: live-experience-redesign-layout-ergonomics-desktop-controls
kind: story
stage: review
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

## Implementation notes

**Files changed:**

- `apps/web/src/routes/live.tsx` — added `import { Maximize2, PanelRightClose, PanelRightOpen, X } from "lucide-react"` (project idiom, named imports). Replaced Unicode glyph children on the theater toggle (`⤢`/`✕` → `<Maximize2 size={16} />`/`<X size={16} />`) and chat toggle (`→`/`←` → `<PanelRightClose size={16} />`/`<PanelRightOpen size={16} />`). All aria-labels, titles, aria-pressed, and class wiring are unchanged.
- `apps/web/src/routes/live.module.css` — "Control visibility" section: resting state changed from `opacity: 0; pointer-events: none` to `opacity: 0.4; pointer-events: auto`. The `.controlVisible` combined rule extended to also cover `:hover` and `:focus-visible` on both buttons (full opacity at 1.0). This makes the controls discoverable at rest and always clickable, while preserving the window-level mousemove/touch logic that drives full-opacity state.
- `apps/web/tests/unit/routes/live.test.tsx` — added `describe("LivePage — desktop control icons")` with three tests: theater toggle contains `<svg>` and has no glyph text; chat toggle (Hide chat state) contains `<svg>` and has no glyph text; chat toggle (Show chat state after collapse) contains `<svg>` and has no glyph text.

**Test counts:** 154 test files, 1678 tests passing (3 new tests added). Build clean.

## Review (2026-06-13)
**Verdict**: Approve — held at review on fix-verify loopback (user confirms in the
running app). Fast lane: implementation record green (1678 web tests, build clean).
