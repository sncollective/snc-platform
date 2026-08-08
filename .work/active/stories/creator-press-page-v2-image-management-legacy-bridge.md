---
id: creator-press-page-v2-image-management-legacy-bridge
kind: story
stage: done
tags: [creators, content, ui]
parent: creator-press-page-v2-image-management
depends_on: [creator-press-page-v2-image-management-controls]
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-08
---

# Live v1 photo-editor bridge + regression (Unit 5)

Lift the remove→replace fix into the live manage editor without prematurely shipping the full W3 editor, while preserving the parent epic's requirement that v1 remain live until templates/editor v2 land.

## Scope

- Replace the current manage editor's press-photo uploader/preview with the new
  library-backed controls. Initialize from normalized `gallery`, keep local
  `PressImage[]`, and preview by immutable library key rather than saved array
  index. Save authoritative `gallery` plus transitional `photos = gallery.map(key)`
  so the live v1 public page continues to render during the epic.
- Remove the web `uploadPressPhoto` call to `POST /press/photos`; upload new bytes
  through the content library client. Changed bytes under the same filename now
  produce a changed hash/key and immediate unsaved preview.
- Keep `GET /press/photos/:index` only as a documented compatibility bridge while
  the live v1 template addresses photos by index. Teach it to safely serve/redirect
  an authorized library key as well as an owned legacy key. W3/templates remove
  the final indexed consumer; this feature does not break the live page early.
- Remove the old `POST /press/photos` route/handler and its namespace-keyed upload
  tests once no client calls it.
- Do not delete an asset registration when a press reference is removed: it
  remains an intentional reusable library item. No new per-press object orphan is
  created; byte-level mark-and-sweep remains the content-library lifecycle.

## Acceptance evidence

- [ ] Regression: start with image A, remove it, upload changed bytes using the
      same filename, and observe image B's library-key preview before Save.
- [ ] Saving after replacement sends image B in `gallery` and its key in the
      transitional `photos`; saving after removal sends explicit empty arrays.
- [ ] Re-uploading byte-identical A legitimately dedupes to A's existing key;
      changed bytes never alias solely because the filename is unchanged.
- [ ] The v1 public page still renders both legacy namespace photos and authorized
      library-backed transitional photos until W3/templates remove indexed use.
- [ ] Foreign/private/unregistered library keys cannot be streamed through the
      compatibility route.
- [ ] No current web call targets `POST /press/photos`; that route/handler and
      upload-specific tests are gone.
- [ ] Existing manage/public press unit tests are updated and green; the focused
      regression asserts exact preview and PATCH payload behavior.

## Ordering

Final checkpoint after reusable controls. This bridge is intentionally temporary and must not grow into the W3 editor.

## Implementation notes

- Replaced live manage-page indexed photo state with controlled normalized `gallery` references and reusable library image fields. Save derives transitional `photos` from that single state and always sends both arrays, including explicit empty arrays.
- Removed the namespace-keyed web upload helper and API POST handler/route. New bytes now enter only through the content-library upload client; removing a press reference leaves the reusable registration intact.
- Kept indexed GET for the verified transitional consumers: owned legacy keys still stream, while structural library references redirect to immutable public raw delivery. It intentionally does not re-run `canUseAsset` on reads, preserving the operator's passive-grandfather rule after grant revocation; new edits remain gated by PATCH.
- Regression coverage removes A, selects changed bytes with the same filename, observes B's immutable-key preview before save, and verifies exact B `gallery` + `photos` payload. Separate cases prove remove-all empties and byte-identical dedupe behavior.
- Exact-string grep confirms the touched manage fixture uses `press@s-nc.org` and never `press@snc.org`; no current web code calls the retired POST/upload helper.

## Verification

- Focused API press routes — 1 file, 27 tests passed.
- Focused manage bridge — 1 file, 4 tests passed.
- Full API unit suite — 124 files, 1,976 tests passed.
- Full web unit suite — 182 files, 1,866 tests passed.
- Shared suite — 23 files, 723 tests passed (no shared build script exists).
- `bun run --filter @snc/web typecheck` and `cd apps/api && npx tsc --noEmit` — passed with zero diagnostics.
- Full API integration suite — feature-focused library tests pass; the unchanged known baseline remains 46 passed / 4 failed (three channel-lifecycle creator FK fixtures and one test-control gating message assertion).
