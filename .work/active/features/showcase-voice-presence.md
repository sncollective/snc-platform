---
id: showcase-voice-presence
kind: feature
stage: review
tags: [design-system, ui]
parent: null
depends_on: [voice-route-qa-fixes]  # done 541f8b8
release_binding: null
gate_origin: org voice-presence pickup → home-showcase study → principal's C+ adjudication 2026-08-14
created: 2026-08-14
updated: 2026-08-14
---

# Showcase voice presence (C+ on real surfaces)

## Brief

Graduate the org home-showcase study's winning variant **C+** from mock to the real app:
multi-voice content items under showcase chrome (Fraunces display moments, № eyebrow,
tagline signature chip) plus a **warm grammar accent** on parent-owned audience surfaces.
Principal's verdict: "the parent voice was sorely missing a warm accent."

## Locked decisions (org/principal, 2026-08-14)

- **C+ direction** (multi-voice items + showcase chrome + warm grammar accent).
- **Showcase-scoped** (org recommendation; principal's formal everywhere-vs-showcase ruling
  pending — the architecture keeps the swap to one alias move either way). The spine's
  neutrality is load-bearing for the system layer (`/manage/**`, admin, dashboards stay steel).
- **Warm accent = provisional placeholders**: dark `#E5A83B`/hover `#D69A2E`/on-accent
  `#241703` (org study values); light seeded provisionally to pass AA pending org's tuned
  light+dark pair (arrives with stakeholder review — one-pass swap). Consumed via ONE token
  boundary, never literals.
- **Attribution**: increment 1 ships the content-type fallback (Audio→records, Video→tv,
  Podcast/studio-audio→studio, Post/none→parent) on mapped sections. Creator unit chips
  DEFER to the attribution data model (org-accepted known edge: generic non-music Audio
  mislabels Records-side meanwhile).

## Showcase surfaces

`/`, `/feed`, `/creators`, `/creators/$creatorId` (public creator page). NOT: `/manage/**`
(system), press kit (records-voiced leaf), voiced routes (own grammar).

## Design — the one-boundary accent swap

`tokens/color/showcase.css` (new sole owner): `--showcase-accent`, `--showcase-accent-hover`,
`--showcase-on-accent` in both modes (seeded placeholders above; light = provisional
AA-passing amber, org swaps). One alias block, placed after `voices/resolution.css` in
`tokens/index.css` order:

```css
[data-surface="showcase"] {
  --color-accent: var(--showcase-accent);
  --color-accent-hover: var(--showcase-accent-hover);
  --color-on-accent: var(--showcase-on-accent);
  --font-display: var(--font-display-showcase); /* Fraunces */
}
```

Runtime: the route-voice resolver module gains a pure `resolveRouteSurface(pathname)`
(showcase table above; manage/press exclusions) and the RouteVoiceOutlet emits
`data-surface="showcase"` alongside `data-route` (parent voice on showcase surfaces).
Reversal to everywhere = re-point the three aliases at the voice-parent block or move the
attribute emission — one seam.

**Shell chrome is permanent showcase** (sidesteps the f3 shell-outside-boundary class):
nav tagline sigchip + footer tagline render Fraunces/mono wherever they appear; active-nav
accent on showcase routes composes with the f3 resolver fix (effective accent = voice accent
on voiced routes, showcase accent on showcase routes, steel elsewhere — resolved at the
NavBar consumer).

## Design — chrome + item treatments (per org spec)

- **Home hero**: `№` eyebrow + 2px title underline (accent-bg tint rest → full accent hover).
- **Fraunces moments**: hero title, section titles, footer tagline (`--font-display-showcase`
  = Fontsource `@fontsource-variable/fraunces`, weights 500+; latin+latin-ext; no italic need).
- **Sigchip**: "We boost the signal" mono chip, nav right, subtle (composes with f4's
  SignatureChip grammar — same component family, parent steel content).
- **Per-item voices** (home RecentContent + /feed): item title in unit accent (parent→neutral),
  1px unit-accent hover border; unit attribution link in accent when attribution exists
  (deferred). Per-item accents via inline `--item-unit-*` var chains (checker-clean).
- **WhatsOn**: tv accent on section title (B element org liked). ComingUp: per-event unit
  label (fallback table) in unit accent, titles neutral. FeaturedCreators: NO chips (deferred)
  — names/avatars neutral this increment.

## Scope revision (principal ruling 2026-08-14: EVERYWHERE)

The warm accent is the **parent voice accent on all surfaces** — the showcase accent
boundary COLLAPSES (no `showcase.css`, no `data-surface` block; showcase routes keep only
chrome + item-voice treatments). Steel remains in the neutral ramp + accent2.

## Stories

1. `parent-voice-warm-accent` — the one-alias move: voice-parent family re-seeds amber
   both modes; ink-on-accent + e2e-pin sweeps; harness composites + NEW semantic-separation
   check (accent vs warning family).
2. `showcase-chrome` — Fraunces Fontsource + display moments + № eyebrow + title underline
   (now parent-amber grammar) + sigchip + footer tagline.
3. `showcase-item-voices` — fallback mapping + per-item accents (home + /feed) +
   WhatsOn/ComingUp treatments.

Chain: 1 → 2 ∥ 3.

## Verification

Standard feature review at weight `standard`; org receives captures + harness composites on
landing (pattern established this session). Contrast: showcase accent pairs + accent2-style
composites both modes in `token-contrast.test.ts`.

## Implementation summary

- Parent voice now resolves warm amber everywhere through the existing voice-family seam; steel
  remains in the neutral ramp and parent accent2 signature role.
- Showcase chrome is self-hosted Fraunces on the four public showcase surfaces, with permanent
  nav/footer signatures and the home № eyebrow + amber underline treatment.
- Home and feed content cards resolve item accents from content-type fallback, while What's On and
  Coming Up use TV/studio event fallback. Parent/unknown items remain neutral; creator attribution
  chips and links remain deferred.
- Execution capability: `gpt-5.6-sol` feature-owning worker, direct-read/implementation across the
  sequential child checkpoints.
- Review weight: `standard` from the feature contract/caller; stop at feature review for the caller's
  independent review lane.
- Integrated verification: `bun run --filter @snc/web test` — 197 files / 2052 tests passed;
  `bun run --filter @snc/web build` — passed with existing third-party `use client` warnings only.
- Parent contrast evidence: light `#7C4500` on bg/elevated **6.887:1 / 7.252:1**, white on
  accent/hover **7.754:1 / 10.203:1**; dark `#E5A83B` on bg/elevated **8.483:1 / 7.444:1**,
  `#241703` on accent/hover **8.338:1 / 7.107:1**. Warning-separation composite distance:
  light **6.366**, dark **5.788**, named minimum **5.5**.

## Variant D fold (principal ruling, 2026-08-14 — final direction)

The principal judged shipped-C+ against dial-back D: **D wins** ("D looks solid").
Section + item titles return to spine ink; voice survives ONLY as item punctuation:
hover card borders, event unit labels, badge borders, hero eyebrow label (a label, not
a heading), attribution links + creator chips when the data model lands. Amber grammar +
chrome register unchanged. Applied as the two-line delta: `.showcaseItem .title` accent
rule + WhatsOn `.voiceHeading` (rule + scope + class) removed; punctuation rules and
their tests intact; whats-on test updated to assert the neutral heading. Suite + build
green. Direction now fully adjudicated; remaining opens are stakeholder values, Fraunces
confirm, attribution data model.
