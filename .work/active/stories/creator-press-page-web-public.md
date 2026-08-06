---
id: creator-press-page-web-public
kind: story
stage: implementing
parent: creator-press-page
depends_on: [creator-press-page-schema, creator-press-page-api]
release_binding: null
gate_origin: null
created: 2026-08-05
updated: 2026-08-05
---

# Public web pages — band EPK + per-release one-sheet

Full spec in feature body §"Unit 3". The critical path for the single (must be live Aug 6).

**Deliverables**:
- `apps/web/src/routes/creators/$creatorId/press.tsx` — band EPK page: short bio, for-fans-of, standout track (14.5k), streaming/video links, live dates, press photos (imgproxy responsive), press contact, link to release one-sheet(s), download-one-pager button → `…/press/one-pager.pdf`.
- `apps/web/src/routes/creators/$creatorId/press/releases/$releaseSlug.tsx` — one-sheet page: release metadata (catalog/ISRC/UPC/duration/personnel/FCC), download-one-sheet button → `…/press/releases/:slug/one-sheet.pdf`.
- `apps/web/src/lib/press.ts` — client fetchers (`apiGet`) mirroring `lib/creator.ts`.
- CSS module; OG/twitter meta tags on both pages (load-bearing for press/radio link previews).

**Acceptance evidence**:
- [ ] both pages render seeded AF content; OG/twitter tags present in `<head>`.
- [ ] download buttons target the PDF endpoint URLs (contract; endpoints land in the pdf story — ships together in the release).
- [ ] graceful 404 when press disabled.

**Order**: parallel with pdf + manage-editor after api. Note: the download-link contract depends on the pdf endpoints; both land in the same release so links resolve on ship.
