---
id: brand-token-architecture-token-restructure
kind: story
stage: implementing
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
