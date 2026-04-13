# Scan Rules Research: Performance & Accessibility — 2026-03-23

Research grounding for the `scan-performance` and `scan-accessibility` rule libraries added to `platform/.claude/skills/`. This doc captures authoritative sources and rationale so the rules aren't just opinions.

## Performance

### React 19 + React Compiler

React Compiler (v1.0) auto-memoizes at build time, analyzing dependency graphs and inserting optimizations without developer intervention. This means:

- `React.memo`, `useMemo`, `useCallback` are often redundant — the compiler stabilizes references automatically
- Inline function props are no longer a critical performance concern
- Manual memoization is still needed for third-party libraries with strict reference equality requirements

**Implication for rules**: We don't flag missing memoization. The scan focuses on patterns the compiler can't fix: N+1 queries, layout shift, loading strategy, bundle size.

Sources:
- React Compiler introduction — react.dev/learn/react-compiler/introduction
- React 19 memoization analysis — dev.to/joodi/react-19-memoization

### Core Web Vitals (LCP, INP, CLS)

Google's Core Web Vitals define the three metrics that matter for user experience and search ranking:

| Metric | Threshold | What it measures | Statically detectable patterns |
|--------|-----------|------------------|-------------------------------|
| **LCP** (Largest Contentful Paint) | < 2.5s | Time until largest visible element renders | Missing `loading="lazy"` on below-fold images, missing `fetchpriority="high"` on hero images, missing `<link rel="preconnect">` |
| **INP** (Interaction to Next Paint) | < 200ms | Latency between interaction and visual update | Long synchronous handlers, N+1 queries blocking response |
| **CLS** (Cumulative Layout Shift) | < 0.1 | Unexpected visual movement during load | Images without `width`/`height`, animations on layout properties (`width`, `height`, `margin` instead of `transform`/`opacity`) |

INP replaced FID in March 2024. Only 48% of mobile pages pass all three metrics (2025 Web Almanac).

Sources:
- Google Search Central: Core Web Vitals — developers.google.com/search/docs/appearance/core-web-vitals
- Core Web Vitals 2025 — corewebvitals.io/core-web-vitals
- Web Almanac performance chapter — almanac.httparchive.org

### Drizzle ORM Query Patterns

Drizzle supports relational queries via `with()` that compile to single SQL statements with JOINs, preventing N+1 patterns. The SNC platform currently uses mostly single-table queries — no `with()` relational loads found during exploration.

Key patterns:
- **N+1 prevention**: Use `with()` for relational loads instead of separate queries in loops
- **Column selection**: `.select({ col1, col2 })` reduces memory and network overhead vs. selecting all columns
- **Prepared statements**: `sql.placeholder()` for frequently-executed parameterized queries (not yet needed at current scale)
- **Partial indexes**: Can provide 275x improvement for filtered subsets (relevant when traffic grows)

Sources:
- Drizzle ORM PostgreSQL best practices — gist.github.com/productdevbook/7c9ce3bbeb96b3fabc3c7c2aa2abc717
- Drizzle performance optimization — medium.com/drizzle-stories/optimizing-drizzle-orm-for-performance

### TanStack Start SSR & Router Preloading

TanStack Start achieves 1,000 req/s with 13ms average latency when loaders run server-side. The platform already uses `loader` + `Route.useLoaderData()` correctly.

TanStack Router supports intent-based and viewport-based preloading:
- `defaultPreload: 'intent'` — 50ms-delayed preload on hover/touch
- `defaultPreload: 'viewport'` — Intersection Observer triggers on visibility
- Default cache eviction after 30s for unused preloaded data

The platform doesn't configure explicit preloading — advisory item only, not a scan finding.

Sources:
- TanStack Start 5x SSR throughput — tanstack.com/blog/tanstack-start-5x-ssr-throughput
- Selective SSR guide — tanstack.com/start/latest/docs/framework/react/guide/selective-ssr
- Router preloading — tanstack.com/router/v1/docs/framework/react/guide/preloading

### Hono API Performance

Hono's TrieRouter is heavily optimized (O(1) hasChildren, lazy regex generation). Key guidance:
- Write handlers directly alongside routes (not separate controller classes) — enables type inference
- Use `c.json()` fast path (skips Headers allocation when no custom status)
- Apply middleware narrowly, not globally

The platform already follows all these patterns.

Sources:
- Hono best practices — hono.dev/docs/guides/best-practices
- Hono benchmarks — hono.dev/docs/concepts/benchmarks

