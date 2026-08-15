---
id: papyrus-light-value-swap
kind: story
stage: done
tags: [design-system]
parent: null
depends_on: [r2-dark-value-swap]
release_binding: null
gate_origin: org papyrus light spec (principal-settled, pending stakeholder), 2026-08-14
created: 2026-08-14
updated: 2026-08-14
---

# Papyrus light value swap (+ TV accent gate catch)

## Applied

- Light spine papyrus mid: bg #EFE9D8 / surface #F3EEE0 / elevated #F6F2E4 (layering fix,
  ratio 1.08) / border #D1CBBD / bg-input #E0DCCB. Ink/muted hold. Nav = solid elevated
  #F6F2E4 (org-accepted, consistent with dark pass).
- Ride-alongs: chart-grid #DFD8C6, chart-tooltip-bg #F6F2E4, disabled-bg #E4DFCF.
- Amber light accent unchanged (confirmed); warning stays #756B00/#EFEBD0.

## Gate catch (composite-suite-as-gate rule working as designed)

Light **TV accent #00786E** dropped to 4.43 on papyrus bg — the only suite failure (org's
pass had checked amber/ink/neutrals but not voice accents; org owned the gap). Held the
commit, flagged with candidates; org picked **#00695F** (5.44 bg / 5.88 elev, separation
improves vs every neighbor). Swapped + pinned as the org contract value in the harness.

## Verification

Full web suite green on the clean 4.5 floor; build green. Ink numbers match org's spec
exactly (amber-on-elev 5.15, ink-on-input 12.98, tooltip 15.93).

## Thread state

Both modes landed (dark cast60+glow; light papyrus+amber). Voice-presence thread
CLOSED-PENDING-REVIEW per org. Outstanding: stakeholder values, Fraunces confirm,
attribution data model — all org-side signals.
