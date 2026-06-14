---
source_handle: platform-video-player-tsx
fetched: 2026-06-14
source_path: apps/web/src/components/media/video-player.tsx
provenance: source-direct
---

## Summary

`video-player.tsx` is the platform's standalone (non-global) video player component. It wraps
Vidstack's `MediaPlayer`+`DefaultVideoLayout` with a fixed `aspectRatio="16/9"` prop. It
imports `base.css`, `theme.css`, and `layouts/video.css` — three separate Vidstack stylesheets.
The `video-player.module.css` wrapper has no `aspect-ratio` on `media-player` itself (only on
the `.skeleton` placeholder).

## Key passages with source-internal anchors

**Lines 1–3 — CSS imports:**
```tsx
import "@vidstack/react/player/styles/base.css";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
```
Both `base.css` and `theme.css` are imported. Since `theme.css` begins with a verbatim copy of
`base.css` (first 154 lines), the base rules are declared twice in the cascade — functionally
harmless but redundant.

**Lines 33–43 — MediaPlayer usage with explicit aspectRatio:**
```tsx
<MediaPlayer
  src={...}
  aspectRatio="16/9"
  crossOrigin=""
  {...}
>
```
The `aspectRatio="16/9"` prop maps to `style="aspect-ratio: 16/9"` (inline style) on the
rendered element, with highest CSS specificity (inline > any selector).

## Structural metadata

- Platform imports: base.css + theme.css + layouts/video.css (three files; base.css rules doubled)
- `aspectRatio="16/9"` prop is always set (unconditional)
- No custom CSS on `media-player` or `[data-media-player]` in the module CSS
- Wrapper `.wrapper` has `overflow: hidden` and `border-radius` only (no aspect-ratio)
