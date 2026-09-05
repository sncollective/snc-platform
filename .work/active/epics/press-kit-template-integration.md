---
id: press-kit-template-integration
kind: epic
stage: implementing
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

## Decomposition

Five features, split by capability with the two foundations parallel and
the contract converging: the primitives compiler and the registry are
independent starting points (tokens-to-data; consolidating hand-wired
registration), the two evidence tracks (Typst-WASM, IDML+Scribus) gate on
the compiler, and the artifact contract consumes all three — it needs the
registry as its target surface, the Typst track's package realities, and
IDML's designer-regime findings. Sibling press features stay untouched
per the strategic decision; their coordination points are recorded in
the child briefs.

### Child features

- `press-kit-template-primitives-compiler` — token architecture to data,
  compiled to CSS vars (unchanged) + Typst defs + IDML swatches — depends
  on: `[]`
- `press-kit-template-registry` — declarative registry; ports the four
  hand-wired PDF products; carries per-slot geometry + measured capacity —
  depends on: `[]`
- `press-kit-template-typst-track` — typst-WASM spike (determinism,
  measurability) + minimal compile lane from primitives — depends on:
  `[press-kit-template-primitives-compiler]`
- `press-kit-template-idml-interchange` — IDML parse/write spike +
  Scribus 1.6.6 bridge criterion — depends on:
  `[press-kit-template-primitives-compiler]`
- `press-kit-template-artifact-contract` — package contract + ingestion;
  render-manifest/capacity reconciliation; domain-neutrality — depends on:
  `[press-kit-template-registry, press-kit-template-typst-track,
  press-kit-template-idml-interchange]`

### Simplification arcs

- `press-kit-template-registry` — deletes the hand-wired template
  registration in `press-pdf.ts`/`press.routes.ts` (route-code pinning →
  declarative entries)
- `press-kit-template-primitives-compiler` — deletes cross-surface token
  hand-sync permanently
- `press-kit-template-artifact-contract` — one mechanism where two were
  scoped (render manifest ≡ contract capacity/previews)

## Design decisions

- **Child naming follows repo convention** (`press-kit-template-*` short
  slugs, parent in frontmatter) rather than the skill's full epic-prefix
  form — matches the content-library family and keeps ids readable.
- **Registry split from artifact contract** — registry delivers standalone
  consolidation for the existing CSS products and unblocks both sibling
  features; the contract gates external packages and needs both evidence
  tracks behind it. One feature would have frozen the cheap half behind
  the expensive half.
- **Spikes embedded as spike-first features** (typst-track, idml) rather
  than separate spike stories — keeps evidence next to its consumer and
  lets the spike criteria double as first implementation units.
- **Capacity measurement ownership spans features deliberately**:
  typst-track validates Typst-side measurability, registry carries the
  CSS-side measured contracts, artifact-contract owns the unified schema
  + measurement API. Reconciliation is the contract feature's job, not
  an upfront abstraction.

## Decomposition risks

- Capacity-measurement machinery spanning three features risks vocabulary
  drift before the contract unifies it — mitigated by the contract
  feature's explicit reconciliation scope and the picker sibling's variant
  model as the named target vocabulary.
- Critical path primitives → typst-track → contract is three deep; the
  registry lane runs parallel so consolidation value lands early
  regardless.
- The two-engine bet concentrates risk in `press-kit-template-typst-track`
  — spike criteria are the gate; refuting the bet there is a recorded
  outcome, not a failure mode, per the architecture decision's known-cost
  framing.

## Inherits

The press-support rules of thumb in full (retrospective,
`.memory/sessions/press-kit-retrospective-2026-09-03.md`): deterministic
print, loud overflow, measurement-verified changes, extract-and-compare
image geometry, luminance-mapped placement.

Foundation docs already current (landscape + Scribus deep-dive rolled
forward 2026-09-04); epic-design creates the `docs/press-templates.md`
domain reference as a decomposition output.
