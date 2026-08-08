---
id: creator-press-page-v2-templates
kind: feature
stage: done
tags: [creators, content, ui]
parent: creator-press-page-v2
depends_on: [creator-press-page-v2-content-model, creator-press-page-v2-image-management]
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-07
---

# Press page v2 — templates (A + B + selector)

## Brief
The public press-page rendering layer, per the locked design. Two selectable
templates: **Template A — Clean editorial** (single-column; members WITH bios)
and **Template B — Two-column zone** (denser; members names-only; three
highlights). A `template` selector renders the chosen one. Both share the locked
layout: text-on-image header (wordmark aligned to the article column, full-bleed
3:1 banner) → About (deck+body bio, no toggle) + For-fans-of → Members →
Highlights (cover art) → Live dates → Listen (streaming-service **icon buttons**)
→ Gallery (**carousel**, at the bottom) → Footer (press email + Download PDF).

Live dates: render the list; the Bandsintown **data source** is the separate
`bandsintown-integration` epic — until it lands, link out to Bandsintown.

## Epic context
- Parent epic: `creator-press-page-v2`
- Position: consumer of the content model; the PDF feature reuses this rendering.

## Simplification opportunity
- Replaces the v1 single hardcoded layout with the selectable template system
  (the `template` selector is the seam for future templates — this ships A + B).

## Foundation references
- v1 page: `apps/web/src/routes/creators/$creatorId/press.tsx`
- `.mockups/design-system/tokens.css`

## Mockups
- **LOCKED** — `.mockups/screens/creator-press-page/final-1.html` (Template A),
  `final-3.html` (Template B), `final-index.html` (comparison). Signed off
  2026-08-07. Implement to these references.

## Visual grounding

The locked HTML was rendered and visually inspected at 1440px desktop and
390px mobile before this design was written. Both templates keep the 980px
article/wordmark column centered, preserve the full-width 3:1 hero, collapse the
about float and highlight grid cleanly, retain a two-up member grid on mobile,
and show a partially peeking next gallery slide without horizontal page
overflow. Template B's elevated mid-zone remains balanced as a two-column spread
on desktop and stacks as one column below 820px. The icon row, carousel arrows,
fixed PDF action, section rhythm, and dark token palette match the locked
references.

The visual pass was paired with source checks for the load-bearing literal and
interaction details: both final templates contain exactly
`mailto:press@s-nc.org` / `press@s-nc.org` (never `press@snc.org`), the five
locked brand symbols (Spotify, Apple Music, Amazon Music, YouTube, Bandcamp),
`translate3d`, ArrowLeft/ArrowRight keyboard handling, and the 3:1 / 4:5 / 1:1 /
4:3 slot ratios.

## Architectural options

### Option 1 — fully independent template trees

Give A and B complete copies of every section and all responsive/print CSS. This
makes pixel tuning locally obvious and prevents a shared abstraction from
constraining either composition, but duplicates semantics, accessibility,
streaming-service behavior, image handling, empty-state behavior, and future
Bandsintown/PDF fixes.

### Option 2 — shared semantic sections with explicit template composition shells

Build one semantic renderer for each repeated section and two thin template
components that determine order, count limits, and layout. A and B own their
layout CSS; shared sections own their own CSS and behavior. A renders Members
and Highlights as separate sections; B places those same item renderers in its
mid-zone and intentionally suppresses member bios. This concentrates contracts
and a11y while leaving the visible layouts genuinely distinct.

### Option 3 — schema-driven template DSL

Represent templates as configuration (`sections`, `columns`, `limits`,
`variants`) interpreted by one generic renderer. This makes adding a hypothetical
Template C cheap, but turns two locked templates into a premature page-builder
system, makes print CSS indirect, and obscures the exact markup needed for visual
fidelity.

## Architectural choice

**Choose Option 2: shared semantic sections with explicit A/B composition
shells.** It is the smallest architecture that gives each locked template direct
control over composition while keeping image delivery, credits, icons, empty
states, links, carousel behavior, and accessibility single-sourced. Option 1
would make fixes drift; Option 3 spends complexity on templates that do not yet
exist.

