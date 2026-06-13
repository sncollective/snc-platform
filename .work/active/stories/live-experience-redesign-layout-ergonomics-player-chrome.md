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

Absorbs backlog item a11y-viewer-mini-player-touch-target — deleted in this story's commit.

## Acceptance

- [ ] Mini-player expand/close buttons: ≥44×44px hit areas, ~24px visible circles,
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

## Review (2026-06-13)
**Verdict**: Approve — held at review on fix-verify loopback (user confirms in the
running app). Fast lane: implementation record green (1678 web tests, build clean).
Note: fullscreen-button presence on live streams is explicitly runtime-deferred to
this fix-verify (no tsx change was needed per the record).

## Review findings — BOUNCE (user fix-verify failed 2026-06-13)
**Symptom (user)**: mini-player on mobile is still not cleanly clickable.

**Diagnosis (code)**: `global-player.module.css` — the expand + close buttons are 44×44
hit areas (10px transparent padding around a 24px visible circle, `background-clip:
content-box`) laid out in `.collapsedActions` as a `display:flex` row with `gap: 4px`,
both anchored to the overlay's top-left corner inside the 200px-wide mobile
`.collapsedOverlay`. Two problems make taps feel ambiguous:
1. **Adjacent hit areas, 4px apart** — two 44px targets separated by only 4px gap means
   the *touch targets* are 4px apart (WCAG 2.5.8 wants ≥24px spacing between targets, or
   non-overlapping). A tap in the visual gap between the two 24px circles lands in one
   button's padding zone unpredictably; the "overlap cleanly because padding is internal"
   comment is the bug — internal padding doesn't separate the two targets from each other.
2. **Corner crowding / overlap with the player tap-zone** — both buttons pinned to the
   same top-left corner of a 200px overlay; the expand button's hit area likely overlaps
   the player's own tap-to-expand/click region, so a corner tap is contested.

**To fix** (re-verify on mobile via fix-verify): separate the two targets — e.g. push
the close button to the opposite corner (expand top-left, close top-right) so their 44px
hit areas can't touch, OR increase the gap so the hit areas are ≥24px apart, AND ensure
neither hit area overlaps the player's tap region (check z-index/pointer-events layering
against the MediaPlayer surface). Keep the 24px visible circles.

**Fullscreen half of this story was confirmed OK** at the earlier walk — the fix is
scoped to the mini-player touch targets only; don't regress the fullscreen slot.
