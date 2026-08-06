---
id: creator-press-page-pdf
kind: story
stage: done
parent: creator-press-page
depends_on: [creator-press-page-schema, creator-press-page-api]
release_binding: null
gate_origin: null
created: 2026-08-05
updated: 2026-08-06
---

# PDF generation — one-sheet + one-pager (@react-pdf/renderer)

Full spec in feature body §"Unit 4".

**Deliverables**:
- Add `@react-pdf/renderer@^4.5.1` to `apps/api` deps; pin the version.
- `apps/api/src/services/press-pdf.ts` — `renderOneSheetPdf(release): Promise<Buffer>` and `renderOnePagerPdf(payload): Promise<Buffer>` via `renderToBuffer`; declarative PDF document components; image-resolution helper (Garage object key → buffer via `storage` — confirm the exact buffer-returning read on `storage/index.js`; fallback stream → `Buffer`).
- PDF endpoints in `press.routes.ts`: `GET …/press/one-pager.pdf`, `GET …/press/releases/:slug/one-sheet.pdf` (public, `Content-Type: application/pdf`, buffer body).
- CI render smoke-test (new prod dep) — renders a one-sheet from fixture content.

**Acceptance evidence**:
- [x] both endpoints return valid `application/pdf` buffers from fixture-backed public content.
- [x] one-pager PDF embeds the hero press photo (resolved from Garage).
- [x] CI smoke-test green.

**Order**: parallel with web-public + manage-editor after api. Trim lever if the deadline bites (after the one-sheet is in) — the page stays correct without it.

## Implementation notes

- Execution capability: direct-read inline implementation; this child story had a bounded service, route, dependency, and test surface with established storage/route patterns.
- Review weight: standard (project default); independent review is not applicable to this child-story checkpoint.
- Renderer/runtime: installed `@react-pdf/renderer` 4.5.1 and its required direct React 19 peer plus types. Both named imports and an actual `%PDF` render succeeded under `cd apps/api && node --import tsx`.
- Files changed: `apps/api/package.json`, `bun.lock`, `apps/api/src/services/press-pdf.ts`, `apps/api/src/routes/press.routes.ts`, `apps/api/tests/services/press-pdf.test.ts`, and `apps/api/tests/routes/press.test.ts`.
- PDF documents: added branded, A4, `wrap: false` one-page layouts. The release sheet includes catalog/ISRC/UPC/duration metadata, FCC status, personnel, credits, rights lines, label, and S/NC press contact. The creator pager includes the hero photo when readable, bio, for-fans-of, standout-track traction, streaming links, contact, and location.
- Buffer-image approach: `storage.download(key)` returns a web `ReadableStream<Uint8Array>`; the service reads its chunks and uses `Buffer.concat` for the React PDF `<Image src={buffer}>`. Download errors are caught and logged, and rendering continues without the hero.
- Route ordering: the literal `/:creatorId/press/one-pager.pdf` and longer release-PDF route are registered before the existing JSON routes, preventing dynamic release lookup from receiving PDF requests. Hono's body type requires a fresh `Uint8Array(buffer)` at the response boundary while retaining `application/pdf` bytes.
- Public photo streaming: added the indexed enabled-press lookup and reused `streamFile`; disabled/missing/out-of-range photos return 404.
- Tests added: service smoke tests verify one-sheet and one-pager buffers, `%PDF` magic, exactly one page, Garage stream-to-buffer hero resolution, no-photo rendering, and unreadable-photo fallback. Route tests verify both PDF handlers/content types/magic, literal one-pager routing, and clean photo 404 behavior. No tests removed or weakened.
- Verification: `bun install` succeeded; Node/tsx import and render smoke succeeded; `bun run --filter @snc/api typecheck` passed; targeted press tests passed (20/20); full API unit suite passed (120 files, 1,922 tests).
- Simplification: one private storage-to-buffer helper serves the only image-bearing PDF; no cache, custom font layer, browser renderer, or static PDF artifact was introduced.
- Discrepancies from design: React and `@types/react` were added directly because React is a declared renderer peer and the required `.ts` service builds documents with `createElement`; Hono receives a `Uint8Array` copy rather than the Node `Buffer` directly for its stricter `Data` type.
- Adjacent issues parked: none.
