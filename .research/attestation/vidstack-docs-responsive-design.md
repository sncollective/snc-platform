---
source_handle: vidstack-docs-responsive-design
fetched: 2026-06-14
source_url: https://www.vidstack.io/docs/player/styling/responsive-design
provenance: source-direct
---

## Paraphrase

Official Vidstack docs page on responsive design for the player. Addresses layout-shift prevention and recommends container queries over media queries.

## Key passages

**Layout shifts:** docs reference "avoiding layout shifts" as a critical consideration — players should be sized to prevent jumping between default and intrinsic sizes as content loads.

**Container queries recommendation:** "The documentation **strongly recommends CSS Container Queries over traditional media queries** for media player styling. Container queries allow styles to adapt based on the **player container's dimensions** rather than viewport size — essential for scenarios involving: Dynamic size/layout adaptation; Variable view types; Different stream types."

**Layout options** mentioned:
- Default Layout (`/docs/player/components/layouts/default-layout`)
- Plyr Layout (`/docs/player/components/layouts/plyr-layout`)
- Custom layouts (for granular control)

**No specific CSS code examples** for sizing or aspect ratio were returned in the fetched content. The page acknowledges sizing guidance exists but the code blocks were not returned.

## Gaps

No explicit CSS property names, sizing code examples, or aspect-ratio override patterns were returned from this page fetch. The `aspectRatio` prop is documented at the MediaPlayer API reference page, not here.

## Structure

Styling section of the docs. URL: `/docs/player/styling/responsive-design`.
