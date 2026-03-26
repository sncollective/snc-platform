# Rule: Image Decoding

> `<img>` elements should include `decoding="async"` to avoid blocking the main thread during image decode.

## Motivation

By default, browsers decode images synchronously, which can block rendering of other
content. The `decoding="async"` attribute hints the browser to decode the image off
the main thread. This improves perceived performance, especially on pages with
multiple images (creator listings, content feeds).

## Before / After

### From this codebase: OptionalImage component

**Before:** (`apps/web/src/components/ui/optional-image.tsx` line 29)
```tsx
<img
  src={src}
  alt={alt}
  className={className}
  loading={loading}
  width={width}
  height={height}
/>
```

**After:**
```tsx
<img
  src={src}
  alt={alt}
  className={className}
  loading={loading}
  width={width}
  height={height}
  decoding="async"
/>
```

Since `OptionalImage` is the centralized image component used across the app
(creator cards, content thumbnails, product images), fixing it once covers most
image instances.

### What to look for beyond OptionalImage

Raw `<img>` tags not using `OptionalImage` — these are less common but may exist
in landing page components or one-off layouts.

## Exceptions

- Hero/LCP images where synchronous decode is preferred (the browser should decode these as soon as possible) — use `decoding="sync"` or omit the attribute
- Images in `<canvas>` rendering pipelines — decoding is handled programmatically
- SVG elements (not `<img src="*.svg">`) — not bitmap-decoded

## Scope

- Applies to: TSX files in `apps/web/src/` containing `<img` elements
- Primary fix target: `apps/web/src/components/ui/optional-image.tsx`
- Does NOT apply to: test files, server-side code, SVG components
