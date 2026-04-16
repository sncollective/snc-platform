---
updated: 2026-04-16
---

# Responsive Design Best Practices (2025-2026)

Research compiled April 2026 to inform responsive patterns for the S/NC platform (TanStack Start + React 19 + CSS Modules + Ark UI on Vite). Focuses on techniques with stable Baseline browser support and minimal runtime overhead.

## TL;DR Recommendations for the S/NC Stack

- **Default to mobile-first** with `min-width` media queries. Two or three named breakpoints are plenty.
- **Reach for intrinsic layouts first** (`grid-template-columns: repeat(auto-fit, minmax(…, 1fr))`, flex-wrap, `clamp()` widths). Use container queries for component-level layouts when the same component appears in containers of varying widths.
- **Fluid typography with `clamp()`** on an rem-based type scale. Generate the clamp() formulas with Utopia or a calculator, not by hand.
- **Fluid spacing (clamp) for section padding/gaps**, fixed rem steps for component padding. Mixing the two is correct, not sloppy.
- **CSS custom properties for tokens**, hard-coded pixel values in `@media` queries. Document the breakpoint numbers in one token file; do not try to reference custom properties inside `@media ()` — it doesn't work.
- **Responsive images**: `srcset` + `sizes` + `aspect-ratio` + `loading="lazy"` + `fetchpriority="high"` for LCP images.
- **SSR**: render the mobile layout by default on the server, let CSS upgrade on the client. Never gate layout on a JS `window.innerWidth` check during first render — hydration mismatch.
- **Use `dvh`/`svh`/`lvh`** instead of `vh`. Use `@media (hover: hover)`, `@media (pointer: fine)`, and `prefers-reduced-motion` gates for interaction styles.
- **Touch targets minimum 24x24 CSS px** (WCAG 2.2 SC 2.5.8 AA); aim for 44x44 where space allows (SC 2.5.5 AAA / Apple HIG).

---

## 1. Mobile-First vs Desktop-First

### Why mobile-first won

- **Traffic**: >60% of global web traffic is mobile (StatCounter, 2024-2025). On consumer media platforms it's usually higher.
- **Progressive enhancement is cheaper than graceful degradation**: adding complexity at wider viewports (more columns, sidebars) is additive; removing complexity from a desktop layout to fit a phone means fighting cascade and specificity.
- **Performance budget**: starting from the smallest layout forces you to question every kilobyte, image, and font before scaling up. Desktop-first tends to ship everything then hide it with `display: none`.
- **CSS cascade favors it**: base styles + `min-width` media queries read top-to-bottom in increasing complexity. Desktop-first with `max-width` is harder to reason about once you have 3+ breakpoints.

### When desktop-first still applies

- **Admin tools / dashboards** that are genuinely never used on phones and have dense data tables. Even here, mobile-first with a "this table needs 1024px" notice is usually cleaner.
- **Print-first document tools** (long-form editors) where the canonical form is a page at a fixed width.
- **Embedded kiosks** with a known single viewport.

### Migration strategy (desktop-first → mobile-first)

1. **Inventory breakpoints**: grep for `@media` and categorize `max-width` vs `min-width`. Record the actual pixel values used — legacy codebases usually have drift (768, 767, 760, 750).
2. **Consolidate breakpoint tokens** to a small set (2-3) before flipping directions. This is the hard part; leave it as its own PR.
3. **Flip per component, not globally**: pick a component, rewrite its styles base = narrowest, then layer `min-width` on top. Delete the old `max-width` blocks. Visual-regression test against production.
4. **Keep a compatibility layer** during migration: a single wrapper class that forces desktop-first behavior on legacy pages while new pages opt in.
5. **Baseline on intrinsic layouts** where possible — you'll find chunks of breakpoint CSS become unnecessary once `auto-fit minmax()` grids and `flex-wrap` are in place.

References:
- Luke Wroblewski, *Mobile First* (still the definitive argument): https://abookapart.com/products/mobile-first
- MDN mobile-first overview: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Responsive_design_building_blocks

---

## 2. Container Queries (`@container`)

### Baseline support (April 2026)

- **Baseline Widely Available** since February 2023 (all evergreen browsers 2+ years ago). Safe to use without fallbacks in any project that doesn't support IE/legacy Edge.
- `@container` size queries, `cqw`/`cqh`/`cqi`/`cqb`/`cqmin`/`cqmax` units: full support.
- **Style queries** (`@container style(--foo: bar)`): Chrome/Edge/Safari shipping, Firefox partial (as of early 2026). Not Baseline yet — use with a fallback.
- **`container-type: scroll-state`** and **state queries**: newer, not Baseline, don't rely on them.

### When to use container queries vs media queries

- **Media queries** answer "how big is the viewport?" — use for page-level layout (does the nav collapse, is there a sidebar, how many columns in the main grid).
- **Container queries** answer "how much room does this component have?" — use when the same component appears in multiple layout slots (sidebar, main column, modal, card grid) and should adapt to each.
- **Rule of thumb**: if rendering the same `<ArticleCard>` in a 300px sidebar and a 900px grid cell requires two different layouts, that's container queries. If the whole page switches to a single-column layout below 768px, that's a media query.

### Containment types

