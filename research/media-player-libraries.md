# Media Player Libraries — Evaluation (March 2026)

Evaluated for the S/NC web platform (React 19 + TypeScript + TanStack Start). Decision context: replacing a bare HTML5 `<video>` element with a full-featured player that supports buffering indicators, keyboard navigation, accessibility, and eventually HLS/DASH adaptive streaming.

## The Mux Consolidation

The media player library landscape has consolidated under Mux ($175M+ VC-backed video infrastructure company). The creators of Plyr and Vidstack both now work at Mux, and are jointly building Video.js v10 — a ground-up rewrite that absorbs Media Chrome's web component architecture.

- **Sam Potts** (Plyr creator) → now at Mux
- **Rahim Alwer** (Vidstack creator) → now at Mux, lead architect of Video.js v10
- **Media Chrome** → Mux project, being absorbed into Video.js v10
- **Video.js v10** → convergence target, beta (GA expected mid-2026)

This means all viable options in this space have some connection to Mux. There is no fully community-governed media player library.

## Technical Comparison

| Dimension | Vidstack | Plyr | Media Chrome | Video.js v8 | Video.js v10 |
|-----------|----------|------|-------------|-------------|-------------|
| **License** | MIT | MIT | MIT | Apache 2.0 | Apache 2.0 |
| **Bundle (gzip)** | ~53 kB (tree-shakeable) | ~7 kB | ~15-20 kB | ~195 kB | <5 kB min |
| **React support** | Native (hooks, RSC) | Wrapper (plyr-react) | Web Component wrappers | Wrapper | Native hooks |
| **TypeScript** | First-class | Community @types | Partial (WC limits) | Community @types | First-class |
| **HLS/DASH** | Built-in (lazy-loaded) | External | Depends on `<video>` | Built-in | Built-in |
| **Accessibility** | WCAG 2.2, WAI-ARIA, CVAA | Semantic HTML, SR | ARIA, keyboard | Good | Designed for a11y |
| **Audio + Video** | Yes | Yes | Yes | Yes | Yes |
| **PiP** | Yes | Yes | Yes | Yes | Yes |
| **Buffer indicator** | Yes | Yes | Yes | Yes | Yes |
| **Keyboard shortcuts** | Yes (customizable) | Yes | Partial | Yes | Yes |
| **Status** | Active | Deprecated | Transitioning | Stable (legacy) | Beta |

## Governance & Values Assessment

| Dimension | Vidstack | Plyr | Media Chrome | Video.js |
|-----------|----------|------|-------------|----------|
| **Maintained by** | Rahim Alwer (at Mux) | Sam Potts (at Mux) | Mux | Mux + Technical Steering Committee |
| **Funding** | Indie → Mux employee | Indie → Mux employee | Mux corporate | Mux stewardship |
| **VC involvement** | Indirect | Indirect | Direct | Direct but TSC-governed |
| **Abandonment risk** | Low near-term, medium long-term | HIGH (deprecated) | Medium (being absorbed) | Low (15-year track record) |
| **Enshittification risk** | Medium (single maintainer) | N/A | Medium-high | Low-medium (TSC + Apache 2.0) |

### Cooperative Values Lens

No option is fully aligned with cooperative governance principles. However:

- **MIT and Apache 2.0 licenses** protect forking rights — if any library becomes hostile, the community can fork
- **Video.js v10's Technical Steering Committee** with public RFC process is the closest to cooperative-style governance in this space
- **Vidstack** is MIT-licensed and the codebase is clean enough to fork if needed, but it's effectively a single-maintainer project (Rahim Alwer)
- The consolidation under Mux is a concentration-of-power concern, but Mux's business model (video infrastructure APIs) doesn't directly conflict with an open-source player — the player drives adoption of their paid services

## Eliminated Options

- **Plyr** — Deprecated. Creator has moved on to Video.js v10. Will be archived.
- **Media Chrome** — Being absorbed into Video.js v10. Adopting it now means an inevitable migration.
- **Video.js v8** — Large bundle (~195KB), poor React/TypeScript integration, superseded by v10.

## Decision

**Adopt Vidstack now.** Best React 19 + TypeScript integration available today. Native hooks (not DOM wrappers), WCAG 2.2 accessible, built-in HLS/DASH (lazy-loaded), MIT license.

**Watch Video.js v10.** When it reaches GA (mid-2026), evaluate migration. Same lead architect (Rahim Alwer) means API patterns may be similar. Stronger governance (TSC + Apache 2.0) better aligns with cooperative values.

## References

- Vidstack: https://vidstack.io
- Video.js: https://videojs.com
- Plyr: https://plyr.io
- Media Chrome: https://media-chrome.org