The image seam is server-resolved. `buildPressImageUrl` signs imgproxy paths and
therefore must not enter the browser bundle. The public Hono press response gains
a narrow delivered-image projection: an API adapter calls image-management's
exact `buildPressImageUrl(image, slot, width)` helper for every non-null image,
then attaches `{src, srcSet, sizes}` to the `PressImage` metadata. React renders
those already-resolved values. This feature consumes image-management's optional
`crop` and helper without duplicating crop arithmetic or exposing signing
secrets. The feature now depends on image-management for that compile-time seam;
its design can proceed in parallel, but the public route must not flip before the
helper lands.

## Design decisions

- **Template selection**: use an exhaustive typed registry keyed by
  `content.template`; A and B are real components, not a CSS class toggle.
- **Visible item counts**: Template A renders the first two ordered highlights;
  Template B renders the first three. Both render all members, but B omits member
  bios. These limits are part of the locked composition rather than inferred
  from viewport size.
- **Missing images**: never render a broken `<img>` or public placeholder card.
  A missing banner leaves the same 3:1 gradient hero and wordmark; missing about,
  member, and cover images collapse their media wrappers; an empty gallery omits
  the gallery section. Text reflows into the vacated space.
- **Credits**: preserve `credit` verbatim. About uses an ordinary `figcaption` as
  in the mockup; banner/member/cover/gallery media use a subtle burn-in
  `figcaption` overlay that remains visible in print. No credit is synthesized.
- **Long biography**: split blank-line-delimited paragraphs into semantic `<p>`
  elements; preserve single newlines as whitespace inside a paragraph rather
  than injecting HTML.
- **Live dates**: the shared section accepts an optional presentation-only date
  list and renders the locked rows when supplied. This feature passes no rows and
  renders only the `liveDatesUrl` Bandsintown link-out until the parked integration
  supplies data.
- **Streaming service**: resolve `link.service ?? inferService(link.url)` and map
  every enum member to one typed icon registry. The five locked services copy the
  exact mockup SVG paths; SoundCloud and Tidal receive their brand glyphs;
  `website` receives a generic globe/link glyph. The visible label remains the
  creator-authored `link.label`.
- **Outbound links**: streaming, highlight, Bandsintown, and ticket links open a
  new tab with `rel="noopener noreferrer"`; mail and PDF links stay in the current
  context. Highlight cards become links only when `url` exists, without nested
  interactive elements.
- **PDF URL**: retain `/api/creators/:id/press/one-pager.pdf`. The later v2 PDF
  feature changes what that endpoint produces, not the public link contract.
- **Dependency safety**: no `@tanstack/start-*` resolutions or individual family
  pins are introduced.

## Implementation Units

### Unit 1: Public press-image delivery projection

**Story**: `creator-press-page-v2-templates-image-projection`

**Files**:
- `packages/shared/src/press.ts`
- `apps/api/src/lib/press-url.ts` (new)
- `apps/api/src/routes/press.routes.ts`
- `apps/api/tests/unit/lib/press-url.test.ts` (new)
- `apps/api/tests/routes/press.test.ts`

```ts
// Owned by image-management; consumed here without alteration.
type PressImageSlot = {
  banner: "3/1";
  about: "4/5";
  member: "1/1";
  gallery: "4/3";
  cover: "1/1";
};

declare function buildPressImageUrl(
  image: PressImage,
  slot: keyof PressImageSlot,
  width: number,
): { src: string; srcSet: string; sizes: string };

export interface PressImageDelivery {
  readonly src: string;
  readonly srcSet: string;
  readonly sizes: string;
}

export type DeliveredPressImage = PressImage & PressImageDelivery;

export interface DeliveredPressContent
  extends Omit<PressContent,
    "banner" | "aboutPhoto" | "members" | "highlights" | "gallery"> {
  readonly banner?: DeliveredPressImage | null;
  readonly aboutPhoto?: DeliveredPressImage | null;
  readonly members: readonly (Omit<PressMember, "photo"> & {
    readonly photo?: DeliveredPressImage | null;
  })[];
  readonly highlights: readonly (Omit<PressHighlight, "coverArt"> & {
    readonly coverArt?: DeliveredPressImage | null;
  })[];
  readonly gallery: readonly DeliveredPressImage[];
}

export const resolvePressPageContent = (
  content: PressContent,
): DeliveredPressContent;
```

