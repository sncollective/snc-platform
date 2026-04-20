---
id: story-mobile-nav-overflow-access
kind: story
stage: done
tags: [design-system, ux-polish]
release_binding: 0.3.0
created: 2026-04-20
updated: 2026-04-20
related_decisions: []
related_designs: []
parent: mobile-nav-redesign
---

# Mobile nav overflow access (Studio / Merch / Emissions)

Close the architectural gap surfaced during `mobile-nav-redesign-implementation` review (2026-04-20). The mobile menu was retired and the bottom tab bar is limited to Home / Feed / Live / Creators, so routes `/studio`, `/merch`, and `/emissions` have no mobile entry point. Blocks `mobile-nav-redesign` epic from flipping to done; must ship in 0.3.0 (Merch access during the April 24 event is user-facing).

## Decision

**Overflow tab pattern.** Add a 5th "More" item to the bottom tab bar (icon: `MoreHorizontal` from lucide). Tapping opens a sheet anchored at the tab-bar edge containing links to Studio, Merch, Emissions. Standard mobile UX convention, keeps the 4 primary tabs prominent, scales to future secondary routes without a redesign.

**Rejected alternative:** move secondary routes into the UserMenu dropdown. Awkward for logged-out users browsing Merch — would require tapping "Log in" to discover the nav entry.

## Tasks

- [x] **Overflow sheet component** — new `apps/web/src/components/layout/nav-overflow-sheet.tsx` using Ark Dialog in bottom-sheet shape (or Popover anchored at the More trigger — pick per animation/dismiss preference). Renders a list of nav links with lucide icons + labels, tap-to-navigate, closes on select.
- [x] **"More" tab in `bottom-tab-bar.tsx`** — add a 5th tab item that opens the overflow sheet. Icon: `MoreHorizontal`. `aria-label="More navigation"`, `aria-expanded` bound to sheet open state.
- [x] **Link the three routes** — Studio (`/studio`, icon: `Mic`), Merch (`/merch`, icon: `ShoppingBag`), Emissions (`/emissions`, icon: `Leaf`). Reuse the icons from the desktop nav in `nav-bar.tsx`.
- [x] **Desktop hide inherited** — the More tab + sheet live inside `bottom-tab-bar`, which already has `display: none` at `min-width: 768px`. No desktop impact.
- [x] **Keyboard + a11y** — trigger is focusable; sheet traps focus on open; escape closes; links are keyboard-navigable. Matches Ark Dialog defaults if that's the primitive.
- [x] **Unit test** — `apps/web/tests/unit/components/layout/nav-overflow-sheet.test.tsx`: renders nothing when closed, renders all 3 links when open, tap closes + navigates, escape closes.

## Acceptance Criteria

- [x] Bottom tab bar shows 5 items on mobile: Home, Feed, Live, Creators, More
- [x] Tapping More opens a sheet listing Studio, Merch, Emissions with icons + labels
- [x] Each link navigates to the correct route and closes the sheet
- [x] Sheet dismisses via backdrop tap or escape key
- [x] Hidden at ≥768px (desktop nav covers these routes already)
- [x] Matches existing design tokens (colors, spacing, shadow, motion) — no new magic numbers
- [x] Zero impact on the 10 tasks already completed in `mobile-nav-redesign-implementation`
