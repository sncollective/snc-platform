---
id: live-player-control-bar-overflow
kind: story
stage: done
tags: [streaming]
parent: null
depends_on: []
release_binding: null
gate_origin: null
research_refs: [vidstack-layout-behavior]
created: 2026-06-14
updated: 2026-06-14
---

# Player control bar overflows the 16:9 frame (mini-player clips it)

Discovered during the layout-ergonomics fix-verify (2026-06-14, live S/NC TV stream up).

## Symptom
The shared persistent `<MediaPlayer>` (apps/web/src/components/media/global-player.tsx —
one instance, presented `expanded` on /live and `collapsed` as a docked mini-player
elsewhere) renders its Vidstack `DefaultVideoLayout` bottom control bar (LIVE badge +
fullscreen button) so that it **overflows the player's 16:9 box**:
- **`/live` (expanded):** controls overflow below the video frame but stay visible (no clip)
  — looks slightly off (controls sit at/just past the bottom edge). User-confirmed at
  462px/375px, both Info and after-restart live playback.
- **Mini-player (collapsed, 200×112px overlay):** the same overflow is cut by
  `overflow:hidden` on `.collapsedOverlay` — the LIVE badge + fullscreen are clipped off the
  bottom. User-confirmed (screenshot, Home page docked preview).

Same player, same overflow; only the clipping differs by presentation.

## Not caused by
- `live-experience-redesign-layout-ergonomics-player-chrome` (only moved the top
  expand/close buttons to opposite corners — verified working).
- `live-experience-redesign-layout-ergonomics-mobile-tabs` (chat-fill + player placement —
  verified working).
Most likely a pre-existing Vidstack layout-vs-frame fitting issue, surfaced now that a live
stream is viewable in dev.

## Scope / suspects
- `apps/web/src/components/media/global-player.tsx` — `<MediaPlayer aspectRatio="16/9">` +
  `<DefaultVideoLayout {...(isLive ? { slots: { timeSlider: null } } : {})} />`. Check
  whether the control bar overlays within the aspect box or extends past it.
- `apps/web/src/components/media/global-player.module.css` — `.collapsedOverlay`
  (aspect-ratio:16/9; overflow:hidden) and `.expanded :global(media-player)`
  (aspect-ratio:16/9).
- `apps/web/src/routes/live.module.css` — `.playerContainer` (aspect-ratio:16/9;
  overflow:hidden) / `.player`.
- Consult the vidstack-v1 reference for how DefaultVideoLayout positions controls relative
  to `aspectRatio`; the controls should overlay the video (absolute, inset:0), not add
  height below it.

## Acceptance criteria
- [ ] On /live (mobile widths 375–767px), the LIVE badge + fullscreen control bar sits
      INSIDE the player's 16:9 frame (overlaid on the video), not overflowing below it.
- [ ] In the docked mini-player (200px), the control bar is not clipped — either it fits
      within the frame, or the mini deliberately uses a minimal layout that doesn't render a
      clipped bar.
- [ ] Fullscreen button remains reachable/tappable on both presentations (don't fix the
      overflow by hiding a needed control without a deliberate call).
- [ ] Desktop (≥768px) player unchanged.
- [ ] User fix-verify (screenshot loop) on /live + mini-player.

## Notes
Fix-verify loopback applies (visual). Verify via the screenshot loop established this session
(scp PNG to a readable path → orchestrator Reads it). Dev streaming bootstrap to get S/NC TV
airing is tracked separately in `dev-bootstrap-playout-content-and-s3-gap`.

## Implementation (2026-06-14)
Root cause: Vidstack base.css `[data-view-type=video][data-started]:not([data-controls]) {
aspect-ratio: inherit }` overrides an app `.class media-player` aspect rule (higher
specificity), so once a live video plays with controls hidden the player drops its 16:9 box
and the control bar (LIVE + fullscreen) falls below the video — visible-overflow on /live,
clipped by overflow:hidden in the 200px mini.

Fix (`apps/web/src/components/media/global-player.module.css`): move the 16:9 box onto the
WRAPPERS and fill the inner player 100%, so Vidstack's conditional aspect rule can't resize
the player:
- `.expanded` gains `aspect-ratio: 16/9`; `.expanded media-player` → `width/height: 100%`
  (was `aspect-ratio: 16/9`).
- new `.collapsedOverlay :global(media-player) { width:100%; height:100% }`.

Verification: @snc/web typecheck clean; global-player tests 42/42. Visual fit (controls
inside the frame on mobile /live + desktop /live + docked mini) is the user fix-verify.

## Attempt 1 REVERTED (2026-06-14 — regressed; reverted in same session)
Tried: move the 16:9 box onto the `.expanded`/`.collapsedOverlay` wrappers + fill the inner
`media-player` 100%. Result (user shots 4–6): made it WORSE — all three modes "converged"
to the clipped behavior. Pinning the player to exactly 16:9 + the wrappers' `overflow:hidden`
CLIPS Vidstack's control bar, which genuinely sits at/below the video's bottom edge. So
/live went from visible-overflow (acceptable) to clipped (regression); mini still clipped;
desktop also clipped. Reverted `global-player.module.css` to pre-attempt state.