`PressPagePayloadSchema.content` becomes the delivered public shape while
`PressContentSchema` remains the editable/persisted contract. The adapter uses
one private function:

```ts
const deliver = (
  image: PressImage | null | undefined,
  slot: keyof PressImageSlot,
  width: number,
): DeliveredPressImage | null =>
  image ? { ...image, ...buildPressImageUrl(image, slot, width) } : null;
```

Call it with `banner/1920`, `about/720`, `member/480`, `cover/480`, and
`gallery/960`. The helper owns output height, center-fill versus persisted crop,
srcSet widths, and `sizes`; this adapter must not reconstruct any imgproxy
segment. Preserve input ordering and nullability. The public GET route resolves
content once after `getEnabledPressContent`; manage routes still return raw
`PressContent`.

**Acceptance Criteria**:
- [ ] Every non-null press image is delivered through the exact matching slot;
  the optional `crop`, required `alt`, and optional `credit` survive unchanged.
- [ ] Null/absent images do not call the helper and remain null; empty arrays stay
  empty.
- [ ] The public payload validates through its OpenAPI/Zod response schema, while
  manage GET/PATCH continue using raw `PressContent`.
- [ ] No imgproxy signing/crop code or storage-key URL construction enters
  `apps/web`.

---

### Unit 2: Shared semantic sections and streaming icon registry

**Story**: `creator-press-page-v2-templates-shared-sections-and-icons`

**Files**:
- `apps/web/src/components/press/press-types.ts` (new)
- `apps/web/src/components/press/press-image.tsx` (new)
- `apps/web/src/components/press/press-image.module.css` (new)
- `apps/web/src/components/press/press-sections.tsx` (new)
- `apps/web/src/components/press/press-sections.module.css` (new)
- `apps/web/src/components/press/streaming-icons.tsx` (new)
- `apps/web/src/components/press/streaming-services.tsx` (new)
- `apps/web/src/components/press/streaming-services.module.css` (new)

```ts
export interface PressLiveDate {
  readonly id: string;
  readonly dateTime: string;
  readonly dateLabel: string;
  readonly venue: string;
  readonly city: string;
  readonly ticketUrl: string;
}

export interface PressTemplateProps {
  readonly creator: PressPagePayload["creator"];
  readonly content: DeliveredPressContent;
  readonly downloadUrl: string;
  readonly liveDates?: readonly PressLiveDate[];
}

export interface PressImageProps {
  readonly image: DeliveredPressImage | null | undefined;
  readonly slot: keyof PressImageSlot;
  readonly creditMode?: "caption" | "overlay";
  readonly loading?: "eager" | "lazy";
  readonly fetchPriority?: "high" | "auto" | "low";
}

export function PressImageFigure(props: PressImageProps): React.ReactElement | null;
export function AboutSection(props: Pick<PressTemplateProps, "content">): React.ReactElement | null;
export function MembersSection(props: { members: DeliveredPressContent["members"]; showBio: boolean }): React.ReactElement | null;
export function HighlightsSection(props: { highlights: DeliveredPressContent["highlights"]; limit: 2 | 3 }): React.ReactElement | null;
export function LiveDatesSection(props: { dates?: readonly PressLiveDate[]; liveDatesUrl?: string | null }): React.ReactElement | null;
export function StreamingServices(props: { links: PressContent["streamingLinks"] }): React.ReactElement | null;
```

`PressImageFigure` emits responsive `src/srcSet/sizes`, required `alt`, intrinsic
width/height matching the slot ratio, and credit markup. It returns `null` for a
missing image. The parent owns whether the empty wrapper remains (hero) or
collapses (all other slots). Shared CSS uses only production tokens and the
locked 980px measure, typography, spacing, cards, pills, date rows, services,
and responsive/print values. No component imports another component's CSS
module.

