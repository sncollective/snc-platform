---
id: press-dark-export-theme
kind: story
stage: implementing
tags: [press, design-system]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-02
updated: 2026-09-02
---

# Dark-theme press PDF exports

Operator taste call (campaign relay): press PDFs should support the dark
Records voice (cast60 `#171929` bg, `#FF6B5E` accent) alongside the current
forced light paper export. `exportDocumentAttributes` hardcodes
`data-theme: "light"` (brand-voice-export-theming); the token architecture
already carries full dark sheets (`spine.css` semantic tokens,
`families.css` dark voice accents) — the export just pins light.

## Strategic decisions
- **Interface: explicit `?theme=dark` query param, default light** — explicit beats automatic for artifact generation; campaign re-renders on demand; light stays available for print-preferred outlets; zero surprise for existing renders.
- **QR stays on its light patch** — QR modules + quiet zone are the payload-critical fixed pair (comment in press-pdf.ts: "not themeable UI"); scan reliability on dark sheets comes from the white patch, kept deliberate.
- **Priority order** (per campaign): vertical one-sheet → horizontal one-sheet → one-pagers.

## Acceptance
- `?theme=dark` on the three press PDF endpoints produces dark-voiced PDFs; default remains light (byte-stable back-compat for existing artifacts).
- Dark renders pass visual check: cast60 bg, #FF6B5E accent, readable text contrast, image filters acceptable on dark, QR patch scannable-looking.
- Unit + route tests cover theme threading and invalid-theme rejection; export-CSS boundary checker stays green (no new raw pigments).
