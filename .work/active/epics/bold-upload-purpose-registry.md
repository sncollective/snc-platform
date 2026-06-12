---
id: bold-upload-purpose-registry
kind: epic
stage: drafting
tags: [refactor, bold, media]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: null
---

# An upload purpose is one fact, not four tables

## Thesis
`UploadPurpose` is a first-class domain concept currently shredded across four parallel
`Record`s in `apps/api/src/services/upload-completion.ts` (`PURPOSE_CATEGORY`,
`PURPOSE_KEY_PREFIX`, `PURPOSE_FIELD`, `RECORD_UPLOAD_DISPATCH`) plus a job-queue naming
convention that matches none of them — adding a purpose means remembering four edits
nothing enforces.

## Lens
Unification

## Impact
One registry: `UPLOAD_PURPOSES[purpose] = { category, keyPrefix, field, recordDispatch,
followUpJob }`. Exhaustiveness becomes type-checked (`satisfies Record<UploadPurpose,
PurposeSpec>`); the four tables disappear; the job-name convention drift gets a single
declared seam. Adding a purpose becomes one entry. Directly implements the project's
Single-Source-of-Truth principle.

## Cost
Smallest and safest epic of this scan. The risk is over-building: the registry is a
plain const object, not a plugin system — no dynamic registration, no abstraction beyond
the one lookup. Behavior-preserving throughout.

## Child features (riskiest first)
- **bold-upload-purpose-registry-unify** *(riskiest — design this first)* — collapse the
  four `Record`s into the single registry.
- bold-upload-purpose-registry-job-naming — route follow-up job dispatch through the
  registry, retiring the parallel naming convention.