The icon registry is a `Record<PressStreamingService, IconDefinition>` so enum
expansion fails typecheck until a glyph/label is selected. SVGs are
`aria-hidden`; each anchor has `aria-label="Listen on ${link.label}"` and visible
text. Empty arrays omit their section rather than leaving a heading with no
content.

**Acceptance Criteria**:
- [ ] About, members, highlights, dates, and Listen render semantic headings and
  only the fields present in `DeliveredPressContent`.
- [ ] A uses member bios and a two-highlight limit when requested; B can request
  names-only and three highlights without branching inside item components.
- [ ] All service enum values render an icon; absent service uses shared
  `inferService`, and `website` never masquerades as a music brand.
- [ ] Missing optional fields and images produce no broken media, empty heading,
  literal `null`, or invented copy.
- [ ] Credits are visible on web and print and image `alt` is passed unchanged.

---

### Unit 3: Accessible translate3d gallery carousel

**Story**: `creator-press-page-v2-templates-carousel`

**Files**:
- `apps/web/src/components/press/press-carousel.tsx` (new)
- `apps/web/src/components/press/press-carousel.module.css` (new)
- `apps/web/tests/unit/components/press/press-carousel.test.tsx` (new)

```ts
export interface PressCarouselProps {
  readonly creatorName: string;
  readonly images: readonly DeliveredPressImage[];
}

export function PressCarousel(props: PressCarouselProps): React.ReactElement | null;
```

Keep `index` as a logical stride index. A measured `renderPosition()` reads the
track gap, first-slide width, `scrollWidth`, and viewport `clientWidth`, clamps to
`ceil(maxOffset / stride)`, and writes
`translate3d(-min(index * stride, maxOffset), 0, 0)`. Recalculate through one
`ResizeObserver` attached to viewport/track (with a window-resize fallback only
if needed), and clean it up. Buttons use real `disabled` state. The focusable
viewport handles ArrowLeft/ArrowRight and announces
`"${creatorName} press photo carousel"`; it does not trap Tab. CSS preserves
3.25 visible slides desktop, 2.2 below 760px, and 84% below 480px. Reduced-motion
tokens remove the transition. Print hides controls, clears transforms and
lays images out statically at 4:3.

Each slide uses `PressImageFigure(slot="gallery", creditMode="overlay")` and its
own credit; the section-level note remains "High-resolution selects available
from the press contact." Return `null` when `images` is empty.

**Acceptance Criteria**:
- [ ] Prev/next and ArrowLeft/ArrowRight move exactly one measured stride and
  clamp the final move to the true maximum offset.
- [ ] Prev is disabled at the beginning, next at the end, and both are disabled
  when all slides fit.
- [ ] Resizing never leaves the track past its new end; observer/listeners are
  removed on unmount.
- [ ] The page itself never gains horizontal overflow at 1440px, 760px, 480px,
  or 390px.
- [ ] Print shows static gallery images and no arrows/translated track.

---

### Unit 4: Template A — clean editorial

**Story**: `creator-press-page-v2-templates-render-a`

**Files**:
- `apps/web/src/components/press/press-template-a.tsx` (new)
- `apps/web/src/components/press/press-template-a.module.css` (new)
- `apps/web/tests/unit/components/press/press-template-a.test.tsx` (new)

```ts
export function PressTemplateA(props: PressTemplateProps): React.ReactElement;
```

Render the locked order: shared hero → About → Members (`showBio`) → Highlights
(`limit=2`) → Live dates/link-out → Listen → carousel → press footer. The hero
always occupies 3:1 (250–500px on screen): optional banner media is behind the
same two gradients, while display name, location, and tagline align to the 980px
article column. About floats its 4:5 figure right on desktop and becomes full
width below 760px. Members use four equal columns desktop/two mobile. Highlights
use two equal cards with 145px 1:1 art, collapse to one column below 760px, and
use 92px art below 480px. Alternate highlight borders accent/secondary by item
index as in the locked reference.

