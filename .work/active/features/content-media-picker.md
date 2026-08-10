---
id: content-media-picker
kind: feature
stage: done
tags: [media, content, ui]
parent: content-library
depends_on: [content-library-core]
release_binding: null
gate_origin: null
created: 2026-08-09
updated: 2026-08-09
---

# Content library — app-wide media picker (image MVP)

## Brief
The **app-wide contextual media picker** — a modal invoked within any surface
(press editor, profile avatar/banner, content media, …) to fill an image slot:
**browse library (default = current creator) OR upload → crop to the slot's aspect
→ alt/credit → insert.** Generalizes the existing press-specific
`press-image-picker` into the platform's shared media-picker component.
**Image-only MVP, forward-compatible** — it becomes the video/audio picker when
the unified-media-library vision lands (media-type-aware by the target slot).

## Mockup (LOCKED, operator sign-off 2026-08-09)
`.mockups/screens/content-media-picker/option-1.html` (tabbed workbench: library
grid + persistent slot-aware crop/metadata rail; revised through an adversarial
review). Round-1 alternatives alongside for reference.

## MVP scope (operator-confirmed)
- **Atomic selection state** (the review's big fix): idle rail (no stale crop/metadata, Insert disabled); selecting a new asset resets crop/metadata/readiness/Insert; Insert enabled only when the *current* asset has a valid crop + alt.
- **Browse** own library (default current creator) + shared pool (distinct panels, counts, empty, pagination); the **use-check** per asset (usable-now own/open/granted vs not-usable). **No request workflow for MVP** (1 creator; cross-creator request flow parked) — a non-usable asset just explains "needs owner's permission."
- **Real upload** (dropzone → formats/size-limit → progress/cancel → error/retry → crop) + **empty-library** state (primary Upload, secondary Shared).
- **Operable crop** matching the existing `press-crop-editor` (drag pan, arrow nudge, ± zoom, Reset, instructions, **slot-aspect rendered preview**) — consumes `buildPressImageUrl` / `PressImageSlot`.
- **Mobile staged flow** (Browse → Crop+describe, sticky footer + Back), not a stacked rail.
- **Full modal a11y** (Ark Dialog: focus-trap, Escape, restore focus; real tablist/tab/tabpanel; aria-pressed; live announcements; ≥44px controls). **"Choose image"** wording (image MVP).
- **Forward-compatible architecture** (the component is media-type-aware by slot — image now, video/audio later under the unified vision), but image-only behavior + wording for MVP.

## Foundation references
- Generalizes: `apps/web/src/components/press/press-image-picker.tsx`, `press-crop-editor.tsx`, `press-image-field.tsx`.
- `packages/shared/src/content-library.ts` (sharing/use-check), `.claude/skills/imgproxy-v3/SKILL.md` (crop seam), `packages/shared/src/press.ts` (`PressImageSlot`).

## Notes
- Shares the library API with `content-library-page`. Splits the old `content-library-ui` (superseded) into this + the library page.

## Implementation notes
- Execution capability: direct inline implementation; the picker, integrated crop workflow, upload transport, and tests form one cohesive web-component boundary, and the caller prohibited nested subagents.
- Review weight: standard (project default); caller explicitly requested the stop-at-review boundary.
- Files changed: `apps/web/src/components/media-picker/media-picker.tsx`, `media-picker-crop.tsx`, `media-picker-upload.ts`, `media-picker.module.css`, plus focused component/crop tests under `apps/web/tests/unit/components/media-picker/`.
- Tests added: focused behavioral coverage protecting Ark modal/tab semantics, atomic asset state, blocked-permission posture, source empty/pagination states, upload validation/selection, operable crop pan/zoom/reset/server-preview readiness, lifecycle reinitialization, readiness preservation, edit-stage focus, unique tab panels, and stale pagination responses.
- Simplification: reused the established content-library client, normalized press crop math, raw-source adapter, and server-signed press preview seam rather than adding a second library or crop contract.
- Discrepancies from design: shared library responses expose creator IDs but not creator display names, so foreign cards use the truthful generic label “Shared creator”; all locked interaction and layout behavior is preserved.
- Adjacent issues parked: none.

## Review follow-up
- Fixed review blockers in `media-picker.tsx`: open/creator reset now clears idle/selection/upload/pagination state; target and `initialValue` changes reset and re-initialize from any subsequently loaded page; mixed-cursor source states remain honest until pagination is exhausted; same-asset selection is a no-op; mobile selection focuses the edit region; every tab `aria-controls` target remains mounted.
- Updated the pagination fixture assertion to cover a source with zero loaded assets and a remaining global cursor.
- Re-review blocker fixed: every library request, including Load more, now has an AbortSignal and generation fence; close/reopen and creator changes abort requests and discard late pages. Added regressions for reset/reinitialization, readiness preservation, edit-stage focus, unique tab panels, and the deferred Load more race.
- Implementation discovery: no API extension was needed; the client-side mitigation uses the existing mixed cursor as requested. The item remains at `stage: review` for re-review.

## Verification
- `bun run --filter @snc/web test` — green: 185 files, 1,899 tests (the suite still emits pre-existing jsdom navigation and SSR network log noise).
- `bun run --filter @snc/web typecheck` — green.
- Visual re-verification was not completed in this pass. Fresh Firefox captures still need a vision check for: reopening after a ready selection shows idle with disabled Insert; reselecting the current asset does not strand crop readiness/Insert; selecting on a 390px viewport focuses the edit-stage region; a zero-loaded source with a remaining cursor shows “more may exist” plus Load more (not an empty claim); all three tab `aria-controls` IDs resolve without duplicate/unmounted targets. Use a fresh profile and remove `/tmp/mpf-* /tmp/ffp-*` afterward as requested.
