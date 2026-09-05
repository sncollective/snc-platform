---
id: press-kit-template-integration
kind: epic
stage: drafting
tags: [press, templates, media-pipeline]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-04
updated: 2026-09-04
---

# Press-kit template integration (platform lane)

## Brief

The machinery lane beneath the press-kit products, per the operator
architecture decision (2026-09-03, recorded in
`docs/typesetting-toolchain-landscape.md`): a **template registry +
ingestion** surface; a **Typst-WASM compile track** alongside the proven
CSS/Chromium execution lane; **IDML interchange** for pro designers (with
the Scribus one-way bridge + ≥1.6.4 PDF/X-4 finisher lane per
`docs/scribus-bridge-and-finisher.md`); and a **design-primitives token
compiler** as the one source compiled to CSS custom properties, Typst
definitions, and IDML swatches/styles. The gate between platform and the
separate Typst authoring project is the **template package artifact
contract**: Typst source + content-field schema mapping + measured
capacity contract + previews. Known cost, accepted: two render engines,
mitigated by typst-WASM in-process and the shared `@snc/shared` content
model feeding both tracks.

## Strategic decisions

- **Sibling, not parent**, of `press-kit-template-picker-and-image-specs`
  and `press-kit-programmatic-surface` — they keep their operator-scoped
  briefs from the campaign debrief; coordination happens through the
  shared capacity-contract spine, with precise child-level `depends_on`
  wired during epic-design rather than freezing the siblings on the whole
  epic.
- **CSS/Chromium stays the execution lane**; Typst is a template-input
  track, not a renderer replacement.
- **No SLA format target** — Scribus reached via IDML import + Scripter
  only.
- **The artifact contract stays domain-neutral** — a card-deck content
  model must fit without PressContent assumptions (board-game lane
  constraint; see `docs/scribus-bridge-and-finisher.md`).

## Simplification opportunity

The registry consolidates today's hand-wired template registration (four
PDF products pinned in route code) into declarative entries; the
primitives compiler replaces hand-synced token duplication across
surfaces; the render manifest (programmatic surface, Tier 1) and the
contract's capacity-contract + previews get designed as **one mechanism**,
not two.

## Decomposition input

Operator-pinned components for epic-design, not pre-decomposition:

- Design-primitives token compiler MVP (existing token architecture as the
  seed; CSS consumers unchanged)
- Typst-WASM spike — in-process determinism + capacity-contract
  measurability (typst.ts the candidate to verify)
- IDML spike — real-file parse/write (idmlkit-style) + the Scribus 1.6.6
  opens-correctly criterion
- Registry + template package artifact contract
- Ingestion

## Inherits

The press-support rules of thumb in full (retrospective,
`.memory/sessions/press-kit-retrospective-2026-09-03.md`): deterministic
print, loud overflow, measurement-verified changes, extract-and-compare
image geometry, luminance-mapped placement.

Foundation docs already current (landscape + Scribus deep-dive rolled
forward 2026-09-04); epic-design creates the `docs/press-templates.md`
domain reference as a decomposition output.
