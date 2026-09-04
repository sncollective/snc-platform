---
id: press-kit-programmatic-surface
kind: feature
stage: drafting
tags: [press, api, media-pipeline, devx]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-03
updated: 2026-09-03
---

# Programmatic press-kit surface (agent/API twin)

From the campaign agent's debrief input (2026-09-03, suggestions-not-design
per operator framing), accepted by the platform lane with dispositions below.
Core finding: the internal machinery was always excellent — it served the
web app over HTTP, not programmatic consumers. This feature is the
structured-I/O twin.

## Tier 1 — accepted in full
- **Render API with metadata**: the renderer returns the ground truth it
  already computes — image specs used, placement boxes, luminance behind
  text zones, fit result. Verification becomes diffing, not forensics.
  (This subsumes the render-provenance-stamp takeaway: the manifest
  carries the build identity.)
- **Image ingestion with intelligence**: dimensions + luminance map +
  slot-ratio crop previews on upload (machinery exists:
  loadPrintImageDimensions, luminance probing, aspect derivation).
  Face detection and parameterized server-side grades: later phases
  (model dependency / SVG-bake parameterization respectively) — parked,
  not declined.
- **Content API**: patch endpoint with the draft/publish split + a
  dry-run fit check (validate content, return the fit result without
  rendering). This is the durable answer to the parked 1c question:
  agents iterate copy in seconds without platform-repo commits.

## Tier 2 — accepted with judgment
- **Layout knobs as parameters**: accepted as VARIANT parameters (the
  variant-capacity-contract model), not free-form render knobs — title
  placement zones, spacing bias, window clamps live at the variant level
  where they carry tested contracts. Keeps the determinism discipline
  the session paid for.
- **Render diffing**: changed-regions/spec-deltas between two renders;
  one-field changes skip the vision pass unless geometry shifted.

## Tier 3 — accepted
- **Decoupled render worker**: a stable render process the dev API does
  not reincarnate on working-tree changes — the structural kill for the
  restart-race class (the session's most repeated friction).
- **Schema discoverability**: schema endpoint or typed client for the
  press content model — every new agent currently pays the archaeology
  cost the session's churn demonstrates.

## Transport
Contracts over transport (their framing, accepted): the same contract
serves REST and MCP-shaped callers; design the contracts first.