- `container-type: inline-size` — queries the inline (horizontal in LTR) dimension. **This is what you want 95% of the time.** It establishes containment on inline-size and layout only.
- `container-type: size` — queries both dimensions. Requires the element to have a definite block-size (height), which usually means you've broken normal block flow. Avoid unless you specifically need height queries.
- `container-type: normal` — default; element is a query container for style/state queries but not size queries.

**Pitfall**: `container-type: size` on an element that derives its height from its content will collapse to 0. Only use when the container has an explicit height set by its parent layout.

### Naming containers

```css
.card-grid {
  container-type: inline-size;
  container-name: card-grid;
  /* shorthand: container: card-grid / inline-size; */
}

@container card-grid (min-width: 480px) {
  .card { grid-template-columns: 120px 1fr; }
}
```

- **Always name containers** in a component library — prevents a nested component from accidentally querying the wrong ancestor.
- Naming convention: use the component name (`card`, `product-tile`, `sidebar`) or the feature area (`--cq-article`, `--cq-hero`). Pick one and be consistent.
- Unnamed `@container (min-width: X)` queries the nearest ancestor container, which can bite in deeply nested trees.

### Performance

- Size containment has a measurable but small cost; browsers have optimized it heavily since 2023. Don't containerize every element — only components that genuinely need intrinsic responsiveness.
- Container queries re-evaluate on container resize, not on every frame. Modern Chrome/Safari/Firefox use the same layout-pass machinery as media queries.
- **Don't nest container queries deeply** (container inside container inside container) unless necessary; each adds a containment boundary.

### Container cycles & pitfalls

- **Cycle**: setting a property inside `@container` that changes the container's own inline-size can create an infinite loop. Browsers detect and break cycles, but the result is visual flicker. Avoid setting `width`, `padding-inline`, or `margin-inline` on the container itself inside its own `@container` rule.
- **Fonts and intrinsic content**: if a child's text drives the container's width (no fixed parent), container queries can oscillate as the layout settles. Set a definite width or max-width on the container.
- **SSR**: container queries are pure CSS and work fine with SSR. The server doesn't need to know the container size — the browser resolves it post-hydration. No hydration mismatch.
- **Fallback strategy**: for very old browsers (not a concern for S/NC), the `@container` rule is ignored; design the base styles to be a sensible default (usually the narrow-container layout).

### Container queries vs `auto-fit, minmax()` intrinsic grids

The two tools overlap. Use the simpler one.

```css
/* Intrinsic grid: lay out N cards, wrap when each would be < 240px */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
}
```

- **Use `auto-fit` + `minmax()` when** the children are interchangeable, their internal layout stays the same regardless of card width, and you just need the count of columns to adapt.
- **Use container queries when** the child's internal layout changes based on its available width (e.g. image above text below 400px, side-by-side above).
- **Combine them**: an `auto-fit` grid whose cards use container queries to restructure their internals is the canonical modern component pattern.

References:
- MDN CSS Container Queries: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries
- web.dev "A primer on container queries": https://web.dev/articles/cq-stable
- Ahmad Shadeed, "Say Hello to CSS Container Queries": https://ishadeed.com/article/say-hello-to-css-container-queries/
- Miriam Suzanne (spec editor), "Container Queries: a Quick Start Guide": https://www.oddbird.net/2021/04/05/containerqueries/
- CSS Containment Module Level 3 spec: https://www.w3.org/TR/css-contain-3/

---

## 3. Fluid Typography via `clamp()`

### The core pattern

```css
:root {
  /* clamp(min, preferred, max) */
  --step-0: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
  --step-1: clamp(1.25rem, 1.15rem + 0.5vw, 1.5rem);
  --step-2: clamp(1.5rem, 1.3rem + 1vw, 2rem);
}
```

- **min** and **max** should always be in `rem` so they respect user font-size preferences.
- **preferred** mixes `rem` (or `em`) with `vw` so the fluid growth has a non-viewport component — this is the "CSS lock" pattern.

### The viewport-width math (Mike Riethmuller's CSS Locks)

To grow from `minSize` at viewport `minVW` to `maxSize` at viewport `maxVW`:

```
slope       = (maxSize - minSize) / (maxVW - minVW)
yIntercept  = minSize - slope * minVW
preferred   = yIntercept + slope * 100vw       /* slope * 100vw because 1vw = 1% viewport */
```

Expressed in CSS:

```css
/* Grow from 1rem at 320px to 1.5rem at 1280px (16px base) */
/* slope = (1.5 - 1) / (1280 - 320) = 0.5 / 960 = 0.0005208 rem/px
   yIntercept = 1 - 0.0005208 * 320 = 0.8333 rem
   preferred = 0.8333rem + 0.05208vw  (0.0005208 * 100 = 0.05208) */

font-size: clamp(1rem, 0.833rem + 0.521vw, 1.5rem);
```

### Why mix `rem` and `vw`

- **Pure `vw`** breaks accessibility: zooming the browser doesn't change vw, so text doesn't scale for users who rely on browser zoom.
- **Pure `rem`** gives you stepped breakpoints, not fluidity.
- **`rem + vw`** scales with both viewport size *and* user zoom. The `rem` component carries the zoom; the `vw` component carries the fluidity.

### WCAG accessibility concerns

