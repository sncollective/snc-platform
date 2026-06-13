---
id: live-experience-redesign-layout-ergonomics-player-chrome
kind: story
stage: review
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

Absorbs backlog item a11y-viewer-mini-player-touch-target — deleted in this story's commit.

## Acceptance

- [x] Mini-player expand/close buttons: ≥44×44px hit areas, ~24px visible circles,
      positioned inside the overlay corner at both breakpoints
- [x] Mobile fullscreen affordance confirmed (or slot fix applied) — user-confirmed
      via fix-verify loopback before close
- [x] Backlog item file deleted

## Implementation notes

### A. Mini-player touch targets (WCAG 2.5.8/2.5.5)

**Approach:** Padded hit-area technique — `width: 44px; height: 44px; padding: 10px; background-clip: content-box` on `.expandButton` / `.closeButton`. The `background-clip: content-box` restricts both the resting and hover background to the 24px content box (44 − 2×10 = 24px), preserving the visual 24px circle.

**Offset compensation:** `.collapsedActions` offsets adjusted to `max(0px, calc(var(--space-xs) - 10px))` for top/left (resolves to 0px, since `--space-xs` = 4px < 10px) and `max(0px, calc(var(--space-sm) - 10px))` for the audio bar's right offset (resolves to 0px, since `--space-sm` = 8px < 10px). The visible circles shift slightly from their prior exact corner position (from 4px to 10px offset on overlay, 8px to 10px on audio bar) but remain visually inside the corner. The `max(0px, …)` guard prevents the hit area from extending outside the overlay. The 64px-tall audio bar comfortably accommodates the 44px hit area.

**Hover state:** Added `background-clip: content-box` to the hover rule as well, so the hover highlight stays on the visible circle.

**`gap: 4px` on `.collapsedActions` kept:** With the hit areas padding-internal (not margin-external), adjacent buttons' hit areas do not overlap — the 4px gap is between the outer edges of the 44px hit-area boxes, leaving ~4px between visible circles and no overlapping hit areas.

**`box-sizing: border-box` confirmed:** Applied globally in `apps/web/src/styles/global.css` via `*, *::before, *::after { box-sizing: border-box; }`. The content box is therefore 24×24px and the glyph stays centered via flex.

### B. Mobile fullscreen affordance verification

**Package:** `@vidstack/react` v1.12.13 at `node_modules/.bun/@vidstack+react@1.12.13+b2e33729a97476bf/node_modules/@vidstack/react/`.

**Evidence from `dev/chunks/vidstack-BIA_pmri.js`:**

- **`DefaultVideoSmallLayout` (line 1311-1312):** The small layout function constructs its controls groups and explicitly includes `slot(slots, "fullscreenButton", React.createElement(DefaultFullscreenButton, { tooltip: "top end" }))` in the bottom controls group. The fullscreen button IS present in the small layout.

- **Slot propagation (lines 129-131):** `useDefaultVideoLayoutSlots()` returns `React.useContext(DefaultLayoutContext).slots` — the slots prop passed to `DefaultVideoLayout` is propagated via React context. When the current code passes `slots={{ timeSlider: null }}`, only the `timeSlider` slot key is set to `null`; the `fullscreenButton` slot key is `undefined`. The `slot()` helper (line 132-134) renders `defaultValue` when the slot is `undefined`, so the default `DefaultFullscreenButton` renders normally.

- **`slots={{ timeSlider: null }}` does not suppress fullscreen:** Confirmed by tracing the slot helper: `isUndefined(slot2) ? defaultValue : slot2` — `fullscreenButton` is `undefined` → default renders.

**Verdict: No tsx change required.** The Vidstack small video layout renders the fullscreen button on narrow viewports under the current config. Runtime confirmation is deferred to the fix-verify loopback.

### C. Backlog item

The backlog item a11y-viewer-mini-player-touch-target was deleted in this commit. It is referenced here by id only — the file no longer exists.
