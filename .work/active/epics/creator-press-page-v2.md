---
id: creator-press-page-v2
kind: epic
stage: drafting
tags: [creators, content, ui, refactor]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-07
---

# Creator press page v2 — template system + richer content model

## Brief

The v1 press page (`creator-press-page`, shipped in 0.4.0) went out without a
design pass. We ran the mockup iteration (Aug 2026) and locked **two templates**
(reference: `.mockups/screens/creator-press-page/final-{1,3}.html` + `final-index.html`):

- **Template A — Clean editorial** (single-column; members WITH one-line bios).
- **Template B — Two-column zone** (denser; members names-only; three highlights).

This epic implements the v2: a selectable template system + a richer content
model + proper image management + editor + PDF, per the locked design.

## Locked design

Text-on-image header (wordmark aligned to the article column; full-bleed 3:1
banner) → **About** (short bio as a deck/standfirst + long bio as body, NO
toggle) + **"For fans of"** pills → **Members** (name/role/photo, optional
one-line bio) → **Highlights** (merged: current single + standout track +
optional extras like the upcoming LP, each with cover art) → **Live dates**
(Bandsintown list — data source is a *separate* epic; until it lands the page
links to Bandsintown) → **Listen** (streaming-service ICON buttons) → **Gallery**
(carousel, at the bottom) → **Footer** (press email + Download one-pager PDF).

Images are objects `{ key, alt, credit }` (retires the bare-key `photos[]` and
the alt-text scan finding). Each image slot accepts a size **range**;
non-conforming uploads get a **crop/section picker** (per-slot aspect). Per-image
**credits** render as burn-in overlays (web + PDF).

## Feature arcs (epic-design decomposes these into features/stories)

1. **Content model v2** — shared schema (`members[]`, image objects
   `{key,alt,credit}`, `gallery[]`, merged `highlights[]`, `template` selector,
   for-fans-of placement) + migration + backward-compat with live v1 content.
2. **Image management & picker** — upload accepting a size range + the
   crop/section picker (per-slot aspect) + per-image credits + the photo-editor
   fix (remove/replace/preview-local-state/orphan-GC).
3. **Press-page templates** — Template A + B components, the selector, streaming
   icons, carousel gallery, the locked layouts.
4. **Editor v2** — manage members/highlights/gallery/template/credits + the
   image picker + photo-fix.
5. **PDF v2** — render the chosen template to letter-size (the one-pager = the
   template printed).

## Out of scope (separate epic)

- **Bandsintown integration** (`bandsintown-integration`, parked) — server-fetch
  + cache the public API; reusable for press + creator pages. The v2 templates
  *render* the live-dates list; the data source is the separate epic. Until it
  lands, the page links to Bandsintown.

## Notes

- v1 stays live until v2 ships (no formal supersession; v2 replaces the press
  page + editor + PDF in place).
- The photo-editor bug (remove→reupload doesn't change) is a live v1 defect;
  the image-management arc fixes it. Can be lifted as a quick standalone if
  needed before the full v2.
- Two templates ship as "Template A / Template B" — the first of future
  selectable templates (the `template` selector is the seam).