Refined root cause: Vidstack's DefaultVideoLayout positions the bottom controls group with a
NEGATIVE bottom offset (`.vds-controls-group:nth-last-child(2) { margin-bottom: -16px }` plus
a `bottom: calc(-1 * var(--gap))` element in video.css), so the LIVE/fullscreen bar extends
~16px+ below the 16:9 video box BY DESIGN (Vidstack players have no overflow clip). Our
rounded `overflow:hidden` wrappers clip it; a player that grows (pre-fix `.expanded`, no
wrapper aspect) shows it hanging below the video.

Candidate fixes for the next attempt (Vidstack-aware; needs the live-stream small layout +
screenshot iteration — controls only render with a live source):
1. **Neutralize the overhang inside our wrappers** — `.expanded :global(.vds-controls-group)`
   / `.collapsedOverlay :global(.vds-controls-group) { margin-bottom: 0 }` (+ any `bottom`
   negative-offset element) so the control bar overlays WITHIN the 16:9 frame. Then it's
   visible on /live AND fits the mini, no clip. (Verify the exact class names against the
   running DOM — video.css is minified; inspect `.vds-controls` descendants.)
2. Give the player box control-bar headroom (box = 16:9 video + control height) — changes the
   16:9 layout assumption; messier.
3. Mini-only: hide the Vidstack control chrome in `.collapsedOverlay` (the mini is a
   tap-to-expand preview with app-provided ↗/✕) — accepts no pause/mute on the mini.

Lean (1): smallest, fixes all three, keeps controls. Inspect the live DOM for the exact
control-group selector before editing; iterate via the screenshot loop.

## Grounded fix approach (from research vidstack-layout-behavior, 2026-06-14)
The ARD campaign `vidstack-layout-behavior` (full rigor; verified) replaced the attempt-1
guesswork with a source-grounded mechanism + recipe. See
`.research/analysis/campaigns/vidstack-layout-behavior/parent.md` §5.

Mechanism: the player box is hard-pinned 16:9 by the inline `aspectRatio="16/9"` prop (NOT the
non-existent `aspect-ratio:inherit` flip attempt 1 chased). Controls overlay `position:absolute;
inset:0`, but the bottom controls group is pushed below the box by a negative margin
(`-16px` large layout `:nth-last-child(2)`; `-6px`/`-2.5px` small layout `:last-child`). The
player wrappers' `overflow:hidden` (for rounded corners) clip that protrusion.

Fix: neutralize the bottom-group negative margin within the app's player wrappers (Vidstack does
exactly this in fullscreen small layout). The small-layout rule is `:where()`-wrapped (zero
specificity), so a scoped override wins without `\!important`:

```css
.expanded :global(.vds-video-layout[data-sm] .vds-controls-group:last-child),
.collapsedOverlay :global(.vds-video-layout[data-sm] .vds-controls-group:last-child) {
  margin-top: 0;
  margin-bottom: 0;
}
.expanded :global(.vds-video-layout:not([data-sm]) .vds-controls-group:nth-last-child(2)) {
  margin-bottom: 0;
}
```
(Targets `.vds-*` internal classes — carries a version-revisit. Verify via screenshot loop at
375px /live (small), desktop /live (large), and the docked mini-player.)

## Attempt 2 (2026-06-14 — grounded; awaiting fix-verify)
Applied the research-grounded recipe to `global-player.module.css`: neutralize the bottom
controls-group negative margin within `.expanded` + `.collapsedOverlay`. Hardened vs the
attempt-1 guess — zeroes BOTH small-layout bottom groups (`:last-child` + `:nth-last-child(2)`)
because the live config (`slots={{timeSlider:null}}`) can shift which group is bottom-most,
plus the large-layout `:nth-last-child(2)` for desktop. No wrapper-aspect / player-fill changes
(that was the attempt-1 regression). Verified: @snc/web typecheck clean, global-player 42/42.
Visual fit is the user fix-verify: 375px /live (small), desktop /live (large), docked mini.

## Attempt 3 — mini resolved differently (2026-06-14, awaiting fix-verify)
Attempt 2 fixed BOTH /live cases (user-confirmed) but the mini still clipped — because the
200×112 mini is too short for the small-layout control stack (overflows the box regardless of
the now-zeroed bleed margin), AND the user surfaced that Vidstack's chrome COLLIDES with the
app's own expand/close overlay buttons (doubled controls). So the mini isn't a "fit the bar"
problem — it shouldn't carry Vidstack chrome at all.

Resolution (settles a small architecture stance — see `.research/analysis/positions/vidstack-media-player.md`
§Chrome strategy): DefaultVideoLayout for full players, **bare** for constrained surfaces.
- `.expanded` keeps DefaultVideoLayout + the attempt-2 bleed-neutralization (the /live fix).
- `.collapsedOverlay` (mini) hides Vidstack's control overlay entirely (`.vds-controls
  {display:none}`) → clean video preview; controls are the app's expand/close (tap-to-expand
  restores full chrome). Resolves the clip AND the chrome collision.
- App mini buttons resized 44px→32px (still ≥ WCAG 2.5.8 AA 24px) — the base 44px-hit /
  background-clip treatment read oversized on a 200px preview.

Verified: @snc/web typecheck clean, global-player 42/42. Visual fit pending user fix-verify on
the mini (the /live cases already passed).

## Fix-verify (2026-06-14 — user confirmed in-app)
User confirmed the docked mini is now a clean video preview — no clipped LIVE/fullscreen bar,
no Vidstack/app-button collision, expand/close sensibly sized. /live (mobile small + desktop
large) confirmed at attempt 2. All acceptance met (the mini AC is satisfied by the bare-preview
approach rather than fitting the bar). Closed review -> done.
