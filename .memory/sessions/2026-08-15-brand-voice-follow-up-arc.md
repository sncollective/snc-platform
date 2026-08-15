---
date: 2026-08-15
session: brand-voice follow-up arc — QA fixes, C+/D direction, R2 value passes, papyrus light, example-chrome ruling
participants: platform agent (pi), org agent (mesh), operator, principal (via org)
---

# Voice follow-up arc: from drained epic to settled brand (both modes)

## What happened

The morning after the `brand-voice-system` drain, operator feedback ("bland", badges unreadable
on imagery) kicked off a one-day arc that took the brand from placeholder-steel to a
principal-adjudicated direction in both modes, with four value passes landing same-session
each time:

1. **Badge fix** — overlay badges on media moved to the on-media scrim contract
   (`content-badge-media-contrast`); org later visually verified across hard imagery.
2. **Org Thread-3 QA** (their captures + pixel sampling) → 4 findings: /live sparse TV
   threading, LIVE chip on stock red not `--voice-tv-accent2`, nav-active neutral on voiced
   routes (locked STATE/IDENTITY miss — shell sits outside the RouteVoiceOutlet boundary;
   fixed by consuming the pure resolver at the NavBar), signature chips missing (f4).
3. **Home-showcase study** — org mocked A/B/C/C+; platform built captures + was mid-build
   of a 3-variant preview flag when the principal picked **C+ mid-flight** (mooted the flag,
   graduated straight to the real feature). **Ruling 2: everywhere, not showcase-scoped** —
   the one-alias-move seam designed for exactly this reversal was exercised: warm amber
   became the parent voice accent parent-wide.
4. **Ruling 3 (variant D)**: titles dialed back to spine ink — voice survives as item
   punctuation only (hover borders, unit labels, badge borders). The feature review then
   caught a genuine D-contract gap (badge borders still category-pinned) + hardened the
   harness (full seed tuple, chart-gold anchor, D regression guards).
5. **Value passes** (org → platform, same-session each): tuned amber family
   (dark #BE7F00/light #A94900; org's ΔE .014 warning-collision on our seed reproduced
   exactly — .01404); **R2**: cast60 indigo spine + glow gold #F5A623 dark, warning cascade,
   chart-gold retune; platform flag-backs (light warning 4.257 → org accepted our #756B00,
   carve removed, clean 4.5 floor; bg-input #262A46); **papyrus light** — our composite gate
   caught the one org miss (light TV accent 4.43 on the warmer paper) → org pick #00695F,
   pinned. Both modes settled pending stakeholder review.
6. **Operator product rulings**: signature pills/chips ("24·96", "A1", "We boost the signal")
   were example grammar, not literal content — removed (LIVE functional indicator kept);
   "№ 01" eyebrow went with the same logic; nav-underline alignment fixed (border-box →
   text-decoration); posts/creators hover outlines fixed (D fallback was an invisible
   neutral → parent accent).

## Numbers that earned trust

Three independent physics agreements (dark amber ΔE; light-warning separation .068→.117;
TV-accent composites) and two org-side gaps caught by our gate (papyrus pass never checked
voice accents; the earlier dark accent-bg omission class). Zero soft floors surviving —
org's own rule, applied to their own value first.

## State at close (board tidied)

Archived this arc: `showcase-voice-presence` (feature) + 9 standalone stories (badge fix,
QA fixes, preview-flag-superceded, warm-accent, chrome, item-voices, R2 swap, papyrus swap,
example-chrome removal). Active queue carries no voice work. Both modes live on dev:
dark = cast60 + glow gold; light = papyrus mid + amber; voice = item punctuation under
parent grammar.

Parked: `accent-bg-consumer-recipe-alignment`, `e2e-shared-state-flake-2026-08-14`,
`brand-voice-user-toggle`, `design-system-component-coverage-expansion` (+ attribution data
model need recorded in the showcase feature body).

## Open (org-side signals)

Stakeholder value review (all values provisional, one-pass swap), Fraunces/chrome register
confirm, attribution data model (creator chips), stakeholder-PDF chip scrub decision
(operator's call, relayed).
