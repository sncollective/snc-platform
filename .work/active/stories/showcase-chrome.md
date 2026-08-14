---
id: showcase-chrome
kind: story
stage: done
tags: [design-system, ui]
parent: showcase-voice-presence
depends_on: [parent-voice-warm-accent]
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

## Implementation notes
- Execution capability: `gpt-5.6-sol`; direct implementation across the established font manifest, landing chrome, and shared layout components.
- Review weight: `standard` (feature contract/caller); child checkpoint receives no independent review.
- Files changed: `apps/web/package.json`, `bun.lock`, font/typography tokens and font-loading test, `SignatureChip`, nav/footer, home hero/section styles, feed/creators/creator-detail showcase heading styles, and focused component tests.
- Tests added/removed: extended the real-WOFF2 Fontsource/cmap contract for Fraunces latin + latin-ext and U+2116 fallback coverage; added nav signature and hero eyebrow assertions; none removed.
- Simplification: reused `SignatureChip` with a narrow `showcase` variant rather than adding a parallel chip component; the variant is transparent with parent-steel content and does not become a filled accent2 chip.
- Discrepancies from design: the principal's collapsed showcase boundary means there is no surface alias to consume `--font-display-showcase`; the four showcase surfaces opt into Fraunces at their existing local heading owners. The stale dependency on removed `showcase-accent-boundary` was corrected to `parent-voice-warm-accent`.
- Adjacent issues parked: none.
- Font coverage: Fontsource Fraunces 5.3.0 is self-hosted from the Roman weight axis. Its latin face does not contain U+2116 (`№`), so the named `Georgia` fallback is exercised; the production Linux fallback resolves to a serif face whose real cmap covers U+2116.
- Verification: `bun run --filter @snc/web test` — 196 files / 2035 tests passed; font contract and color checker green.
