# Performance: Loading Strategy (LCP)

> Optimize Largest Contentful Paint by controlling resource loading priority.

## What to Flag

- Below-fold images missing `loading="lazy"` — forces the browser to download all images upfront
- Hero/above-fold images missing `fetchpriority="high"` — browser may deprioritize the LCP element
- `<link rel="preconnect">` missing for third-party origins used in the page (fonts, CDN, API)
- `<video>` or `<audio>` elements without a `preload` attribute

## What NOT to Flag

- Above-fold images without `loading="lazy"` — they should load eagerly (that's correct)
- Images already using the `OptionalImage` component with `loading` prop set
- Audio elements with `preload="metadata"` (correct pattern — loads only duration)
- Resources served from the same origin (no preconnect needed)

## From This Codebase

**Not flaggable**: `components/media/audio-player.tsx` line 81 — `<audio ref={preloadRef} src={src} preload="metadata" hidden />` correctly uses `preload="metadata"` for efficient audio loading.

**Not flaggable**: `routes/__root.tsx` — includes `<link rel="preconnect">` hints for Google Fonts origins.

**Flaggable pattern**: Various image usages in content components without explicit `loading` attribute — the browser defaults to eager loading for all images, including those far below the fold.

**Flaggable pattern** (synthetic):
```tsx
// BAD: hero image without priority hint
<img src={heroUrl} alt="Featured content" width={1200} height={600} />

// GOOD: hero image with fetchpriority
<img src={heroUrl} alt="Featured content" width={1200} height={600} fetchpriority="high" />

// BAD: below-fold image without lazy loading
<img src={thumbnailUrl} alt={item.title} width={300} height={200} />

// GOOD: below-fold image with lazy loading
<img src={thumbnailUrl} alt={item.title} width={300} height={200} loading="lazy" />
```

## Confidence

- Below-fold image missing `loading="lazy"` → **high** (Fix lane)
- Missing `fetchpriority="high"` on hero/LCP image → **medium** (Analyze lane)
- Missing preconnect for third-party origin → **low** (Backlog lane)
