---
id: creator-press-page-web-public
kind: story
stage: done
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
- [x] both pages render seeded AF content; OG/twitter tags present in `<head>`.
- [x] download buttons target the PDF endpoint URLs (contract; endpoints land in the pdf story — ships together in the release).
- [x] graceful 404 when press disabled.

**Order**: parallel with pdf + manage-editor after api. Note: the download-link contract depends on the pdf endpoints; both land in the same release so links resolve on ship.

## Acceptance

- [x] Both public routes render server-loaded press/release content and show a graceful unavailable state for disabled/missing content.
- [x] Band page renders bios, for-fans-of, standout track, listening links, live dates, contact, release links, photos, and the one-pager PDF contract URL.
- [x] One-sheet page renders release metadata and the one-sheet PDF contract URL.
- [x] Both routes emit OG and Twitter metadata from loader data, including the first press photo as the image.

## Implementation notes

- Added SSR loaders using `fetchApiServer`; disabled press responses are converted to an empty state so link previews and normal navigation do not surface an API error page.
- Press photos use the public indexed photo stream endpoint (`/api/creators/:id/press/photos/:index`); PDF links use the parallel worker's endpoint contracts.
- Added typed client fetchers in `apps/web/src/lib/press.ts` and render tests covering content, photo/PDF URLs, metadata, and disabled state.
