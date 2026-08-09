---
id: press-config-draft-publish
kind: feature
stage: review
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
- [x] `draftContent` column added (nullable JSONB) via a generated migration; existing rows have null draft (published == live, no behavior change).
- [x] Public press page + PDF read `content` (published) — unaffected by draft edits.
- [x] Editor reads `draftContent ?? content`; draft saves write `draftContent`; publish copies draft→content + clears draft.
- [x] Discard-draft clears `draftContent`.

## Notes
- Backward-compatible: existing content + the live page keep working; `draftContent` starts null.
- The editor's cross-tab error summary + Review/Publish surface (locked mock) consume this.
- Land before/with the editor.

## Implementation discovery
- `GET /api/creators/:creatorId/press` and both public PDF paths continue to
  use `getPressConfig`, which reads only published `content`.
- The manage GET and PATCH now use the effective draft (`draftContent ??
  content`) and write only `draftContent`; `POST .../publish` copies the draft
  to `content` and clears it in one transaction, while `POST .../discard-draft`
  clears it without changing published content.
- Existing rows remain backward-compatible because a null draft falls back to
  the published document. The demo seed now saves then publishes its content.

## Verification
- `bun run --filter @snc/shared test` — 23 files, 723 tests passed.
- `bun run --filter @snc/api test:unit` — 124 files, 1,988 tests passed.
- `bun run --filter @snc/api typecheck` — passed.
- `bun run --filter @snc/api test:integration` — 47 passed; 4 pre-existing
  unrelated failures remain (channel-lifecycle FK and test-control gating).
