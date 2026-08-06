---
id: creator-press-page-manage-editor
kind: story
stage: done
parent: creator-press-page
depends_on: [creator-press-page-api]
release_binding: null
gate_origin: null
created: 2026-08-05
updated: 2026-08-05
---

# Primitive manage editor

Full spec in feature body §"Unit 5". The editability surface (primitive, not a rich editor).

**Deliverables**:
- `apps/web/src/routes/creators/$creatorId/manage/press.tsx` + CSS — mirrors `manage/join.tsx`: GET/PATCH `/api/creators/:id/press-config` via `apiGet`/`apiMutate`.
- Primitive form: textareas for bio/for-fans-of/contact, link-list editor, standout-track fields, photo upload (multipart → key → `photos[]`), a releases sub-editor (add/edit one release's one-sheet fields), and an `enabled` toggle.
- Nav entry (editProfile permission) in `manage.tsx`.

**Acceptance evidence**:
- [x] owner/editor edits + saves all fields; viewer gets 403 on PATCH.
- [x] photo upload adds a key to `photos[]`; `enabled` toggles the public page live/off.

**Order**: parallel with web-public + pdf after api. Trim lever if the deadline bites — the seed is correct regardless; this can follow into the same release.

## Acceptance

- [x] Editor loads and saves the full press config through the typed client fetchers and PATCH endpoint.
- [x] Primitive controls cover publication toggle, bios, for-fans-of, links, standout track, contact/location, photos, and release one-sheet fields.
- [x] Photo upload appends the returned object key to the editable photo list; indexed public photo URLs provide thumbnails and removal is supported before save.
- [x] Press navigation is available only to members with `editProfile` through the existing manage-nav permission filter.

## Implementation notes

- Added a normalized local editor state so defaults/nulls from the JSON config remain editable without inventing a second API contract.
- For-fans-of and personnel accept newline/comma-separated input; release records are edited in-place with an add/remove sub-editor.
- Added render/save and photo-upload tests with mocked API fetchers.

## Known follow-ups

- Newly uploaded or draft photos preview through the public indexed URL before save/enable, so the editor preview remains broken until the config is published.