- **SC 1.4.4 Resize Text (AA)**: text must be resizable up to 200% without loss of content/function. Make sure your `clamp()` upper bound lets 200% zoom work — test it. Pure `vw` fails here.
- **SC 1.4.10 Reflow (AA)**: content must reflow to 320 CSS px width (400% zoom at 1280px) without two-dimensional scrolling. Your clamp minimums need to work at 320px.
- **SC 1.4.12 Text Spacing (AA)**: users must be able to override line-height, letter-spacing, word-spacing, paragraph-spacing. Avoid baking these into single-shot declarations that break when overridden.
- **Min preferred value**: some accessibility testers flag clamp() expressions where the user zoom couldn't increase the effective size. Keep `rem` as the dominant term in `preferred`.

### Tools

- **Utopia.fyi** (James Gilyead & Trys Mudford): https://utopia.fyi/ — clamp() generator for type scale and space scale. Outputs CSS custom properties directly. Industry standard.
- **Fluid Type Scale Calculator** by Aleksandr Hovhannisyan: https://www.fluid-type-scale.com/
- **Modern Fluid Typography Editor**: https://modern-fluid-typography.vercel.app/
- **Utopia VS Code plugin** for inline preview.

### Worked examples

**Body text**: 16px at 320px → 18px at 1440px.
```
slope = (1.125 - 1) / (1440 - 320) = 0.000111 rem/px → 0.0111vw
yInt  = 1 - 0.000111 * 320 = 0.9643 rem
```
```css
--body: clamp(1rem, 0.964rem + 0.111vw, 1.125rem);
```

**H1**: 32px at 320px → 56px at 1440px.
```
slope = (3.5 - 2) / (1440 - 320) = 0.00134 rem/px → 0.134vw
yInt  = 2 - 0.00134 * 320 = 1.571 rem
```
```css
--h1: clamp(2rem, 1.571rem + 1.339vw, 3.5rem);
```

