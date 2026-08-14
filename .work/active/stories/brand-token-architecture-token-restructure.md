---
id: brand-token-architecture-token-restructure
kind: story
stage: done
tags: [design-system]
parent: brand-token-architecture
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-14
updated: 2026-08-14
---

# Token foundation — restructure to reference model

## Brief

Create the new one-owner token composition/file shape (per `brand-token-architecture` →
`## Design — Token file structure`): `tokens/index.css`; semantic color files including
preview/illustration/creator homes; color-only `voices/families.css`; alias-only
`voices/resolution.css`; per-voice-only `radius.css`; invariant `geometry.css`; and the
font/type/supporting files. Seed the complete shared light/dark role set from the republished
org reference, using the per-file mode-block contract (`:root,[data-theme="light"]` /
`[data-theme="dark"]` / `@media prefers-color-scheme` no-attribute fallback).

## Acceptance

- **Composition:** the new one-owner file structure exists; `global.css` imports only
  `tokens/index.css`; `voices/families.css` owns voice colors only, `radius.css` owns
  per-voice radii only, and literal-free `voices/resolution.css` owns every route-resolved
  generic alias.
- **Shared role completeness:** every neutral, status, state, media, badge, internal-data,
  preview, illustration, and creator-contract role has its declared sole owner; every
  mode-aware role is complete in both modes using the current reference values, including
  corrected dark Parent hover `#8E9AAC` and opaque dark paired status backgrounds.
- **Dark migration guard:** at the moment `tokens/index.css` imports the new mode files, pin
  `data-theme="dark"` on `<html>` (or equivalent default-document attribute) because `:root`
  now contains light values and today's app has no attribute. Keep the pin through this
  checkpoint and remove it only when `theming` activates the light/dark/system controller.
- **Additive checkpoint:** no consumer vocabulary migration yet; existing aliases still
  resolve until `alias-migration`.

## Implementation notes

- Execution capability: `gpt-5.6-sol` — caller-selected for the cross-cutting CSS composition and ownership contract.
- Review weight: `standard` (caller/default); review is not applicable to this child-story checkpoint.
- Files changed: added the canonical `tokens/index.css`, semantic `color/**`, `voices/**`, `fonts.css`, `geometry.css`, and transitional `legacy/radius.css`; updated `elevation.css`, `radius.css`, `global.css`, the root document dark-mode guard, and web token tests.
- Tests added/removed: replaced the old flat-token assertions with composition-target, mode-role-parity, exact dark-fallback, canonical-owner, ownership-boundary, fixed-preview, and migration-guard checks. Repaired the existing media-picker focus assertion to await its asynchronous focus effect after it failed only under full-suite load; no assertion was weakened.
- Simplification: collapsed seven global token imports and the global shadow alias into the sole ordered composition entry; moved invariant circle/pill geometry out of the voice-radius owner while preserving the current generic radius vocabulary in a clearly marked transitional file.
- Discrepancies from design: none. The required additive legacy color import intentionally precedes canonical role files, so canonical light/dark definitions win while legacy-only consumer names remain available. Voice colors, per-voice radii, and resolved defaults remain empty structural owners for the explicitly sequenced voice-accents checkpoint.
- Adjacent issues parked: none.
- Verification: `bun run --filter @snc/web test` (185 files / 1,924 tests passed) and `bun run --filter @snc/web build` passed. The build emitted only the repository's existing third-party `use client` directive warnings.
