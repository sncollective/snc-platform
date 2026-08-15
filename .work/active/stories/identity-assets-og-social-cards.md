---
id: identity-assets-og-social-cards
kind: story
stage: done
tags: [design-system, ui]
parent: identity-assets-pass
depends_on: []
release_binding: null
gate_origin: identity-assets-pass checkpoint
created: 2026-08-15
updated: 2026-08-15
---

# OG and social cards

Generate deterministic 1200x630 social cards from HTML/CSS, publish a shared default plus
Records and TV accent variants, and give routes without specific metadata an Open Graph/Twitter
image fallback in the root head. Per the relaunch decision, card content is mark + name only:
no tagline or other unapproved copy.

## Acceptance

- `scripts/generate-og.mjs` reproducibly generates the committed PNGs.
- Default, press, and live cards are 1200x630; the default composition passes vision review.
- Root metadata uses `VITE_SITE_URL` to produce the default absolute production image URL, with
  the canonical production origin as its unset fallback.
- Existing route-specific social metadata remains untouched.
- The web test and build pass.

## Implementation notes

- Execution capability: `gpt-5.6-sol` (caller-selected; deterministic generation plus visual composition risk).
- Review weight: standard (project default).
- Files changed: `scripts/generate-og.mjs`, `apps/web/public/og/{default,press,live}.png`, and fallback social metadata in `apps/web/src/routes/__root.tsx`.
- Tests added/removed: none; generator repeat hashes, exact PNG dimensions, source/head assertions, served metadata/card checks, route tests, and build are the useful boundaries.
- Simplification: one variant registry drives all three cards; the canonical SVG and installed Fraunces asset are read in place rather than copied, and the unapproved tagline/body-copy layer was removed entirely.
- Design decision: cards contain only the brush-script mark and the approved name treatment (`S/NC`, `S/NC RECORDS`, or `S/NC TV`) on the neutral cast60/papyrus spine, with the existing parent/Records/TV accent as framing. This keeps the generated surface reversible before stakeholder review.
- Visual evidence: a `gpt-5.6-sol` vision review of the built 1200x630 default PNG returned PASS, confirming only the mark and `S/NC` name were present, with no clipping, overflow, tagline, or extra copy and with clear hierarchy/contrast at preview scale.
- Verification: two consecutive generator runs produced identical SHA-256 hashes; all PNGs report 1200x630; exact source assertions reject the unapproved hero/tagline copy; `bun run --filter @snc/web test` passed (197 files, 2057 tests); `bun run --filter @snc/web build` passed; live SSR served the default absolute OG/Twitter image metadata and `/og/default.png` as `image/png`.
- Discrepancies from design: root wiring stays default-only. Creator/content/press routes already own route-specific social metadata, so the generated press/live variants are a cheap regeneration extension rather than overriding those contracts.
- Adjacent issues parked: none.
