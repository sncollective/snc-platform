---
id: parent-voice-warm-accent
kind: story
stage: implementing
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
`--voice-parent-accent2` (signature chip) untouched.

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
  semantic-separation check — parent accent vs the shared warning family (hue angle +
  lightness distance; flag composites closer than a named threshold) per org's
  color-system rule (identity hue must not double as status hue).
- Checker green; full suite + build green.
- Two-grade tension documented in the story body (link-grade vs fill-grade in light) for
  org's value pass.
