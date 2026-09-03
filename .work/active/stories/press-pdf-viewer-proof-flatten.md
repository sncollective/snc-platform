---
id: press-pdf-viewer-proof-flatten
kind: story
stage: done
tags: [press, media-pipeline]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-02
updated: 2026-09-02
---

# Flatten luminosity soft-masks out of press PDFs (PDF.js viewer-proofing)

Campaign relay, operator-caught in VS Code's PDF.js viewer: Chromium encodes
alpha-gradients-over-images (rail/hero fades, photo text-shadows) as
/Luminosity soft-masks. Poppler-class viewers composite correctly (both
lanes' verification renderers — why nobody saw it), but PDF.js (VS Code,
Firefox built-in, webmail previews) shows a pink wash. Real-recipient
exposure on the press kit.

## Implementation notes
- `flattenSoftMasks` in browser-pdf.ts: post-render gs re-distill
  (`pdfwrite`, prepress, 300dpi) at the single choke point — every press
  PDF. Verified: 12 masks across the four artifacts → 0; pixel parity
  0.48/255; text stays vector; sizes land smaller (efficient re-encode).
- Fail-open with warn (gs missing/failed → serve Chromium-native; Poppler
  unaffected).
- Two self-inflicted bugs en route, both instructive: (1) `Bun.spawn` in a
  node/tsx-runtime process — the pm2 API runs under NODE, bun-only APIs
  500 at runtime while passing my bun-run direct test; rewrote with
  node:child_process. (2) Undrained gs stderr (ICC warnings) deadlocks the
  pipe pair — drain concurrently. Lesson recorded: test spawn plumbing
  under the ACTUAL runtime, not just the interactive one.
- Suites: full unit green, integration green (renders flow through gs).
