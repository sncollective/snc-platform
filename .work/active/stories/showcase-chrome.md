---
id: showcase-chrome
kind: story
stage: implementing
tags: [design-system, ui]
parent: showcase-voice-presence
depends_on: [showcase-accent-boundary]
release_binding: null
gate_origin: null
created: 2026-08-14
updated: 2026-08-14
---

# Showcase chrome (Fraunces, sigchip, hero)

## Brief
Install `@fontsource-variable/fraunces` (npm-verified 5.3.0; latin+latin-ext; Roman only,
500+ used); declare `--font-display-showcase` (typography.css owner) consumed by the
surface alias block. Home hero: `№` eyebrow + 2px title underline (accent-bg tint rest,
full accent hover). Sigchip "We boost the signal" in nav right (mono, subtle; composes with
the f4 SignatureChip grammar, parent steel content — NOT an accent2 chip). Footer tagline
Fraunces. Section titles on showcase surfaces resolve `--font-display` (Fraunces) via the
surface block.

## Acceptance
- Fraunces self-hosted, no network font requests, subset files present; `font-synthesis: none`
  holds; document.fonts coverage check for `№` (U+2116) in the used faces or named fallback.
- Chrome renders on showcase surfaces; shell chrome (sigchip/footer tagline) renders
  everywhere (permanent showcase chrome per feature design).
- Suites + build green; no new checker exemptions.
