---
id: content-media-picker
kind: feature
stage: drafting
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
