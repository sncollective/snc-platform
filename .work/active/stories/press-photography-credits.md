---
id: press-photography-credits
kind: story
stage: done
tags: [press, creators, schema]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-02
updated: 2026-09-02
---

# Photography credits field + one-sheet footer line

Campaign ask: per-image credit overlays proved unacceptable on member thumbs
(~46px squares, caption covers the portrait), and the vertical renders the
rail photo as lead — the March-session photographer (Daniel Melchior) had no
legible surface on the release candidate. Classic EPK shape: one small
footer line.

## Design decisions
- **Option (a) — explicit field** over (b) derive-from-image-credits: a
  credit line is editorial copy, stable as images rotate; derived credits
  couple the footer to whichever images happen to be slotted and change
  silently with content swaps.
- **Single nullable string** `photographyCredits` (not array): the render is
  always one line ("Daniel Melchior · Show Photographer TBD"); array
  machinery buys nothing today.
- One-sheet render: absolute bottom-center small print (7.5px muted) in both
  orientations — the release-sheet footer precedent; exempt from the
  padding-floor fit check by design (anchored chrome), zero layout cost.
- Web PressFooter: `Photography: X` as a second meta line under the contact
  row. Editor: text field on the links tab.

## Implementation notes
- Files: shared `press.ts` (5 schema sites), API `press-pdf.ts` (credits
  line both orientations + CSS), web `press-sections.tsx`/`.module.css`,
  templates A/B, editor model + field.
- Tests: API unit (line + absolute style when set; absent when null — both
  orientations), web unit (footer line).
- Live no-regression: null-credits render 200, no stray line.
- Campaign seeds the value (Daniel Melchior now; show photographer appended
  when the operator identifies them) — their lane.
- Adjacent issues parked: none.
