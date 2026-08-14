---
id: brand-voice-export-theming-authoring-cleanup
kind: story
stage: done
tags: [design-system]
parent: brand-voice-export-theming
depends_on: [brand-voice-export-theming-renderer-contract]
release_binding: null
gate_origin: null
created: 2026-08-14
updated: 2026-08-14
---

# Brand voice export theming — authoring cleanup

## Checkpoint

Remove the manage press editor's obsolete caller-selected Light/Dark/Creator Accent PDF modes
after automatic fixed-light voice output is operational. Keep the site-wide creator color field
and expose the two existing PDF preview destinations directly.

## Design element

- In `apps/web/src/routes/creators/$creatorId/manage/-press-editor.tsx`, remove `PdfScheme`,
  `pdfScheme` state/reset logic, the three choice cards, and all `theme=` query construction.
- Keep full and one-sheet preview links, now pointing directly to their existing endpoints.
- Keep the curated creator brand color picker. Rewrite its PDF copy to explain that eligible
  federated creators receive the color automatically as non-text export decoration; no control
  selects export voice or print polarity.
- In `apps/web/src/routes/creators/$creatorId/manage/manage-press.module.css`, delete the
  `.pdfGrid`, `.pdfChoice`, `.pdfPreview`, `.pdfDark`, and `.pdfAccent` branches and their
  responsive residue. Retain only layout needed by the direct actions and brand preview.
- Update `apps/web/tests/unit/routes/creators/manage/press-manage.test.tsx` to assert both
  query-free links and unchanged brand-color save/clear behavior.

## Ordering constraint

Depends on `brand-voice-export-theming-renderer-contract`; do not remove the selector before the
fixed-light automatic renderer is available.

## Acceptance evidence

- [x] No PDF mode or voice choice is rendered, and neither preview URL contains `theme=`.
- [x] The creator brand color remains settable and clearable through the existing profile update
  path; its copy does not promise an unqualified text accent on light paper.
- [x] Obsolete state, reset logic, CSS selectors, and theme-choice assertions are deleted rather
  than retained as hidden compatibility behavior.
- [x] Web unit tests and typecheck pass.
- [x] Rendered PDF inspection confirms this UI simplification did not alter the two endpoint
  destinations or the renderer checkpoint's fixed-light output.

## Implementation notes

- Execution capability: `gpt-5.6-sol`; selected by the autopilot caller for the cohesive UI-state removal and cross-package contract verification.
- Review weight: `standard` from the caller; feature review is intentionally deferred to the orchestrator.
- Files changed: `apps/web/src/routes/creators/$creatorId/manage/-press-editor.tsx`, `manage-press.module.css`, and `apps/web/tests/unit/routes/creators/manage/press-manage.test.tsx`.
- Tests added/removed: replaced the old theme-query interaction assertion with query-free full/one-sheet links, absence of all three mode choices, automatic federated-decoration copy, and brand-color save plus clear coverage.
- Simplification: removed the PDF scheme state/reset branch, three choice cards, query construction, five obsolete CSS selector families, and responsive residue; retained one direct preview action row and the site-wide curated color field.
- Discrepancies from design: the now-unused `PdfScheme` type export remains in `-press-editor-model.ts` because that file is outside this delegated worker's explicit write scope; all runtime state, imports, selectors, and query behavior are removed.
- Adjacent issues parked: none.