**Acceptance Criteria**:
- [ ] Populated rendering matches `final-1.html` section order, measure,
  alignment, spacing, type hierarchy, colors, two highlights, and member bios.
- [ ] Missing banner/about/member/cover/gallery images collapse as designed
  without changing the section order or creating broken media.
- [ ] Long names/content wrap inside `minmax(0,1fr)` containers without page
  overflow; the hero wordmark scales/wraps safely rather than clipping.
- [ ] Desktop, <=760px, <=480px, and letter-portrait print rules reproduce the
  locked composition.

---

### Unit 5: Template B — two-column zone

**Story**: `creator-press-page-v2-templates-render-b`

**Files**:
- `apps/web/src/components/press/press-template-b.tsx` (new)
- `apps/web/src/components/press/press-template-b.module.css` (new)
- `apps/web/tests/unit/components/press/press-template-b.test.tsx` (new)

```ts
export function PressTemplateB(props: PressTemplateProps): React.ReactElement;
```

Share hero/About/Live/Listen/carousel/footer with A, but compose Members and
Highlights inside an elevated `.95fr / 1.05fr` mid-zone. Members are a two-by-two
names/roles/photo grid with no bio nodes. Highlights are a vertical three-row
stack (`limit=3`) with 112px art and accent/secondary/muted top borders. Stack
zone columns below 820px; retain two member columns and 92px highlight art below
480px. Do not implement B by rendering A and overriding descendants.

**Acceptance Criteria**:
- [ ] Populated rendering matches `final-3.html`, including the balanced zone,
  names-only members, and three ordered highlights.
- [ ] Member bios are absent from the B DOM even when the content supplies them.
- [ ] Fewer than four members or three highlights compact naturally; no empty
  cards are generated.
- [ ] The zone remains centered/no-overflow at desktop and mobile and returns to
  the locked two-column geometry in letter print.

---

### Unit 6: Typed selector and replacement-in-place route

**Story**: `creator-press-page-v2-templates-replace-v1-route`

**Files**:
- `apps/web/src/components/press/press-page.tsx` (new)
- `apps/web/src/components/press/press-page.module.css` (new)
- `apps/web/src/routes/creators/$creatorId/press.tsx`
- `apps/web/src/routes/creators/$creatorId/press.module.css`
- `apps/web/tests/unit/components/press/press-page.test.tsx` (new)
- `apps/web/tests/unit/routes/creators/press.test.tsx`

```ts
const PRESS_TEMPLATES: Record<DeliveredPressContent["template"],
  React.ComponentType<PressTemplateProps>> = {
  A: PressTemplateA,
  B: PressTemplateB,
};

export interface PressPageProps extends PressTemplateProps {}
export function PressPage(props: PressPageProps): React.ReactElement;
```

The route keeps its server loader, 404 behavior, canonical URL, and error
propagation. It passes the delivered public payload and existing one-pager URL to
`PressPage`; there is no query-string/template override. Replace the legacy
photo-grid/standout/release page render in place. Update head metadata to prefer
delivered `banner.src`, then `aboutPhoto.src`, then the first `gallery.src` for
Open Graph/Twitter; description remains `shortBio` fallback.

The route stylesheet owns the safe viewport breakout from global
`.main-content` padding/max-width so the hero is full bleed while the wordmark,
article, and press footer stay centered at 980px. The production page omits mock
metadata. The fixed PDF action and press footer match the mock; the email is the
stored `pressContactEmail` rendered verbatim (the fixture asserts
`press@s-nc.org`). Print hides the fixed action/carousel controls and uses
`@page { size: letter portrait; margin: .35in .5in; }`; the printable template
component is independent of the mock HTML so the v2 PDF feature can reuse it.
The unavailable page stays a normal constrained route rather than inheriting the
full-bleed template shell.

**Acceptance Criteria**:
- [ ] `template: "A"` renders only A and `template: "B"` renders only B; the
  registry is exhaustive at compile time.
- [ ] The route still returns a real route 404 for missing/disabled press kits
  and propagates non-404 failures.
- [ ] OG/Twitter image metadata uses the first delivered v2 image, never the
  retired indexed-photo endpoint.
