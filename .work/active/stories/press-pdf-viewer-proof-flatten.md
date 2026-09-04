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

# Viewer-proof press PDFs: eliminate luminosity soft-masks (PDF.js pink wash)

Campaign relay, operator-caught in VS Code's PDF.js viewer: alpha-gradients
and text-shadows over images make Chromium emit /SMask /S /Luminosity
soft-masks; Poppler-class viewers composite them (both lanes' verification
renderers — why nobody saw it) but PDF.js (VS Code, Firefox built-in,
webmail previews) renders a pink wash. Real-recipient exposure.

## The investigation (probe-driven, in the story for the record)
- Construct matrix via minimal Playwright probes: plain/filtered images →
  raster-alpha SMasks (safe everywhere); gradient overlays, text-shadows,
  box-shadow insets, even SVG-gradient images → /S /Luminosity (the
  PDF.js-unsafe class). Constant-alpha fills → ExtGState, no soft mask.
- gs post-flatten dead ends, both verified: pdfwrite @1.6 PRESERVES the
  masks (my earlier "0 masks" was compression hiding them from byte-greps
  — PDF.js parses object streams regardless); @1.3 truly flattens but
  rasterizes the text layer (zero fonts, zero extractable text).
  An undrained gs stderr also deadlocks the pipe pair; and Bun.spawn 500s
  in the node/tsx-runtime API. gs pass reverted entirely.
- The fix is CSS-level: only constant-alpha solids composite safely.

## The fix
- Rail fade → clean edge + solid caption chip (var(--color-overlay-strong),
  which is itself a constant rgba(0,0,0,.7) token — the safe class).
- Horizontal hero gradient veil → solid bed plate behind the hero copy.
- All text-shadows over images removed; EPK hero ink fixed dark
  (RELEASE_HERO_INK #171929, allowlisted beside the title red — fixed
  photographic ground, same payload-critical class).
- Verified: both sheet artifacts 0 luminosity masks; vision parity pass —
  solid beds read as intentional editorial treatment, no material design
  regression (slightly flatter title, cleaner edges).
- REMAINING (parked): the one-pager prints the live WEB page — its
  gradient/shadow constructs live in web component CSS and need the same
  treatment WITH an operator taste pass (live-page design change); 7 masks
  at last count.
