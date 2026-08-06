---
id: creator-press-page-manage-editor
kind: story
stage: implementing
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
- [ ] owner/editor edits + saves all fields; viewer gets 403 on PATCH.
- [ ] photo upload adds a key to `photos[]`; `enabled` toggles the public page live/off.

**Order**: parallel with web-public + pdf after api. Trim lever if the deadline bites — the seed is correct regardless; this can follow into the same release.
