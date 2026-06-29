---
id: gate2-refactor-join-route-seo
kind: story
stage: implementing
tags: [refactor, seo]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: refactor
created: 2026-06-29
updated: 2026-06-29
---

# Public join route missing head metadata, canonical URL, and avatar decoding

## Severity
High (3 findings, one file — bundled)

## Location
`apps/web/src/routes/join/$handle.tsx:15,16,185`

## Remediation direction
Add head({ loaderData }) with dynamic title/description; add canonical link; add decoding="async" to creator avatar img.
