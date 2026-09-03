---
id: press-destinations-links-and-eyebrow
kind: story
stage: done
tags: [press]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-02
updated: 2026-09-02
---

# Destinations resolve as links + catalog numbers off highlight eyebrows

Operator asks: (1) drop the SNCR catalog number from highlight cards,
(2) make the Spotify/Apple/Amazon/YouTube/Bandcamp destinations line
resolve as links.

## Implementation notes
- Destinations builder now emits per-service anchors (`<a class="destination">`,
  muted styling, no underline) from `streamingLinks`; the two one-sheet
  templates' `escapeHtml(destinations)` wrappers removed (correct for the old
  plain-text string, double-escaping the new markup — caught via the PDF text
  layer showing literal href text before the unwrap).
- Auto-generated release highlights (fallback path when no explicit
  highlights) drop `· ${catalogNumber}` from the eyebrow to match the
  operator preference platform-side; the seeded highlight eyebrows are content
  (campaign relays the `· SNCR-00X` strip).
- Verified: PDF link dictionary carries all 7 URI annotations (bandsintown,
  linktree, 5 services); text layer clean; full unit suite green (one
  assertion legitimately updated for the eyebrow change).
- Adjacent: none.
