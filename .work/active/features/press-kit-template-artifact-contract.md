---
id: press-kit-template-artifact-contract
kind: feature
stage: drafting
tags: [press, templates, media-pipeline]
parent: press-kit-template-integration
depends_on: [press-kit-template-registry, press-kit-template-typst-track, press-kit-template-idml-interchange]
release_binding: null
gate_origin: null
created: 2026-09-04
updated: 2026-09-04
---

# Template package artifact contract + ingestion

## Brief

The converging gate: define the template package artifact contract —
Typst source + content-field schema mapping + measured capacity contract +
previews — and build ingestion of external template packages into the
registry. This is the boundary between platform and the separate Typst
authoring project (operator's lane). The contract carries the
domain-neutrality constraint: a card-deck content model (rows = cards,
fields = name/text/cost/art) must fit without PressContent-specific
assumptions. The render manifest (`press-kit-programmatic-surface` Tier 1)
and the contract's capacity-contract + previews get designed as ONE
mechanism, not two — this feature owns that reconciliation. Conformance
for designer-authored packages runs through the render-fidelity checks
already named in the design-authority regime.

## Epic context

- Parent epic: `press-kit-template-integration`
- Position in epic: converging consumer — depends on the registry (target
  surface), the Typst track (package realities, measurability), and IDML
  interchange (designer-regime inputs).

## Simplification opportunity

- One mechanism where two were scoped: contract capacity/previews and the
  programmatic render manifest unify — diffing and verification consume
  the same ground truth the contract publishes.
- Contract design absorbs the variant-capacity-contract model from the
  picker sibling's brief (measured at creation, published with the
  variant) rather than inventing a second capacity vocabulary.

## Coordination (sibling features, no depends_on by design)

- `press-kit-programmatic-surface`: render manifest = contract previews +
  capacity data; dry-run fit = contract measurement API.
- `press-kit-template-picker-and-image-specs`: variant capacity contracts
  are instances of the contract's capacity schema.

## Foundation references

- `docs/typesetting-toolchain-landscape.md` — architecture decision
  (template package artifact contract as the gate) + design primitives
- `docs/scribus-bridge-and-finisher.md` — domain-neutrality constraint
  (board-game lane)
- `.work/active/features/press-kit-template-picker-and-image-specs.md` —
  variant model (operator refinement, 2026-09-03)
