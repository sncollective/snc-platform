---
id: press-release-one-sheet-cover-art
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

# Release one-sheet PDF renders release artwork

`ReleaseOneSheet.artKey` exists in the shared content model, but the
release one-sheet PDF product (`releaseSheet()` in
`apps/api/src/services/press-pdf.ts`) renders text fields only - the
web release route does not consume it either. Standard press-one-sheet
practice includes the cover art (radio MDs recognize the release by it),
and the campaign-side session needs it for the "This Hell" cycle-2
presser (pitches go out by ~2026-09-03 for the 2026-09-17 release).

Working state on the campaign side: the This Hell artwork is already in
Garage at
`creators/375328a0-b99f-4961-80c5-65f8140cf35b/press/this-hell-cover-v01.jpg`
and the dev DB's published press config already carries the artKey (the
seed does NOT - a re-seed clears it until this lands).

A complete, typecheck-clean patch was drafted in the campaign session and
reverted per the lane split (code belongs here). It threads `creatorId`
through `renderReleaseOneSheetPdf`, resolves the art via the existing
`resolvePrintImageUrl` (cover slot, 564px for 300ppi at 1.8in), renders a
`release-mast` flex header (art left or right - draft puts art first,
title baseline-aligned), and falls back to the current layout when
artKey is null or the image fails validation. NOT yet visually verified
against a render - that plus the fit check (`singlePage`) and the
existing integration render test are the acceptance work.

Draft patch (apply with judgment; see also the seed artKey line it
assumes):

```diff
diff --git a/apps/api/src/routes/press.routes.ts b/apps/api/src/routes/press.routes.ts
@@ -232,6 +232,7 @@
     const creatorPath = encodeURIComponent(profile.handle ?? profile.id);
     const buffer = await renderReleaseOneSheetPdf({
       release,
+      creatorId: profile.id,
       pressPageUrl: pressPageUrl(creatorPath),
       exportIdentity: {
         producingUnit: "records",
diff --git a/apps/api/src/services/press-pdf.ts b/apps/api/src/services/press-pdf.ts
@@ -348,13 +348,28 @@
-const releaseSheet = (release: ReleaseOneSheet): {
+const releaseSheet = async (
+  release: ReleaseOneSheet,
+  creatorId: string,
+): Promise<{
   readonly bodyHtml: string;
   readonly style: string;
-} => ({
+}> => {
+  const artAlt = `${release.title} single artwork`;
+  const artSrc = release.artKey
+    ? await resolvePrintImageUrl(
+        { key: release.artKey, alt: artAlt },
+        creatorId,
+        { slot: "cover", width: 564, height: 564 },
+      )
+    : null;
+  const artHtml = artSrc
+    ? `<figure class="release-art"><img src="${escapeHtml(artSrc)}" alt="${escapeHtml(artAlt)}"></figure>`
+    : "";
+  return {
   bodyHtml: `<article data-pdf-sheet class="release-sheet">
 <header class="release-brand">S/NC RECORDS · RELEASE ONE-SHEET</header>
-<h1>${escapeHtml(release.title)}</h1>
+<div class="release-mast">${artHtml}<h1>${escapeHtml(release.title)}</h1></div>
 <div class="release-columns">
@@ -381,14 +396,18 @@
-.release-sheet h1{margin:0 0 18px;font:700 28px/1.1 var(--font-display)}
+.release-mast{display:flex;align-items:flex-end;gap:20px;margin:0 0 18px}
+.release-mast h1{margin:0;font:700 28px/1.1 var(--font-display)}
+.release-art{margin:0;flex:none;width:1.8in;height:1.8in;border:1px solid var(--color-border)}
+.release-art img{display:block;width:100%;height:100%;object-fit:cover}
@@ -439,10 +458,11 @@
 export const renderReleaseOneSheetPdf = async (input: {
   release: ReleaseOneSheet;
+  creatorId: string;
   pressPageUrl: string;
   exportIdentity: PdfExportIdentity;
 }): Promise<Buffer> => {
-  const sheet = releaseSheet(input.release);
+  const sheet = await releaseSheet(input.release, input.creatorId);
```

## Implementation notes
- Execution capability: inline (single-owner story, small scope, campaign time-box)
- Review weight: standard (default)
- Files changed:
  - `apps/api/src/services/press-pdf.ts` — `releaseSheet` now async, resolves `artKey` via `resolvePrintImageUrl` (cover slot, 540×540 print px = 1.8in @ 300ppi, matching the 3.125× CSS-px convention of the member/highlight figures; draft's 564 adjusted to the exact convention), renders a `release-mast` flex header (art left, title baseline-aligned) only when art resolves; artless path stays byte-identical to the previous layout. `renderReleaseOneSheetPdf` input gains required `creatorId`.
  - `apps/api/src/routes/press.routes.ts` — threads `creatorId: profile.id` into the render call.
  - `apps/api/src/scripts/seed-press.ts` — sets this-hell `artKey` to `creators/<creatorId>/press/this-hell-cover-v01.jpg` after profile lookup, so the campaign re-seed loop is replayable (verified: identical render byte-count pre/post seed).
  - `apps/api/tests/services/press-pdf.test.ts` — 3 new unit tests (art mast render incl. print-image URL contract; validation-failure fallback; null artKey no-mast) + signature update on the long-field test.
  - `apps/api/tests/integration/library.test.ts` — art upload at an owned press key + `withArt` render; asserts single Letter page and strictly more image XObjects than the text-only render (text-only renders already carry ≥1 image XObject in Chromium PDFs — exact-equality assertion was wrong, relaxed to greater-than).
  - `apps/api/tests/routes/press.test.ts` — call-shape assertion gains `creatorId`.
- Tests: unit 62/62 green (full @snc/api suite), integration library.test.ts 10/10 green.
- Live acceptance: rendered via dev stack (350,843 bytes, single Letter page, pdftotext fields intact); visual check by vision-capable subagent confirmed art present ~180px square @100dpi, mast layout correct, no clipping/overflow, columns+footer intact. Subagent misread footer as `press@sn-c.org`; pdftotext + source confirm `press@s-nc.org` (grep-over-vision per the verification rule).
- Discrepancies from design: print-image target 540 not 564 (see above); conditional mast wrapper instead of unconditional (keeps artless bodyHtml byte-identical, existing assertions stable).
- Adjacent issues parked: none new.

## Review record (2026-09-02, bounded inline pass — standalone story)
- Correctness: artless path byte-identical to previous layout; art resolution goes through the existing owned-key/library gate with dimension probing and warn-not-fail fallback; async conversion awaited at the single call site.
- Security: no new unescaped input reaches HTML (src/alt escaped, key gated by isOwnedPressKey/isLibraryAssetKey).
- Contracts: required creatorId threaded through the only production caller; full @snc/api typecheck green.
- Tests: render/fallback/null unit paths + integration art case assert the right invariants; one relaxed assertion (image-XObject equality → strictly-greater) documented in implementation notes.
- Verdict: pass, no blockers, no importants. stage: review → done.
