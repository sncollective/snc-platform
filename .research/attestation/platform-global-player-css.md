---
source_handle: platform-global-player-css
fetched: 2026-06-14
source_path: apps/web/src/components/media/global-player.module.css
provenance: source-direct
---

## Summary

The platform's `global-player.module.css` CSS Module scopes styles for the `GlobalPlayer`
component. It contains several `aspect-ratio: 16 / 9` declarations that interact with Vidstack's
own aspect-ratio rules. The file uses `:global(media-player)` to pierce CSS Modules encapsulation
for the Vidstack custom element.

## Key passages with source-internal anchors

**Lines 9–12 — expanded container targets `media-player` element directly:**
```css
.expanded :global(media-player) {
  width: 100%;
  aspect-ratio: 16 / 9;
}
```
This targets the `media-player` HTML custom element (type selector, specificity 0,1,1 in
context of the `.expanded` class + `media-player` element). After CSS Modules compilation, the
`.expanded` class becomes a hashed local class; `media-player` remains a global element type
selector. This specificity (one class + one element) exceeds Vidstack's `:where(...)` at
(0,0,0), and also exceeds Vidstack's `[data-media-player]` attribute selector at (0,1,0).

**Lines 31–43 — collapsedOverlay container sets its own aspect-ratio:**
```css
.collapsedOverlay {
  position: fixed;
  ...
  width: 200px;
  aspect-ratio: 16 / 9;
  ...
}
```
This is on the wrapper `<div>` around the player, not on `media-player` itself. The player
inside inherits nothing from this (the player is `width: 100%` and has its own `aspect-ratio`
from Vidstack or inline style).

**Lines 130–133 — pendingFrame sets aspect-ratio:**
```css
.pendingFrame {
  aspect-ratio: 16 / 9;
  position: relative;
}
```
Also on the wrapper `<div>`, not the player.

## Structural metadata

- CSS Module: compiled class names are hashed; `:global()` preserves raw selector
- `.expanded :global(media-player)` resolves to `.expanded_hash media-player` after compilation
- Specificity after compilation: 0,1,1 (one class + one element) — beats Vidstack's `:where()` at 0,0,0
- Also beats Vidstack's non-`:where()` `[data-media-player]` attribute selector at 0,1,0
- The app passes `aspectRatio="16/9"` as a React prop in global-player.tsx line 129, which
  becomes `style="aspect-ratio: 16/9"` (inline) — highest possible specificity, overrides all