### Node.js Connection Pooling

Pool size formula: `connections = (core_count × 2) + effective_spindle_count`. For a 4-core machine with SSD: 4×2+1 = 9 connections. Typical Node.js app: 10-20 pool size.

The platform uses postgres.js defaults — acceptable for dev/early production. Advisory item only.

Sources:
- node-postgres pooling — node-postgres.com/features/pooling

## Accessibility

### WCAG 2.2 Standard

WCAG 2.2 (published October 5, 2023) is the current W3C Recommendation. Level AA is the standard target. Key additions over 2.1:
- SC 2.5.7 Dragging Movements (AA) — non-dragging alternatives required
- SC 3.3.8 Accessible Authentication (AA) — no cognitive function test required
- SC 4.1.1 Parsing removed (no longer required)

European Accessibility Act (EAA) is in force as of June 28, 2025. ADA Title II requires WCAG 2.1 Level AA for US government sites.

Sources:
- WCAG 2.2 — w3.org/TR/WCAG22/
- What's new in WCAG 2.2 — w3.org/WAI/standards-guidelines/wcag/new-in-22/

### WCAG Criteria Mapped to Scan Rules

| Scan rule | WCAG criterion | Level | Statically detectable? |
|-----------|---------------|-------|----------------------|
| `semantic-interactive` | 4.1.2 Name, Role, Value | A | YES — `<div onClick>` without role/native element |
| `image-alt-text` | 1.1.1 Non-text Content | A | YES — `<img>` without `alt` |
| `form-labels` | 1.3.1 Info and Relationships, 3.3.2 Labels | A | YES — input without `<label>`, `aria-label`, or `aria-labelledby` |
| `heading-hierarchy` | 1.3.1 Info and Relationships | A | PARTIAL — can detect level skips, not semantic grouping |
| `media-alternatives` | 1.2.1 Audio-only, 1.2.2 Captions | A | PARTIAL — can detect missing `<track>`, not caption quality |
| `keyboard-interaction` | 2.1.1 Keyboard | A | PARTIAL — can detect missing `onKeyDown`, not functional behavior |
| `route-announcements` | 2.4.3 Focus Order | A | YES — can detect absence of focus management code |

### Static vs. Runtime Detection

What a code scanner CAN detect:
- Missing alt text, form labels, ARIA attributes, `<track>` elements
- Incorrect ARIA roles, unsupported ARIA properties
- Heading level structure within and across files
- `tabIndex > 0` usage (bad for focus order)
- Interactive elements without semantic roles
- Absence of keyboard event handlers on custom widgets
- Missing focus management code after route transitions

What REQUIRES runtime/browser testing:
- Color contrast (WCAG 1.4.3) — CSS gradients, pseudo-elements, transparency, overlapping elements
- Actual keyboard navigation (functional testing, not just handler presence)
- Focus order (logical tab sequence requires rendering and tabbing)
- Focus visibility (CSS `:focus-visible` presence ≠ visual visibility)
- Screen reader announcements (ARIA live region effectiveness)
- Caption quality and synchronization

Sources:
- WAI-ARIA Authoring Practices Guide — w3.org/WAI/ARIA/apg/
- Understanding SC 1.4.3 Contrast — w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
- OWASP Static Code Analysis — owasp.org/www-community/controls/Static_Code_Analysis

### jsx-a11y ESLint Plugin Coverage