- [ ] The press URL is unchanged and v1 remains live until this replacement
  commit lands; no editor file is touched.
- [ ] `press@s-nc.org` is exact in the seeded render/mailto assertion, and no
  `press@snc.org` literal is introduced.
- [ ] Direct web print is letter portrait and the render component can be mounted
  without app navigation chrome by the later PDF feature.

## Implementation Order

1. `creator-press-page-v2-templates-image-projection` — after
   `creator-press-page-v2-image-management`; establish the signed delivery
   boundary.
2. `creator-press-page-v2-templates-shared-sections-and-icons` — semantic and
   visual primitives over the delivered payload.
3. `creator-press-page-v2-templates-carousel` — highest-risk client behavior.
4. `creator-press-page-v2-templates-render-a` and
   `creator-press-page-v2-templates-render-b` — parallel composition shells once
   shared sections/carousel are stable.
5. `creator-press-page-v2-templates-replace-v1-route` — exhaustive selector,
   metadata, full-bleed/print shell, replacement-in-place, integrated tests.

## Simplification

- Delete the v1 page's inline `pressEndpoint` photo-index logic and all legacy
  section markup when the selector route lands; do not keep a dual v1/v2 render.
- Replace `apps/web/src/routes/creators/$creatorId/press.module.css` rather than
  layering template rules onto the obsolete grid/card stylesheet.
- Keep `PressContent` persistence and the manage editor untouched. Legacy
  `photos/standoutTrack/releases` stay in the shared transition contract for the
  editor/PDF cleanup arc, but the public page no longer special-cases them.
- Use one shared section implementation and one icon registry; no generic page
  DSL, template inheritance, duplicated crop math, or client URL signer.

## Testing

- **API interface test — image seam**: mock `buildPressImageUrl` and assert every
  occurrence uses the correct slot and width, preserves crop/alt/credit, and
  leaves null/empty values alone. This protects the cross-feature contract and
  signed-server boundary.
- **Template render tests — visible contract**: representative populated A and B
  fixtures assert order, A bios/two highlights, B no bios/three highlights,
  icon accessible names, credit text, links, and exact `press@s-nc.org` mailto.
  A sparse fixture asserts gradient-only hero, text-only members/highlights,
  omitted about/gallery sections, and no `<img src="">`.
- **Carousel unit test — risky behavior**: mock geometry to protect stride/clamp,
  arrow disabled states, keyboard navigation, resize reconciliation, and cleanup.
  Do not snapshot implementation markup.
- **Route regression test — stable boundary**: retain loader 404/error and PDF
  URL tests; assert template dispatch and v2 OG image priority. Remove obsolete
  assertions tied to `/press/photos/:index`.
- **Accessibility**: Testing Library role/name assertions for section headings,
  carousel controls/viewport, links, figures, and required alt. Add an automated
  a11y pass only if the existing web harness already has one; do not add a new
  test framework for this feature.
- **Visual verification**: after implementation, render A/B fixtures at 1440,
  760, 480, and 390px plus print preview, compare against final-1/final-3, and
  pair the visual pass with exact-string grep for email/domains/URLs. This is the
  residual proof for spacing and composition that jsdom cannot provide.

## Pre-mortem

- **Riskiest assumption — image delivery lands as a safe cross-package seam.** If
  templates try to call the signer in browser code, the build can expose secrets
  or fail hydration. The explicit API projection and story dependency prevent
  that. If image-management is late, template units may be built against typed
  delivered fixtures, but the public route flip waits. Both feature bodies and
  the image-management contract story pin the operator-required
  `{ src, srcSet, sizes }` return.
- **Production failure mode — global shell defeats full bleed or pollutes print.**
  The root `.main-content` has max-width/padding and the app adds navigation and
  a global footer. The route story must verify the real assembled route, not only
  isolated components, at screen and print media.
- **Interaction failure mode — carousel measurements drift after responsive
  resize/font/image load.** Use measured offsets, clamp every render, observe
  size changes, and test the last partial stride. Native page overflow is a hard
  failure.
