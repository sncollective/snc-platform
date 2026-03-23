# Performance: Layout Stability (CLS)

> Prevent Cumulative Layout Shift by declaring image dimensions and using transform-based animations.

## What to Flag

- `<img>` elements without `width` and `height` attributes — causes layout shift when image loads
- CSS animations or transitions on `width`, `height`, `margin`, `padding`, `top`, `left` — triggers layout recalculation; use `transform`/`opacity` instead
- Dynamic content inserted above existing content without reserved space (e.g., banners, alerts injected at top of page)

## What NOT to Flag

- Images with CSS-controlled dimensions via container queries or `aspect-ratio`
- Animations on `transform` and `opacity` (these are composited, no layout shift)
- SVG elements (dimensions work differently)
- Images in test files or server-side only code

## From This Codebase

**Flaggable**: `components/content/audio-detail.tsx` lines 74, 108, 141, 201, 236 — `<img>` tags have proper `alt` text but no `width`/`height` attributes. When images load, they cause layout shift.

**Not flaggable**: `components/ui/optional-image.tsx` lines 32-34 — accepts optional `width`, `height` props and passes them through. The component supports dimensions; the issue is callers not providing them.

**Flaggable pattern** (synthetic):
```css
/* BAD: animates layout property */
.slideIn {
  animation: slide 0.3s ease;
}
@keyframes slide {
  from { margin-left: -100%; }
  to { margin-left: 0; }
}

/* GOOD: animates transform (composited) */
.slideIn {
  animation: slide 0.3s ease;
}
@keyframes slide {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}
```

## Confidence

- Image missing width/height attributes → **high** (Fix lane)
- Animation on layout property (width, height, margin, etc.) → **high** (Fix lane)
- Dynamic content insertion without reserved space → **medium** (Analyze lane)
