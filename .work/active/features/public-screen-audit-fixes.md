---
id: public-screen-audit-fixes
kind: feature
stage: drafting
tags: [design-system, ux-polish]
parent: visual-identity-exploration
depends_on: []
release_binding: null
gate_origin: public-screen adversarial audit 2026-08-15 (vision-reviewed, orchestrator-adjudicated)
created: 2026-08-15
updated: 2026-08-15
---

# Public screen audit fixes (adversarial campaign findings, adjudicated)

Campaign: 48 captures (12 routes × 2 modes × 2 widths), 3 vision reviewers, orchestrator
adjudication. Screenshots in /tmp/screens (regenerable via the harness).

## Adjudicated OUT (artifact, recorded for the discipline)

- **Tab-bar/footer overlap on merch/pricing/login/register mobile** — fullPage stitching
  artifact. Verified clean via real-viewport capture at scroll-bottom (footer reserves
  tab-bar height correctly). Lesson folded into screen-audit SKILL §4.

## Confirmed findings (work list)

**Live off-air cluster (biggest; /live is not ship-ready per review):**
- [ ] Contradictory state: channel marked Scheduled while player chrome says LIVE + chat
      shows "Reconnecting…" — one authoritative off-air state w/ next-program time.
- [ ] Arbitrary slate: saturated blue/green test-video dominates; design a branded off-air
      slate from Live cyan + parent spine.
- [ ] Mobile: channel selector row overflows — Scheduled status clipped; stack or wrap.

**Press page:**
- [ ] Light hero: title + red location over variable mid-gray imagery — scrim or title band.
- [ ] Duplicate full-PDF actions (floating `PressDownloadAction` pin + contact-section
      link, both `fullPressPdfUrl`) — one primary full + one secondary one-sheet, grouped.

**Studio:** dark-mode body legibility (small Newsreader faint on indigo cards) + mobile
line-height/density polish.

**Creators:** placeholder avatar near-invisible in dark + "0 posts" compounds the abandoned
read — monogram/border/initials treatment + friendlier empty copy; bio clamp breaks words
("Co-o…").

**Home:** lead Fresh Drops card visually underfilled (narrow or add excerpt/affordance);
empty Coming Up section collapses to a compact band.

**Merch:** "coming soon" floats abandoned — designed empty-state module (see synthesis:
empty-state system).

**Auth polish cluster:** login/register heading alignment mismatch; control heights toward
44-48px mobile; focus/invalid-state visual coverage (pairs with harness state-captures).

## Tool follow-ups (harness)

- [ ] Authed-surface captures (storage state) — governance calendar is auth-gated
      (redirect-detected; intended? confirm).
- [ ] State captures: focused-field, invalid-submit (auth forms), hover where meaningful.

## Direction items → synthesis (feature body `visual-identity-exploration`)

Identity unevenness (pricing/merch/auth template-feel), empty-state system, live voice
resolution, identity-asset extension (favicon/og/PDF letterhead).
