---
id: press-config-draft-publish
kind: feature
stage: drafting
tags: [creators, content, schema]
parent: creator-press-page-v2
depends_on: [creator-press-page-v2-content-model]
release_binding: null
gate_origin: null
created: 2026-08-09
updated: 2026-08-09
---

# Press config — draft / publish (foundation for the v2 editor)

## Brief
Add a **draft vs published** split to the press config so the editor can stage
changes before they go live. The editor (`creator-press-page-v2-editor`) writes
the **draft** + a Publish action copies draft → published; the **public press page
+ PDF read published**. (Today the live `creatorPressConfigs.content` is the only
copy; saves go live immediately — no staging.)

## Scope
- `creatorPressConfigs.draftContent` — a nullable JSONB alongside the live
  `content`. Null = no pending draft (published == live). When set, it holds the
  staged `PressContent` (same schema as `content`).
- Service/API:
  - read/manage paths: **published** read stays `content` (the live page + PDF unaffected until publish).
  - a **draft read** (manage/editor) returns `draftContent ?? content`.
  - a **draft save** (PATCH) writes `draftContent`.
  - a **publish** action copies `draftContent → content` + clears `draftContent`
    (atomic). Optionally a "discard draft" (clear `draftContent`).
- Permission: owner/editor (`editProfile`) for draft save + publish.

## Acceptance
- [ ] `draftContent` column added (nullable JSONB) via a generated migration; existing rows have null draft (published == live, no behavior change).
- [ ] Public press page + PDF read `content` (published) — unaffected by draft edits.
- [ ] Editor reads `draftContent ?? content`; draft saves write `draftContent`; publish copies draft→content + clears draft.
- [ ] Discard-draft clears `draftContent`.

## Notes
- Backward-compatible: existing content + the live page keep working; `draftContent` starts null.
- The editor's cross-tab error summary + Review/Publish surface (locked mock) consume this.
- Land before/with the editor.
