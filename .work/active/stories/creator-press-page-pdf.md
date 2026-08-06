---
id: creator-press-page-pdf
kind: story
stage: implementing
parent: creator-press-page
depends_on: [creator-press-page-schema, creator-press-page-api]
release_binding: null
gate_origin: null
created: 2026-08-05
updated: 2026-08-05
---

# PDF generation — one-sheet + one-pager (@react-pdf/renderer)

Full spec in feature body §"Unit 4".

**Deliverables**:
- Add `@react-pdf/renderer@^4.5.1` to `apps/api` deps; pin the version.
- `apps/api/src/services/press-pdf.ts` — `renderOneSheetPdf(release): Promise<Buffer>` and `renderOnePagerPdf(payload): Promise<Buffer>` via `renderToBuffer`; declarative PDF document components; image-resolution helper (Garage object key → buffer via `storage` — confirm the exact buffer-returning read on `storage/index.js`; fallback stream → `Buffer`).
- PDF endpoints in `press.routes.ts`: `GET …/press/one-pager.pdf`, `GET …/press/releases/:slug/one-sheet.pdf` (public, `Content-Type: application/pdf`, buffer body).
- CI render smoke-test (new prod dep) — renders a one-sheet from fixture content.

**Acceptance evidence**:
- [ ] both endpoints return valid `application/pdf` buffers from seeded content.
- [ ] one-pager PDF embeds the hero press photo (resolved from Garage).
- [ ] CI smoke-test green.

**Order**: parallel with web-public + manage-editor after api. Trim lever if the deadline bites (after the one-sheet is in) — the page stays correct without it.
