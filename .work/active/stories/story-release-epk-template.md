---
id: story-release-epk-template
kind: story
stage: drafting
tags: [press, design-system]
parent: single-release-epk
depends_on: [story-release-epk-content-model]
release_binding: null
gate_origin: null
created: 2026-09-02
updated: 2026-09-02
---

# Release EPK template + route

`releaseEpkSheet` builder + `renderReleaseEpkPdf` + route
`GET /:creatorId/press/releases/:releaseSlug/epk.pdf?theme=`. Layout per
feature body. Pinned deterministic one-page (hardened fit check, loud
400 with trim guidance); links as URI annotations; box-aspect print
specs; QR light patch; dark via theme param.

## Acceptance
Unit (markup contract, theme, fit-failure mapping) + route tests; live
first render of This Hell for campaign preview with measurements.
