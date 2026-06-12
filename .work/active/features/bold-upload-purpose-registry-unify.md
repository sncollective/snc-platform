---
id: bold-upload-purpose-registry-unify
kind: feature
stage: drafting
tags: [refactor, media]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: bold-upload-purpose-registry
---

# Collapse the four purpose Records into one registry

## Brief
Replace `PURPOSE_CATEGORY`, `PURPOSE_KEY_PREFIX`, `PURPOSE_FIELD`, and
`RECORD_UPLOAD_DISPATCH` in `apps/api/src/services/upload-completion.ts` with a single
`UPLOAD_PURPOSES` registry keyed by the `UploadPurpose` enum from
`packages/shared/src/uploads.ts`, one entry carrying every per-purpose fact. Type-enforce
exhaustiveness so a new purpose without a complete entry fails to compile. All existing
lookups become field accesses on the registry entry.

Behavior-preserving: identical lookup results for every existing purpose — assert via a
table-driven test over all purposes comparing old and new mappings before deleting the
old tables. Riskiest child only in the sense that it carries the design decision (entry
shape, where the registry lives relative to shared vs api); design first via
/agile-workflow:refactor-design.
