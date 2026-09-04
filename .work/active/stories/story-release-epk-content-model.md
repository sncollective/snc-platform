---
id: story-release-epk-content-model
kind: story
stage: done
tags: [press, creators, schema]
parent: single-release-epk
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-02
updated: 2026-09-02
---

# Release EPK content model

Per-release fields on ReleaseOneSheet at all 5 shared schema sites:
`story` (long text), `lyricPulls: string[]` (default []), `photos:
PressImage[]` (default [], 2-4 guidance), `preSaveUrl` (url-validated,
nullable). Draft variants permissive. Editor release-section fields +
publish validation (urls valid; photo keys owned/library-authorized via
existing machinery). Fixtures updated.

## Acceptance
Typecheck + suites green; fields round-trip draft→publish; campaign can
seed the This Hell brief content.
