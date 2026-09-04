---
id: press-member-print-spec-aspect
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

# Vertical member portraits print at box aspect (no square middleman)

Operator/campaign finding: vertical member boxes are portrait (~48×60
stretched), but the print spec requested 1:1 squares — imgproxy cut squares
from portrait sources and CSS-cover sliced them: rectangles → squares →
rectangles, wasting native resolution and visible image.

## Implementation notes
- `renderMember` vertical spec: `{slot:"member", width:150, height:188}`
  (box-aspect portrait, print px); horizontal stays 225×225 (square boxes).
  Highlight squares unchanged — the 80×80 fixed-square landing makes their
  1:1 spec box-true again. Crop rects remain honored as positioning
  directives (content-side loosening now unblocked).
- Live render: 200, +53KB of native image resolution in the artifact.
- Test note: first test to resolve TWO owned-key images in one render exposed
  a fixture limitation — the storage mock returned one shared single-use
  ReadableStream, so the second resolution read an exhausted stream and
  fell back. Fixed with per-call `mockImplementation(downloadResult)`;
  production paths always had fresh streams.
- Unit: portrait spec asserted for vertical, square for horizontal; full
  suite green.
- Adjacent: none.