- **Content failure mode — empty AF images create broken or lopsided cards.** Every
  optional image path has an explicit null behavior and the sparse fixture ships
  alongside populated fixtures.
- **Where confidence is lowest — one-page print with unbounded arrays/text.** The
  locked CSS is letter-portrait and compact, but the content schema does not cap
  members, highlights, gallery count, or biography length. This feature must not
  silently discard creator content. It preserves all web content and the locked
  print treatment; the v2 PDF feature must settle a truncation, continuation-page,
  or editor-limit policy before claiming every payload is literally one page.

## Resolved implementation policy

Web templates render all creator content without truncation. The dedicated v2
PDF feature owns any one-page overflow policy; browser print may continue onto
additional letter pages rather than discard content.

## Integrated verification
- Execution capability: one direct inline owner carried all six ordered child checkpoints; no nested agents or peer review were used.
- Review weight: standard (project default); implementation stops at `review` per the operator's requested boundary.
- Child stories: image projection, shared sections/icons, carousel, Template A, Template B, and route replacement are all `stage: done`, each with its own committed evidence.
- API boundary: every v2 image occurrence is projected server-side through `buildPressImageUrl` with the matching slot/width; editable manage responses remain raw and browser code contains no signer/crop arithmetic.
- Public rendering: exhaustive A/B selector, locked section order/composition, all streaming services, measured accessible carousel, empty-media collapse, delivered metadata priority, unchanged URL/404/PDF contracts, full-bleed shell, and letter-print continuation are implemented.
- Automated verification: web suite 182 files / 1,864 tests passed; web typecheck 0 errors; web production build passed; API suite 124 files / 1,978 tests passed; API TypeScript check 0 errors.
- Visual verification: isolated populated and image-empty A/B fixtures were screenshot and visually inspected at 1440, 760, 480, and 390px; the production-built real Animal Future route (all image slots empty) was visually inspected inside the actual app shell at 1440 and 390px. Centering, viewport breakout, responsive zone/grids, five-icon row, carousel peek/arrows, mobile fixed-action clearance, and absence of broken media/horizontal overflow passed. Firefox BiDi letter PDFs for A and B confirmed letter portrait, preserved credits/colors, hidden fixed/carousel controls, static gallery layout, and multi-page full-content continuation (A three pages, B two) without truncation.
- Exact-string/source verification: exact `press@s-nc.org` and `mailto:press@s-nc.org`; no `press@snc.org`, no legacy public indexed-photo endpoint, no individual `@tanstack/start-*` resolution; `translate3d`, ArrowLeft/ArrowRight, all eight service registry keys, and 3:1/4:5/1:1/4:3 slots present.
- Discrepancies from design: delivered public types/schema remain local to the API/web adapters rather than modifying `packages/shared/src/press.ts`, honoring the operator's explicit prohibition against re-touching the completed shared seam.
- Adjacent issues parked: none.

## Review (pass 1) findings + resolution

The thorough pass found no blocking issues and confirmed visual fidelity. Two
bounded should-fix findings were resolved while keeping the feature at
`stage: review` for pass 2:

- **Unexpected template value:** `PressPage` now falls back to Template A when
the runtime registry lookup is missing. A regression test covers a malformed
`template` value despite the typed payload contract.
- **Carousel prop reconciliation:** gallery and creator transitions reset the
logical index, synchronously re-measure the current track, and cleanly
rebind `ResizeObserver` to the current viewport/track. Regression tests cover
empty→populated, populated→empty→populated, and creator-switch transitions.

Verification: the focused press regression suite passed (**6 files / 27
tests**); web typecheck reported **0 errors**; web production build passed.
The full web suite was also run (**181 files passed / 1 failed; 4 known
pre-existing `press-crop-editor` failures** in the concurrently changing
image-management surface, excluded from this bounded fix). Fresh populated
Template A and B screenshots at 1440px and 390px were visually checked after
the fixes: both retain the locked hierarchy, centered measure, responsive
two-column/stacked composition, carousel peek/arrows, and no horizontal
overflow. The exact `press@s-nc.org` contact string remains intact. Feature
remains at `review`, ready for pass 2.
