---
id: parent-voice-warm-accent
kind: story
stage: done
tags: [design-system]
parent: showcase-voice-presence
depends_on: []
release_binding: null
gate_origin: principal ruling 2026-08-14 (everywhere, not showcase-scoped)
created: 2026-08-14
updated: 2026-08-14
---

# Parent voice warm accent (everywhere ruling)

## Brief
The one-alias move, exercised: `--voice-parent-accent/-hover/-on-accent` in
`voices/families.css` re-seed to the warm amber placeholders, PARENT-WIDE (both modes, all
three blocks incl. the no-attribute fallback). Dark: #E5A83B/#D69A2E/#241703 (org-seeded).
Light: link-grade amber seed (harness-arbitrated: accent doubles as TEXT color via
`--color-link` alias → must clear AA on bg + elevated; CTA on-accent picked by computed
composite — white vs #241703, whichever passes). Steel stays in the neutral ramp +
`--voice-parent-accent2` (signature chip) untouched. These were provisional design seeds;
the org tuned family in `f23f54a` is the final value authority.

## Acceptance
- Both-mode + fallback blocks re-seeded; every alias consumer (links, nav-active, CTAs,
  buttons, focus-adjacent identity) resolves amber through existing aliases — no consumer
  edits except the sweep below.
- **Ink-on-accent sweep:** components assuming light-ink-on-parent-accent (dark mode
  previously had light-steel accent + dark on-accent; light had dark steel + WHITE
  on-accent) re-pair via `var(--color-on-accent)` — sweep hardcoded white/`--color-bg`-as-ink
  shortcuts on accent fills.
- **E2e/visual pin sweep:** grep e2e + unit tests for steel-hex assertions
  (#364050/#242D3A/#A8B2C0/#8E9AAC etc.) on accent surfaces; update to computed/token
  assertions or the new values.
- **Harness additions (token-contrast.test.ts):** (1) re-seeded parent accent pairs +
  composites both modes (text-on-bg/elevated AND on-accent-over-accent); (2) NEW
  semantic-separation check — initially parent accent vs the shared warning family using
  hue/lightness distance, then superseded by the org's OKLab ΔE metric and complete warm-anchor
  set per the color-system rule (identity hue must not double as status hue).
- Checker green; full suite + build green.
- Two-grade tension documented in the story body (link-grade vs fill-grade in light) for
  org's value pass.

## Implementation notes
- Execution capability: `gpt-5.6-sol`; feature-owning worker retained the three-story chain because the token, chrome, and item-voice changes share one visual grammar.
- Review weight: `standard` (feature contract/caller); child checkpoint receives no independent review.
- Files changed: `apps/web/src/styles/tokens/voices/families.css`, `apps/web/tests/unit/styles/token-contrast.test.ts`.
- Tests added/removed: added explicit parent amber seed/composite coverage and a named `MIN_PARENT_WARNING_HUE_LIGHTNESS_DISTANCE` semantic-separation guard; none removed.
- Simplification: retained the existing one-alias voice resolution and changed only the parent accent, hover, and on-accent seeds; parent accent2 and the neutral/steel ramp remain untouched.
- Discrepancies from design: none. The stale steel-hex sweep found no e2e or unit visual pins, and the ink sweep found no accent-fill consumer bypassing `--color-on-accent`.
- Adjacent issues parked: none.
- **Superseded checkpoint:** light seed `#7C4500` cleared `--color-bg` at **6.887:1** and `--color-bg-elevated` at **7.252:1**; white ink cleared the accent at **7.754:1** and hover at **10.203:1**. `#241703` cleared neither light fill, so white was the computed light on-accent.
- **Superseded checkpoint:** dark seed `#E5A83B` cleared `--color-bg` at **8.483:1** and `--color-bg-elevated` at **7.444:1**; `#241703` ink cleared the accent at **8.338:1** and hover at **7.107:1**.
- **Superseded metric:** warning separation used Euclidean distance across circular HSL hue degrees and lightness percentage points, floor **5.5**. Light: hue **5.743°**, lightness **2.745 pp**, composite **6.366**. Dark: hue **2.742°**, lightness **5.098 pp**, composite **5.788**. Org tune `f23f54a` replaced this with OKLab ΔE across the complete warm-anchor set.
- Final family: light `#A94900` / `#913E00` / `#EEE2D6` / `rgba(169, 73, 0, 0.16)` / `#FFFFFF`; dark `#BE7F00` / `#B07800` / `rgba(190, 127, 0, 0.12)` / `rgba(190, 127, 0, 0.2)` / `#2A1603`; accent2 `#5B6B80` in both modes.
- Two-grade tension remains: light amber serves both identity fill and link text, so light uses the deeper link-grade member and white CTA ink while dark uses the brighter fill-grade member and dark ink.
- Verification: `bun run --filter @snc/web test` — 196 files / 2031 tests passed; token checker and contrast harness green.
