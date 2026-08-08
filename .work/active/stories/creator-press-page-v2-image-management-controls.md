---
id: creator-press-page-v2-image-management-controls
kind: story
stage: done
tags: [creators, content, ui]
parent: creator-press-page-v2-image-management
depends_on: [creator-press-page-v2-image-management-crop-editor]
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-08
---

# Press asset chooser + image controls (Unit 4)

Reusable press-editor controls for upload, own/shared library reuse, required alt text, optional credit, crop editing, replacement, and removal.

## Scope

- Add typed web library clients in `apps/web/src/lib/content-library.ts` for the
  existing upload and cursor-list endpoints, plus raw-thumbnail URL construction.
- Add `apps/web/src/components/press/press-image-picker.tsx`: a press-scoped
  dialog with Upload new, Your library, and Shared pool source views. Uploaded
  files go to `POST /:creatorId/library/assets` and immediately select the
  returned `storageKey`. Existing assets come from the current list endpoint.
  Open/granted assets are selectable; requestable-without-grant assets remain
  visible but disabled with a direct explanation. Rich request/grant management
  remains owned by `content-library-ui`.
- Add `apps/web/src/components/press/press-image-field.tsx`: controlled value,
  thumbnail, Choose/Replace, Edit crop, Remove, required alt field, and optional
  credit field. Selection flows into the slot-specific crop editor, then commits
  one `PressImage` object through `onChange`.
- Validate nonblank alt before Apply for new/edited v2 references; trim blank
  credit to `null`. Preserve per-reference alt/credit/crop when the same asset is
  reused elsewhere rather than writing metadata to the shared asset.
- Show dimension guidance as non-blocking quality copy; format/10 MB limits remain
  the existing library upload boundary. AF starts with empty slots—no seed photos.
- Export controls from `apps/web/src/components/press/index.ts`; W3 editor owns
  list/reorder/form wiring and public templates own credit rendering.

## Acceptance evidence

- [ ] Upload uses the content library endpoint and commits its `storageKey`, never
      a `creators/{id}/press/{name}` key.
- [ ] Own/open/granted assets can be selected; requestable-needs-grant is visible
      but cannot be applied; private foreign assets never appear.
- [ ] Each slot opens the picker/crop editor with the exact 3:1, 4:5, 1:1, or 4:3
      registry ratio.
- [ ] Apply is blocked with an accessible error until alt is nonblank; credit is
      preserved or normalized to null; crop stays on that reference only.
- [ ] Replace and Remove update controlled local state immediately; Cancel leaves
      it unchanged.
- [ ] Pagination, upload errors, empty own/shared pools, image-load failure, and
      signed-preview failure have explicit recoverable states.
- [ ] Component tests cover upload, browse selection/useStatus gating, alt/credit,
      crop handoff, replacement, removal, and keyboard/focus behavior.

## Ordering

Depends on the crop editor. The transitional v1 bridge and later v2 editor consume these controls.

## Implementation notes

- Added typed content-library upload/list clients that preserve credentials, cursor/abort semantics, and private upload sharing while returning immutable `library/...` keys.
- Added a single press picker flow for Upload new, Your library, and Shared pool. It filters own/shared views from creator/use status, disables requestable assets without grants, exposes a future library access link, de-duplicates pagination, and provides explicit retry/empty/thumbnail-failure states.
- Selection composes the fixed-ratio crop editor, then requires trimmed alt text and normalizes blank credit to `null`. Slot-specific source-size guidance is non-blocking.
- Added a controlled image field with immediate replace/remove, immutable-key thumbnail, metadata controls, crop editing, and an explicit empty state for every slot. Exported all three editor-agnostic controls from the press component barrel.
- Visually verified actual picker and field states at 1280×900 and 390×844: dialogs/fields remain centered, all actions and metadata inputs are legible, selected/empty states compose cleanly, and no horizontal overflow or off-edge media appears. Exact-string grep found neither a correct nor malformed press-email literal in these editor controls.

## Verification

- Focused controls tests — 3 files, 10 tests passed.
- Combined crop + controls tests — 5 files, 25 tests passed.
- `bun run --filter @snc/web typecheck` — passed with zero diagnostics.
