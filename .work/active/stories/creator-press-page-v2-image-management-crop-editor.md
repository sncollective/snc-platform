---
id: creator-press-page-v2-image-management-crop-editor
kind: story
stage: implementing
tags: [creators, content, ui]
parent: creator-press-page-v2-image-management
depends_on: [creator-press-page-v2-image-management-api]
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-07
---

# Editor-agnostic press crop editor (Unit 3)

A controlled, dependency-free section picker that produces the normalized crop metadata consumed by the signed imgproxy builder.

## Scope

- Add pure crop geometry in `apps/web/src/lib/press-image-crop.ts`: derive the
  largest slot-ratio rect that fits the source, apply zoom, clamp the focal
  center, convert to normalized `{x,y,width,height}`, and compare/canonicalize
  crops without pixel-coordinate persistence.
- Add `apps/web/src/components/press/press-crop-editor.tsx` + module CSS. The
  controlled editor presents a fixed slot-ratio viewport; pointer drag pans the
  source under it, a zoom input changes the selected section, arrow keys nudge,
  +/- adjust zoom, and Reset centers the largest fitting crop. It consumes
  intrinsic dimensions from library metadata, falling back to image `onLoad`.
- Show the fast local/raw-source viewport during movement. Debounce the
  authenticated `image-preview` call and show a server-signed rendered preview
  from the same eventual crop parameters before Apply. Stale/aborted preview
  responses cannot replace the newest crop.
- Apply returns normalized metadata only; it never creates a derived asset.
  Cancel leaves the caller's image unchanged. Preserve the existing crop on
  reopen.
- Use the existing Ark UI dialog primitives for focus trap, Escape, initial
  focus, and scroll lock. All controls have visible labels; pointer operation is
  not required.

## Acceptance evidence

- [ ] Geometry tests cover landscape→3:1, portrait→4:5, square→1:1, extreme source
      ratios, zoom, edge clamping, and crop round-trip stability.
- [ ] Pointer and keyboard adjustments always yield an in-bounds rect with the
      requested slot aspect (within a documented floating-point epsilon).
- [ ] Apply emits normalized coordinates; Cancel emits nothing; reopen restores
      the prior selection.
- [ ] A changed crop requests a signed preview with the exact key/slot/width/crop;
      stale responses are ignored and errors retain the editable local preview.
- [ ] Keyboard-only tests prove nudge, zoom, reset, Apply, Cancel, and focus
      return; accessible names include the slot label.
- [ ] No crop package or derived-image upload is introduced.

## Ordering

Depends on the signed preview endpoint. The press image controls compose this controlled component.