(In practice: generate with Utopia, paste in, don't hand-calculate.)

### Preferred units cheatsheet

| Unit | Use for | Avoid for |
|------|---------|-----------|
| `rem` | min/max of clamp(), fixed sizes | pure fluid |
| `em` | component-relative sizing (line-height) | page-level scale |
| `vw` | fluid preferred component only | min/max |
| `cqi`/`cqw` | container-scoped fluidity | page-level text |
| `px` | borders, very small UI details | anything typography |

References:
- Mike Riethmuller, "Precise control over responsive typography" (the original): https://madebymike.com.au/writing/precise-control-responsive-typography/
- Utopia "Designing with fluid type scales": https://utopia.fyi/type/calculator/
- CSS Tricks "Linearly Scale font-size with CSS clamp()": https://css-tricks.com/linearly-scale-font-size-with-css-clamp-based-on-the-viewport/
- WCAG 2.2 SC 1.4.4 Resize Text: https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html
- Adrian Roselli, "Responsive Type and Zoom": https://adrianroselli.com/2019/12/responsive-type-and-zoom.html

---

## 4. Fluid Spacing

### Where it helps

- **Section padding** (vertical rhythm between major page sections): a hero that's 4rem tall at 320px and 8rem at 1440px reads correctly without stepping through breakpoints.
- **Layout gutters** (main grid gap, column gaps): smooth scaling prevents awkward "just too tight" or "suddenly loose" moments between breakpoints.
- **Hero / landing page padding**: most visible win for fluid spacing.
- **Container max-width margins**: `padding-inline: clamp(1rem, 4vw, 4rem)`.

### Where fixed scales are better

- **Component internal padding** (button padding, card padding, form field padding): users develop muscle memory for touch target sizes. Fluid here feels unstable.
- **Gaps in lists** where the rhythm should feel like a fixed scale.
- **Icon-to-text gaps**: fluidifying a 0.5rem gap buys nothing and can produce sub-pixel artifacts.
- **Anything tied to a font-size** — use `em` or a fixed rem step tied to the type scale.

### Pattern: two tiers of space tokens

```css
:root {
  /* Fixed scale for components */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;

  /* Fluid scale for layout (320 → 1440) */
  --space-fluid-s:  clamp(0.5rem, 0.4rem + 0.5vw, 1rem);
  --space-fluid-m:  clamp(1rem, 0.75rem + 1.25vw, 2rem);
  --space-fluid-l:  clamp(2rem, 1.5rem + 2.5vw, 4rem);
  --space-fluid-xl: clamp(3rem, 2rem + 5vw, 7rem);
}
```

Use `--space-*` for component internals. Use `--space-fluid-*` for section-level and page-level layout.

References:
- Utopia "Fluid space calculator": https://utopia.fyi/space/calculator/
- Andy Bell, "Custom property magic tricks": https://piccalil.li/blog/custom-property-magic-tricks/

---

## 5. Breakpoint Strategy

### Canonical vs content-driven

- **Content-driven wins**. The moment content starts to feel cramped, break. Don't start from "iPhone 14 is 390px wide" — start from "at what width does my nav break?"
- Canonical device widths (Bootstrap, Tailwind, Material) exist because they're easy to teach and happen to line up with common viewports. They're a fine starting scaffold; let real content revise them.
- **Test your breakpoints at 320px, 768px, 1024px, 1440px, 1920px** and any width where your content actually breaks.

### Number of breakpoints

- **2-3 is almost always enough** for a well-built responsive layout.
- A typical modern site: `--bp-md: 768px` (phone → tablet) and `--bp-lg: 1024px` (tablet → desktop) covers 90% of needs. Add `--bp-xl: 1440px` only if layout genuinely changes there.
- **Many breakpoints is a smell** — it usually means the layout isn't using intrinsic techniques and is trying to pixel-push through every viewport.

### Naming conventions

Common patterns (pick one, stick to it):

| Style | Example | Notes |
|-------|---------|-------|
| T-shirt sizes | `xs, sm, md, lg, xl, 2xl` | Tailwind, Bootstrap. Familiar, scales. |
| Device names | `phone, tablet, desktop, wide` | Readable; ages badly as devices change. |
| Numeric | `bp-480, bp-768, bp-1024` | Self-documenting. No ambiguity. |
| Layout-purpose | `single-col, two-col, sidebar, wide` | Describes what changes. Best for small sets. |

For S/NC: **layout-purpose naming** (`single-col`, `with-sidebar`, `wide`) is clearest when you only have 2-3 breakpoints, and it matches the intrinsic-layout mental model.

### The CSS custom property limitation

**CSS custom properties cannot be used directly in `@media` conditions:**

```css
/* THIS DOES NOT WORK */
@media (min-width: var(--bp-md)) { ... }
```

This is a spec limitation (media queries are evaluated before custom properties are resolved for element styles). See: https://www.w3.org/TR/css-variables-1/#using-variables

**Workarounds:**

#### 1. Document the number, use it literally (recommended)

Single source of truth in a token file as a comment + CSS variable for non-media uses:

```css
/* tokens/breakpoints.css */
:root {
  /* Breakpoints (keep in sync with @media rules below)
     --bp-md: 768px
     --bp-lg: 1024px  */
  --bp-md: 768px;  /* for JS matchMedia() and calc() use */
  --bp-lg: 1024px;
}

/* in component CSS — write the literal */
@media (min-width: 768px) { ... }
```

Accept the minor duplication. It's boring and it works.

#### 2. Build-time preprocessing (Sass/PostCSS)

Use a Vite plugin or PostCSS plugin (`postcss-custom-media`) to replace `@custom-media` definitions at build time:

```css
@custom-media --md (min-width: 768px);
@custom-media --lg (min-width: 1024px);

@media (--md) { ... }
```

- `@custom-media` is a CSS spec (CSS Media Queries Level 5) but **not yet in browsers**. Always needs a build step.
- postcss-custom-media: https://github.com/csstools/postcss-plugins/tree/main/plugins/postcss-custom-media
- With Vite this is a one-line config addition.

#### 3. The env() hack (not recommended)

Some projects expose breakpoints via `env()` through a custom build step. Fragile and surprising. Skip it.

#### 4. Container query units at root

Use `cqi`/`cqw` with an implicit root container to make some breakpoint-ish logic work without media queries — but this changes semantics significantly. Only for component-internal logic.

### Recommendation for S/NC

Two approaches, pick one:

- **Simple path**: hard-code breakpoint values in `@media` queries, expose them as custom properties for JS and `calc()` use, document the canonical set in `tokens/breakpoints.css` with a comment.
- **Build-step path**: add `postcss-custom-media` to the Vite config, write `@media (--md)` everywhere. Single source of truth at the cost of one dependency.

The S/NC stack already uses CSS Modules and custom properties heavily, so either works. I'd lean toward the **simple path** because it adds zero build complexity and the duplication is confined to one file.

References:
- MDN CSS Custom Properties: https://developer.mozilla.org/en-US/docs/Web/CSS/--*
- CSS Media Queries Level 5 (custom media): https://www.w3.org/TR/mediaqueries-5/#custom-mq
- postcss-custom-media: https://github.com/csstools/postcss-plugins

---

## 6. Intrinsic / Responsive Images

### The modern baseline

```html
<img
  src="/img/hero-800.jpg"
  srcset="/img/hero-400.jpg 400w,
          /img/hero-800.jpg 800w,
          /img/hero-1200.jpg 1200w,
          /img/hero-1920.jpg 1920w"
  sizes="(min-width: 1024px) 800px, 100vw"
  width="1200"
  height="675"
  alt="Studio A control room"
  loading="lazy"
  decoding="async"
  fetchpriority="auto"
/>
```

Key attributes:

- **`srcset` with `w` descriptors**: browser picks the smallest image that serves the layout size × DPR.
- **`sizes`**: tells the browser how wide the image will *render* at each viewport. Must match your CSS layout. Getting `sizes` wrong is the #1 responsive-images mistake.
- **`width` + `height` attributes**: reserve space, prevent CLS. These are **required** for good Core Web Vitals.
- **`loading="lazy"`**: below-the-fold images. Do NOT apply to LCP (hero) images.
- **`fetchpriority="high"`**: for the LCP image. Signals high priority; browsers de-prioritize other resources to load it faster.
- **`decoding="async"`**: non-blocking decode; safe default.

### `<picture>` for art direction & format

Use `<picture>` when:

- **Format fallbacks** (AVIF → WebP → JPEG). Browser picks first supported `<source>`.
- **Art direction** — different crop/aspect ratio at different viewports (e.g. tall mobile hero, wide desktop hero with different focal point).

```html
<picture>
  <source type="image/avif" srcset="/img/hero.avif 1x, /img/hero@2x.avif 2x" />
  <source type="image/webp" srcset="/img/hero.webp 1x, /img/hero@2x.webp 2x" />
  <img src="/img/hero.jpg" alt="…" width="1200" height="675" />
</picture>
```

Don't use `<picture>` for simple DPR switching — `srcset` with `w` descriptors is enough and produces cleaner markup.

### `aspect-ratio` CSS property

```css
.thumb {
  aspect-ratio: 16 / 9;
  width: 100%;
  height: auto;
  object-fit: cover;
}
```

- Baseline since 2021, fully supported.
- Prevents CLS when the image's intrinsic ratio isn't known upfront (e.g. from a CMS).
- Combine with `object-fit: cover` / `contain` for cropping behavior.
- Always still include `width` and `height` HTML attributes — they're used before CSS loads.

### Image CDN options

| Option | Pros | Cons | Good for S/NC if… |
|--------|------|------|-------------------|
| **Cloudflare Images** | Integrated resizing, polish, signed URLs, cheap storage | Vendor lock-in, separate product from Cloudflare Workers | Already on Cloudflare edge |
| **Cloudflare Image Resizing** (via Workers) | Resize on the fly from your origin, no separate product | Requires Workers, more to wire up | Custom transform pipeline needed |
| **imgix** | Best-in-class transforms, fast, good docs | Expensive at scale | High-volume image-centric site |
| **Cloudinary** | Feature rich, video too, AI transforms | Expensive, complex pricing | Mixed image+video workflows |
| **Thumbor** (self-hosted) | Open source, full control | Ops burden | Already self-hosting everything |
| **imgproxy** (self-hosted) | Fast, Go, minimal ops | Still ops burden | Sitting next to existing S3 |
| **S3 + on-the-fly resize Lambda/Worker** | Cheap, owned | Rolling your own | Lean budget, moderate traffic |

Given S/NC's Garage S3 setup and likely Cloudflare presence: either **Cloudflare Image Resizing** or **self-hosted imgproxy in front of Garage** are the natural choices. imgproxy pairs cleanly with S3-compatible backends and is what most "S3 + resize" pipelines end up being.

- imgproxy: https://imgproxy.net/
- Cloudflare Image Resizing: https://developers.cloudflare.com/images/image-resizing/

### Modern formats

- **AVIF**: best compression (~50% smaller than JPEG for equivalent quality). Baseline support as of 2024. Use as first choice.
- **WebP**: fallback for older Safari. Baseline since 2020.
- **JPEG XL**: superior to AVIF in many ways, but Chrome dropped support. Not deployable at scale yet.
- **JPEG**: final fallback. Always include.

### References

- web.dev "Serve responsive images": https://web.dev/articles/serve-responsive-images
- web.dev "Optimize LCP": https://web.dev/articles/optimize-lcp
- MDN `<picture>` element: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/picture
- MDN `srcset`: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#srcset
- Jake Archibald, "The anatomy of responsive images": https://jakearchibald.com/2015/anatomy-of-responsive-images/
- Addy Osmani, "Image Optimization" (free ebook): https://www.smashingmagazine.com/printed-books/image-optimization/

---

## 7. Common Pitfalls

### `100vh` on mobile → use `dvh`/`svh`/`lvh`

Mobile browsers show/hide URL bars dynamically, which changes the visual viewport. `100vh` measures the *largest* viewport (URL bar hidden), so an element sized `height: 100vh` overflows the screen when the URL bar is shown — content is scrolled off.

- **`svh`** — small viewport height (URL bar shown, smallest viewport).
- **`lvh`** — large viewport height (URL bar hidden, largest viewport).
- **`dvh`** — dynamic viewport height (follows the current state, updates as URL bar shows/hides).

```css
.full-height {
  min-height: 100vh;  /* fallback */
  min-height: 100dvh; /* modern */
}
```

- Baseline since mid-2023. Safe to use with a `vh` fallback.
- `dvh` recalculates as the bar toggles — may trigger layout. For hero sections use `svh` or `lvh` depending on whether you want "always fits" or "fills when bar hidden."
- **Recommendation**: `100svh` for "always fully visible" hero; `100dvh` if you want it to fill the whole screen when the user scrolls and the bar hides.

Reference: https://web.dev/blog/viewport-units

### Horizontal scroll bugs

Usually caused by:

- An element wider than its container (fixed widths, large images without `max-width: 100%`, non-wrapping text).
- `width: 100vw` on a child of a padded container — `100vw` includes the scrollbar, so it overflows.
- Long unbreakable text (URLs, code) — use `overflow-wrap: anywhere` or `word-break: break-word`.
- Absolute-positioned elements with negative margins going off-screen.

Debugging recipe:

```css
/* Find the culprit fast */
* { outline: 1px solid red; }
/* or */
body * { max-width: 100%; }  /* often fixes without finding */
```

Permanent fix:

```css
html, body { overflow-x: clip; }  /* clip, not hidden, so position: sticky still works */
img, video, svg { max-width: 100%; height: auto; }
```

### Hydration mismatches from viewport-sensitive SSR

If your server renders one tree and the client renders a different tree because of viewport detection, React will warn (React 19) or silently produce inconsistent output. Symptoms: layout flash, console warnings, interaction bugs.

**Don't**: read `window.innerWidth` in the initial render.
**Don't**: read `window.matchMedia('(min-width: 768px)').matches` in component initial state.
**Do**: render layout that works at all viewports via CSS, then upgrade with JS after hydration.
**Do**: use `useSyncExternalStore` for viewport state that must live in JS (see §8).

### CLS from late-loading responsive images

- Always set `width` and `height` attributes (or `aspect-ratio` in CSS).
- Reserve space for ads, embeds, third-party widgets with `min-height`.
- Use `font-display: optional` or `swap` + `size-adjust` in `@font-face` to reduce FOIT/FOUT layout shift.
- Lazy-loaded images **below** the fold are fine; lazy-loading above-the-fold images causes LCP regression.

### Touch target sizes

- **WCAG 2.2 SC 2.5.8 Target Size (Minimum), Level AA**: target size at least **24×24 CSS pixels**, unless exceptions apply (inline targets in a sentence, user-agent controls, essential size, spacing-based exception where there's 24px of clear space around it).
- **WCAG 2.2 SC 2.5.5 Target Size (Enhanced), Level AAA**: at least **44×44 CSS pixels**.
- **Apple HIG**: 44×44 pt. **Material Design**: 48×48 dp.

For S/NC: target 44×44 where layout allows; hit 24×24 as a hard floor.

```css
.icon-button {
  min-width: 2.75rem;  /* 44px */
  min-height: 2.75rem;
  /* visible icon can be smaller; use padding to hit the target */
}
```

Reference: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

### Hover media queries

Don't assume hover works. Touch devices have no hover, and hover-based interactions trap them.

```css
@media (hover: hover) and (pointer: fine) {
  .card:hover { transform: translateY(-4px); }
}
```

- **`hover: hover`** — primary input supports hover (mouse, trackpad).
- **`hover: none`** — primary input doesn't (touch, stylus).
- **`pointer: fine`** — fine pointer (mouse). `coarse` = finger.
- **`any-hover`** / **`any-pointer`** — considers all input devices, not just primary.

Use `hover: hover` gate for all hover-reveal interactions, menu hover-opens, and hover-only affordances.

### `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- Respect it for animations, parallax, auto-playing video/carousels.
- **Don't disable all transitions** — small UI transitions (color, opacity <200ms) are fine and help orientation. Disable *motion* — translate, scale, rotate, parallax, scroll-linked animations.

### Other honorable mentions

- **`prefers-color-scheme`** for dark mode defaults.
- **`prefers-contrast`** for high-contrast theming.
- **`forced-colors`** (Windows High Contrast Mode) — test that your UI remains usable when OS colors are forced.
- **`prefers-reduced-data`** (experimental) — serve lighter assets to users on metered connections.

References:
- MDN Media Queries Level 5: https://developer.mozilla.org/en-US/docs/Web/CSS/@media
- web.dev "New responsive": https://web.dev/articles/new-responsive
- WCAG 2.2 (full): https://www.w3.org/TR/WCAG22/

---

## 8. TanStack Start / SSR Specifics

### The fundamental constraint

On the server, there is no viewport. You cannot measure window width, device pixel ratio, or input modality. Any component that branches on viewport state during SSR will:

1. Render the wrong layout on the server based on a guess (or a default).
2. Re-render differently on the client after hydration.
3. Trigger React 19 hydration warnings and a visual flash.

### Four strategies (ordered best → worst)

#### 1. CSS-only responsive (default, recommended)

Render the same DOM on server and client. Use CSS media/container queries to adapt layout. Zero hydration risk, zero JS cost.

```tsx
// Same markup, server and client. CSS decides layout.
<div className={styles.grid}>
  <aside className={styles.sidebar}>…</aside>
  <main className={styles.main}>…</main>
</div>
```
```css
.grid { display: block; }
@media (min-width: 1024px) {
  .grid { display: grid; grid-template-columns: 280px 1fr; }
}
```

**Use this unless you have a reason not to.** Probably 95% of responsive behavior.

#### 2. User-Agent hinting with Client Hints (occasionally)

Modern Client Hints (`Sec-CH-UA-*`, `Sec-CH-Viewport-Width`, `Sec-CH-DPR`) let the server get hints about the client. `Viewport-Width` Client Hint is deprecated/gone in Chromium, but you can still get DPR and device mobile/desktop hints.

- **`Sec-CH-UA-Mobile`**: `?1` for mobile, `?0` for not-mobile. Reliable and cheap.
- Use this only to **seed** the initial render to "mobile" vs "desktop" default — client still does the final layout with CSS.
- Don't over-rely: a mobile phone in landscape on a tablet-sized viewport is still "mobile" per UA hint.

Client Hints docs: https://developer.mozilla.org/en-US/docs/Web/HTTP/Client_hints

#### 3. Client-only responsive (for JS-driven behavior)

Some things genuinely need JS: opening a Drawer on mobile vs inline Panel on desktop, different navigation components, virtualized list dimensions. Render a safe default server-side, swap on the client after mount.

```tsx
import { useSyncExternalStore } from 'react';

const subscribe = (cb: () => void) => {
  const mql = window.matchMedia('(min-width: 1024px)');
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
};

const getSnapshot = () => window.matchMedia('(min-width: 1024px)').matches;
const getServerSnapshot = () => false; // SSR default: mobile

export function useIsDesktop() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
```

Key points:

- **`getServerSnapshot` returns a stable default** (e.g. `false` = mobile-first) — same on server and on first client render.
- **After hydration**, the store updates with the real value and the component re-renders.
- **There will be one extra render** on the client when the value differs. That's the price.
- **Render fallbacks carefully**: the initial-render tree (mobile) must be valid HTML without the desktop component. Don't conditionally render a `<table>` vs a `<div>` — wrap both in the same shell.

To avoid the visual flash, pair with CSS: render both components, hide one via CSS until JS confirms, then the JS can swap to a cheaper tree.

```tsx
// Render both, let CSS show the right one. Optionally prune on client.
<>
  <div className={styles.desktopOnly}><DesktopNav /></div>
  <div className={styles.mobileOnly}><MobileNav /></div>
</>
```
```css
.desktopOnly { display: none; }
.mobileOnly { display: block; }
@media (min-width: 1024px) {
  .desktopOnly { display: block; }
  .mobileOnly { display: none; }
}
```

This "render both, hide one" pattern doubles the DOM but eliminates the hydration flash. For most components that's fine. For very heavy components (complex navigation trees, rich tables), use `useSyncExternalStore` and accept the one-frame flash — or render the cheap one eagerly and lazy-render the expensive one after mount.

#### 4. User-Agent sniffing (last resort)

Parse `navigator.userAgent` / `req.headers['user-agent']` and branch. Brittle, wrong for tablets in desktop mode, wrong for resized desktop windows. Only use for truly coarse decisions (e.g. "deliver a different bundle entirely to known mobile crawlers").

### TanStack Start specifics

- **`createServerFn`** / loaders run on the server — don't read viewport state there.
- **`createFileRoute` loaders** are fine for data; keep layout decisions in components.
- **`ssr: true`** is the default for TanStack Start; components render on server, then hydrate.
- **Hydration mismatches** show up as React warnings and as visual flash. React 19's hydration errors are more informative — read them, don't suppress.
- Use `useSyncExternalStore` (not `useEffect` + `useState`) for viewport state that feeds layout — it integrates with React 19's concurrent rendering correctly and avoids the "two-render dance" of effect-based viewport hooks.

### Avoiding hydration flashes

Summary rules:

1. **First paint = server render**: make it work at every viewport via CSS.
2. **Never branch layout on `window.*` during initial render.**
3. **For JS-driven adaptivity**, use `useSyncExternalStore` with a `getServerSnapshot` that returns a sensible default; accept one post-hydration re-render; pair with CSS hiding if the visual flash matters.
4. **Avoid `suppressHydrationWarning`** — it masks real bugs.
5. **Test hydration**: throttle CPU in DevTools, hard-refresh, watch for flash. Use Playwright with slow network + CPU to catch flashes in CI.

References:
- React `useSyncExternalStore`: https://react.dev/reference/react/useSyncExternalStore
- Josh Comeau, "The Perils of Rehydration": https://www.joshwcomeau.com/react/the-perils-of-rehydration/
- TanStack Start docs (SSR): https://tanstack.com/start/latest
- web.dev Client Hints: https://developer.chrome.com/docs/privacy-security/user-agent-client-hints

---

## 9. Testing Responsive

### Playwright viewport testing

Playwright has built-in viewport and device emulation. Use it as the backbone of responsive testing.

```ts
// playwright.config.ts
export default defineConfig({
  projects: [
    { name: 'mobile', use: { ...devices['iPhone 14'] } },
    { name: 'tablet', use: { ...devices['iPad Pro 11'] } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'wide',    use: { viewport: { width: 1920, height: 1080 } } },
  ],
});
```

- **Run the same test across all viewports** for critical user journeys (sign-in, nav, primary CTAs).
- **Viewport-specific tests** for layout assertions (nav is drawer below 1024, inline above).
- **Assertion helpers**: `expect(locator).toBeVisible()`, `expect(page).toHaveScreenshot()`.

Docs: https://playwright.dev/docs/emulation

### Visual regression

- **Playwright's built-in `toHaveScreenshot()`** — per-viewport snapshots, diffed pixel-by-pixel. Baseline committed, CI flags diffs.
- **Third-party**: Percy, Chromatic (for Storybook), Argos. Worth it for design-system work; overkill for small teams.
- **Tune diff threshold** to avoid font-rendering flakes between OS versions. Keep visual tests on a single headless-chromium version for stability.

### Manual device testing

Emulators are not devices. You need real devices for:

- **Touch target accuracy** — is the button actually tappable with a thumb while holding the phone?
- **Scroll performance** — emulator can't tell you if scrolling a complex layout is jank.
- **URL bar / safe areas** — the real mobile browser bars behave differently than emulators.
- **iOS Safari quirks** — Safari has unique bugs (form zoom, 100vh, sticky, backdrop-filter, font loading). Test on at least one real iOS device.
- **Low-end Android** — CPU-throttled DevTools ≠ actual Android budget phone. Keep an old Pixel around.

Recommended device lab minimum:

- One recent iPhone (iOS Safari)
- One budget Android (performance reality check)
- One iPad (tablet layouts)
- Your main desktop browser + one secondary

For distributed teams without a device lab: BrowserStack, LambdaTest, or Sauce Labs. They're slower than local but better than no real-device testing.

### Chrome DevTools device emulation limitations

- **Not real devices**: emulates viewport, touch events, UA string. Does not emulate GPU, real browser engine (always Chromium, even "iPhone"), font rendering, real network stack, or actual device quirks.
- **Touch emulation is partial**: no multi-touch gestures, no pressure.
- **Safari iOS-specific bugs won't show up**. Ever. Always test on real iOS for Safari-specific responsive issues.
- **What it's good for**: quick iteration on breakpoint transitions, checking layout at arbitrary widths, checking DPI-sensitive images.

### Automated responsive checks to add to CI

- **Visual regression at 3-4 viewports** for key pages.
- **Lighthouse CI** at mobile emulation — catches mobile perf regressions.
- **Axe-core / Playwright accessibility tests** per viewport — touch target size, contrast.
- **Viewport-width smoke tests**: "at 320px, is there any horizontal scroll?" is a trivial Playwright assertion that catches a surprising number of bugs.

```ts
test('no horizontal scroll at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});
```

References:
- Playwright emulation: https://playwright.dev/docs/emulation
- Playwright visual comparisons: https://playwright.dev/docs/test-snapshots
- Google Lighthouse CI: https://github.com/GoogleChrome/lighthouse-ci

---

## 10. Resources

### Authoritative specs & MDN

- MDN CSS Media Queries: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_media_queries
- MDN Responsive Design: https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Responsive_Design
- MDN Container Queries: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries
- MDN `clamp()`: https://developer.mozilla.org/en-US/docs/Web/CSS/clamp
- MDN `aspect-ratio`: https://developer.mozilla.org/en-US/docs/Web/CSS/aspect-ratio
- MDN Viewport units (`dvh`/`svh`/`lvh`): https://developer.mozilla.org/en-US/docs/Web/CSS/length#viewport-percentage_lengths
- W3C CSS Containment Level 3: https://www.w3.org/TR/css-contain-3/
- W3C Media Queries Level 5: https://www.w3.org/TR/mediaqueries-5/
- WCAG 2.2: https://www.w3.org/TR/WCAG22/

### web.dev / developer.chrome.com

- "A new responsive": https://web.dev/articles/new-responsive
- "Serve responsive images": https://web.dev/articles/serve-responsive-images
- "Container queries, style queries, and state queries": https://developer.chrome.com/blog/has-with-cq-m105
- "Viewport units": https://web.dev/blog/viewport-units
- "The large, small, and dynamic viewport units": https://web.dev/blog/viewport-units
- "Optimize Largest Contentful Paint": https://web.dev/articles/optimize-lcp
- "Optimize Cumulative Layout Shift": https://web.dev/articles/optimize-cls

### Key articles / authors

- Andy Bell, "A (more) Modern CSS Reset": https://andy-bell.co.uk/a-more-modern-css-reset/
- Andy Bell & Heydon Pickering, *Every Layout*: https://every-layout.dev/ — intrinsic layout patterns, still the best book-length treatment.
- Ahmad Shadeed: https://ishadeed.com/ — essentially a free course on modern CSS responsive design. See especially "Defensive CSS" and container query articles.
- Utopia (Trys Mudford, James Gilyead): https://utopia.fyi/ — fluid type/space calculators + reasoning.
- Miriam Suzanne: https://www.miriamsuzanne.com/ — CSS spec editor, container queries originator.
- Adrian Roselli: https://adrianroselli.com/ — accessibility + responsive. Essential for WCAG compliance.
- Josh W. Comeau: https://www.joshwcomeau.com/ — React + CSS. See "The Perils of Rehydration" for SSR.
- Rachel Andrew: https://rachelandrew.co.uk/ — CSS Grid and layout systems.
- Jen Simmons (Apple, WebKit): https://jensimmons.com/ — intrinsic web design talks.

### Books (recommended)

- Andy Bell & Heydon Pickering, *Every Layout* (2020, updated) — intrinsic patterns
- Rachel Andrew, *The New CSS Layout* (A Book Apart)
- Luke Wroblewski, *Mobile First* (A Book Apart) — still the argument
- Adam Silver, *Form Design Patterns* — responsive forms specifically

### Tools

- Utopia: https://utopia.fyi/
- Modern Font Stacks: https://modernfontstacks.com/
- Open Props (CSS custom property system): https://open-props.style/
- Can I Use: https://caniuse.com/
- Baseline (web-platform-dx): https://web-platform-dx.github.io/web-features/
- Playwright: https://playwright.dev/

### S/NC-specific follow-ups

- Decide breakpoint token strategy (simple hard-code path vs postcss-custom-media) — §5
- Choose image pipeline (Cloudflare Image Resizing vs self-hosted imgproxy on Garage) — §6
- Codify viewport-adaptive component pattern (CSS-only vs `useSyncExternalStore`) for the design system — §8
- Add Playwright viewport smoke tests to CI — §9
- Audit Ark UI components for touch target sizes out of the box — §7