The jsx-a11y plugin (already in the platform's ESLint config) catches:
- Missing alt text on images
- `tabIndex > 0` (bad for focus order)
- Interactive elements without roles (`<div onClick>` without `role="button"`)
- Unsupported ARIA properties

It does NOT catch:
- Heading hierarchy across files (route-level heading structure)
- Media alternatives (audio transcripts, video captions — only flags missing caption)
- Route transition focus management
- Keyboard interaction patterns per WAI-ARIA APG (widget-specific key bindings)
- Cross-component accessibility patterns

The scan rules complement jsx-a11y by checking architectural patterns that a per-file linter can't see.

Sources:
- jsx-a11y ESLint plugin — github.com/jsx-eslint/eslint-plugin-jsx-a11y

### WAI-ARIA Keyboard Patterns

The W3C ARIA Authoring Practices Guide defines required keyboard interactions per widget type:

| Widget | Tab | Arrow keys | Enter/Space | Escape |
|--------|-----|-----------|-------------|--------|
| Menu button | In/out of widget | Navigate items | Activate | Close menu |
| Dialog/Modal | Trapped inside | — | — | Close dialog |
| Tab list | Between tabs | Adjacent tabs | Activate panel | — |
| Combobox | To control | Navigate list | Select item | Close popup |

Key principle: Tab/Shift+Tab moves focus in and out of widgets. Arrow keys handle internal navigation. This keeps tab order short while allowing detailed navigation within complex widgets.

Sources:
- Keyboard interface — w3.org/WAI/ARIA/apg/practices/keyboard-interface/
- APG patterns — w3.org/WAI/ARIA/apg/patterns/

### TanStack Router Focus Management Gap

TanStack Router does NOT automatically handle focus management or route announcements on client-side navigation. This is a known open issue (#918). When a user navigates, focus stays where it was or gets lost — screen reader users receive no feedback.

Required implementation:
1. Detect route changes via router subscription
2. Move focus programmatically to the new page's `<h1>` or `<main>`
3. Optionally announce the page title via an `aria-live="polite"` region

This is an architectural gap that affects every route — flagged as a medium-confidence Analyze item.

Sources:
- TanStack Router issue #918 — github.com/TanStack/router/issues/918

### Media Accessibility Requirements

| Content type | WCAG requirement | Criterion | Implementation |
|-------------|-----------------|-----------|----------------|
| Pre-recorded video | Synchronized captions | 1.2.2 (A) | `<track kind="captions" src="...vtt">` |
| Pre-recorded video | Audio description OR transcript | 1.2.3 (A) | `<track kind="descriptions">` or linked transcript |
| Pre-recorded audio | Transcript | 1.2.1 (A) | Linked text transcript (no `<track>` for audio-only) |

WebVTT is the standard format. `kind="captions"` includes dialogue + sound cues (required). `kind="subtitles"` is translation only (not sufficient for WCAG).

The platform's audio player has `eslint-disable-next-line jsx-a11y/media-has-caption` — acknowledging the gap. Video player has no `<track>` element.

Sources:
- Making media accessible — w3.org/WAI/media/av/
- Video accessibility guide — swarmify.com/blog/video-accessibility-captions-wcag/

## Rule Selection Rationale

### Why these performance categories

| Category | Justification | What we excluded and why |
|----------|--------------|------------------------|
| Query efficiency | N+1 is the most common API perf bug; Drizzle `with()` prevents it | General `Promise.all` — already covered by `concurrent-awaits` in scan-stylistic |
| Layout stability (CLS) | Directly impacts Core Web Vital score; statically detectable | Runtime layout measurement — needs browser DevTools |
| Loading strategy (LCP) | Directly impacts Core Web Vital score; statically detectable | Actual load time measurement — needs Lighthouse |
| Bundle awareness | zod/mini convention exists; drift is a real risk | Bundle size analysis — needs build tooling |
| Data efficiency | Over-fetching wastes bandwidth; detectable from query code | Response payload analysis — needs runtime |

### Why these accessibility rules

| Rule | Justification | What we excluded and why |
|------|--------------|------------------------|
| semantic-interactive | WCAG 4.1.2 (A); jsx-a11y catches some but scan provides tracked remediation | — |
| image-alt-text | WCAG 1.1.1 (A); fundamental requirement | — |
| form-labels | WCAG 1.3.1 + 3.3.2 (A); critical for screen readers | — |
| heading-hierarchy | WCAG 1.3.1 (A); jsx-a11y can't check across route files | — |
| media-alternatives | WCAG 1.2.1 + 1.2.2 (A); known gap in codebase | — |
| keyboard-interaction | WCAG 2.1.1 (A); WAI-ARIA APG defines patterns | Functional keyboard testing — needs runtime |
| route-announcements | WCAG 2.4.3 (A); TanStack Router gap (issue #918) | Focus order validation — needs runtime tabbing |

### What we didn't include

| Excluded | Why |
|----------|-----|
| Color contrast (1.4.3) | Requires runtime rendering; CSS vars and gradients defeat static analysis |
| Focus order (2.4.3) | Requires runtime tabbing; `tabIndex > 0` already caught by jsx-a11y |
| Focus-visible CSS | Already well-covered in global.css and component modules |
| Skip-to-content | Already implemented in `__root.tsx` |
| `lang` attribute | Already present on `<html>` in `__root.tsx` |
| React.memo cleanup | React 19 Compiler handles this automatically |
| TanStack Router preloading | Advisory only; no concrete performance issue yet |
