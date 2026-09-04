---
id: press-kit-template-picker-and-image-specs
kind: feature
stage: drafting
tags: [press, creators, content, ux]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-03
updated: 2026-09-03
---

# Press-kit template picker + per-slot image spec surface

Operator direction from the campaign/press-support debrief (2026-09-03):
platform users should choose a press template and make bounded adjustments;
the web version flexes (content never disappears — layout flexes), print
stays fixed-size/fixed-layout; image uploads get clearly spelled-out
ratio + pixel targets per slot.

## Scope questions (design pass)
- Template picker surface: which templates are user-selectable today (band
  one-sheet orientations, release one-sheet, release EPK, one-pager), and
  what does "choose" mean in the manage editor vs the public page?
- Per-slot image spec sheet: surfaced where? (editor guidance, upload
  validation, docs?) Spec = ratio + minimum pixels per slot, derived from
  the print geometry (300ppi at the slot's rendered size).
- Pre-upload validation: reject/aspect-check uploads against slot specs,
  with the aspect-derived windows as the tolerance layer underneath
  (already built: probe dimensions, clamp, match print spec).
- Web-reactive guarantees: audit that no breakpoint hides content; slack
  distributes; sections bound. The press page as the reactive twin of the
  fixed print templates.

## Inherits
The press-support rules of thumb (see the retrospective session note)
apply in full: deterministic print, loud overflow, measurement-verified
changes, luminance-mapped placements, extract-and-compare for image
geometry.
