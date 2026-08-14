---
id: brand-voice-export-theming
kind: feature
stage: review
tags: [design-system]
parent: brand-voice-system
depends_on: [brand-token-architecture]
release_binding: null
gate_origin: null
created: 2026-08-13
updated: 2026-08-14
---

# Brand voice — export / print theming

## Brief

Wire the voice token model into the existing press-PDF export path so PDFs render in a
voice theme. Export already ships (the `creator-press-page-v2-pdf` feature, done):
`apps/api/src/services/browser-pdf.ts` renders templates A/B to letter-size via Playwright
(HTML→PDF); the public press page offers "Download full press PDF" + "Download one-sheet
PDF"; PDFs already consume the creator brand color; the manage UI has pdfDark/pdfAccent
preview variants. So this is a **theming-wiring task on existing infrastructure**, not a
new pipeline.

## Scope

- Apply voice tokens to the print stylesheet (templates A/B already carry `@page letter`
  print CSS; tokens resolve there).
- **Export voice = the producing unit's voice** (org-confirmed 2026-08-13): Records press
  kit → Records; Studio services doc → Studio; unknown unit → default Records. Creator brand
  color persists as an override ONLY for federation-entry creators with established brand
  identity; creator-chosen is off (voices aren't user-pickable). Public-facing →
  brand-constrained (per the audience-split principle).
- Confirm print-mode constraints: print is a fixed-palette medium (typically no dark mode);
  verify voice tokens render correctly in the print context.

## Simplification opportunity

- Cruft: the legacy v1 `press-pdf.ts` (`@react-pdf/renderer`) was replaced by the Playwright
  path in v2 — confirm it's dead and remove.

## Depends on

`brand-token-architecture` — voice tokens must exist. Does NOT require the route-scoping or
toggle mechanisms (export voice selection is explicit, not route-derived).

## Grounding record

Direct-read only: the export path is bounded to `apps/api/src/services/browser-pdf.ts`,
`apps/api/src/services/press-pdf.ts`, `apps/api/src/routes/press.routes.ts`, the public press
templates/print CSS, and their API/web tests. No exploratory fan-out was warranted.

The cruft premise was only partly correct. `press-pdf.ts` is the active v2 orchestration
service, and `@react-pdf/renderer` still serves the public release-specific
`/press/releases/:releaseSlug/one-sheet.pdf` route through `renderOneSheetPdf`; it is not dead
today. Because that route is also a Records export, this feature migrates its small remaining
document to the same browser path before removing `@react-pdf/renderer`. Deleting it without
that migration would remove public behavior.

No new UI surface is introduced. The existing three-choice PDF scheme control becomes
obsolete under the fixed light-paper contract and is simplified to two direct preview links;
mockups are therefore skipped.

## Design decisions

- **Export identity is an explicit service input, never inferred from the request route**:
  every renderer receives a producing unit and creator identity data — this keeps exports
  independent of `data-route` and makes future Studio/TV exporters use the same contract.
- **Known producing units map to their matching voice; missing or unknown units map to
  Records**: this implements the locked fallback without silently making generic platform
  routing part of PDF behavior.
- **Print always sets `data-theme="light"` before asset readiness and printing**: paper is a
  fixed-palette output, so no stored/system mode or dark-print branch is carried forward.
- **A creator export override requires both a federation handle and a curated non-null brand
  color**: a handle is the existing persisted federation-entry criterion, while a configured
  curated color is the existing evidence of established brand identity; no speculative schema
  flag is added.
- **Creator color is a non-text decoration override, not the text accent on light paper**:
  the current curated palette was validated against the old dark surface, not warm paper, so
  the exact creator color is retained for rules/bands while text and controls keep the
  contrast-verified voice accent/on-accent pair.
- **One-sheet and release HTML bootstrap from the live press URL, then replace only the body**:
  this reuses the web bundle's child-1 token and Fontsource CSS without copying literals into
  the API or publishing a second token artifact.
- **All public press PDFs converge on Playwright**: migrating the still-active release sheet
  makes `@react-pdf/renderer`, its React document dialect, and the API-only legacy font embeds
  removable while preserving the route.
- **The `theme=light|dark|brand` query and authoring picker retire in place**: fixed light mode
  and automatic eligible creator decoration replace three caller-selected modes; platform is
  alpha and owns both callers, so a compatibility shim would only preserve contradictory
  behavior.
- **No design-time advisory pass**: the surface is small, reversible, and constrained by
  locked product decisions; implementation receives the epic's standard fresh-context review.

## Architectural choice

### Option A — duplicate the light voice values in the API

Generate inline API CSS containing Records/Studio/TV/Parent literals. This keeps standalone
HTML independent of the web route, but creates a second source of truth beside
`apps/web/src/styles/tokens/voices/families.css` and will drift when stakeholder-final values
replace the placeholders. Rejected.

### Option B — publish a second stable token stylesheet for PDF HTML

Copy or expose the web token files as a public static asset and link it from standalone PDF
HTML. This preserves CSS variable names but adds a build/deploy synchronization contract and
a second publicly-addressable artifact solely for one renderer. Rejected until a non-browser
export consumer proves that contract useful.

### Option C — retain the loaded web head and replace the document body (chosen)

For all browser exports, navigate to the enabled public press page so its compiled token/font
styles load. Full PDFs print that page normally; curated one-sheets and release sheets replace
only `<body>` with their escaped server-generated markup, add their exact Letter CSS, and then
run the existing asset/fit preflights. A document attribute pins light mode and a later injected
scope maps generic PDF aliases directly to `--voice-<name>-*`. This keeps one token owner,
avoids a new route or asset contract, and uses the already-required render URL.

A dedicated hidden web PDF route was also considered. It would make React own every document,
but adds a public routing/data-loading surface only to transport already-safe server-generated
markup. Body replacement is the smaller boundary for the current three documents.

## Implementation units

### Unit 1: Browser document preparation

**Files**:
- `apps/api/src/services/browser-pdf.ts`
- `apps/api/tests/services/browser-pdf.test.ts`

**Story**: `brand-voice-export-theming-renderer-contract`

```ts
export interface BrowserPdfOptions {
  readonly html?: string;
  readonly url?: string;
  readonly replaceBodyHtml?: string;
  readonly documentAttributes?: Readonly<Record<`data-${string}`, string>>;
  readonly style?: string;
  readonly singlePage?: boolean;
  readonly timeoutMs?: number;
}
```

**Implementation notes**:
- Preserve the existing exactly-one-of `html`/`url` invariant. Reject
  `replaceBodyHtml` unless `url` is supplied; only accept `data-*` attribute names.
- After `goto`/`setContent`, apply document attributes and optional body replacement in one
  bounded `page.evaluate`, then add the export style. Only after that run `waitForAssets`,
  emulate print, run the one-page geometry check, and call `page.pdf`.
- Body replacement deliberately retains `<head>` and its compiled global token/font styles.
  It does not use `document.open()` or `setContent()`, either of which would discard the loaded
  stylesheets. All generated markup remains escaped by `press-pdf.ts`.
- Keep timeout, cleanup, concurrency, non-2xx, and failed-asset semantics unchanged.

**Acceptance criteria**:
- [ ] URL rendering can replace body markup while retaining the loaded head, and applies
  `data-theme="light"` plus `data-export-voice` before asset readiness and print emulation.
- [ ] Invalid source combinations, non-data attribute names, and body replacement without a
  URL fail before Chromium work begins.
- [ ] Existing hard-deadline, page cleanup, asset failure, single-page fit, and two-page
  concurrency tests remain green.

### Unit 2: Explicit export voice and light-paper token scope

**Files**:
- `apps/api/src/services/press-pdf.ts`
- `apps/api/src/routes/press.routes.ts`
- `apps/web/src/components/press/press-sections.module.css`
- `apps/api/tests/services/press-pdf.test.ts`
- `apps/api/tests/routes/press.test.ts`
- `apps/api/tests/integration/library.test.ts`

**Story**: `brand-voice-export-theming-renderer-contract`

```ts
export const EXPORT_VOICES = ["parent", "studio", "tv", "records"] as const;
export type ExportVoice = (typeof EXPORT_VOICES)[number];

export interface PdfExportIdentity {
  readonly producingUnit: string | null;
  readonly federationHandle: string | null;
  readonly creatorBrandColor: CreatorBrandColor | null;
}

export interface ResolvedPdfExportIdentity {
  readonly voice: ExportVoice;
  readonly creatorDecoration: CreatorBrandColor | null;
}

export const resolvePdfExportIdentity = (
  identity: PdfExportIdentity,
): ResolvedPdfExportIdentity;
```

The two creator renderers become:

```ts
export const renderOnePagerPdf = async (input: {
  pageUrl: string;
  exportIdentity: PdfExportIdentity;
}): Promise<Buffer>;

export const renderCreatorOneSheetPdf = async (input: {
  creator: {
    id: string;
    displayName: string;
    handle: string | null;
    socialLinks: readonly SocialLink[];
  };
  content: PressContent;
  pressPageUrl: string;
  exportIdentity: PdfExportIdentity;
  destinationUrl?: string;
  orientation: OneSheetOrientation;
}): Promise<Buffer>;
```

The release renderer migrates to the browser contract:

```ts
export const renderReleaseOneSheetPdf = async (input: {
  release: ReleaseOneSheet;
  pressPageUrl: string;
  exportIdentity: PdfExportIdentity;
}): Promise<Buffer>;
```

**Implementation notes**:
- `resolvePdfExportIdentity` lowercases known producing-unit names and maps Parent/Studio/TV/
  Records to their voice; every other value, including null, resolves Records. It returns a
  creator decoration only when `federationHandle` is non-null/non-empty and the curated color
  is non-null.
- Every press route passes `producingUnit: "records"` explicitly plus `profile.handle` and
  `profile.brandColor`. Future exporters must make their own explicit producing-unit call.
- Generate one export scope after child 1's tokens load:

  ```css
  :root[data-theme="light"][data-export-voice="records"]
  :is([data-press-template], [data-pdf-sheet]) {
    --color-accent: var(--voice-records-accent);
    --color-accent-hover: var(--voice-records-accent-hover);
    --color-accent-bg: var(--voice-records-accent-bg);
    --color-accent-subtle: var(--voice-records-accent-subtle);
    --color-on-accent: var(--voice-records-on-accent);
    --color-accent2: var(--voice-records-accent2);
    --font-body: var(--font-body-records);
    --font-display: var(--font-display-records);
    --radius: var(--voice-records-radius);
  }
  ```

  Generate the same direct references for the other voices. The selector lands later than
  route-resolution CSS and targets the PDF root, so a full press PDF does not depend on its
  route container's `data-route` value.
- Use `--color-accent`/`--color-on-accent` for text and controls. Define a print-local
  `--export-accent-decoration` as the eligible creator color or the resolved voice accent;
  `press-sections.module.css` and the inline one-sheet/release CSS use it only for non-text
  borders/rules. This preserves exact creator pigment without asserting unverified light-paper
  text contrast.
- Replace old `--color-secondary` uses in PDF content with the mapped Records accent or shared
  muted ink according to child 1's mapping; do not turn `accent2` into a generic secondary.
- Full PDF prints the live template with `documentAttributes`; creator/release one-sheets also
  pass `replaceBodyHtml` and `singlePage: true`. Their generated HTML helpers return body markup
  plus style instead of complete documents.
- Recreate the compact release sheet in HTML/CSS at the same Letter geometry and route contract,
  then delete the React-PDF document helpers/imports. `apps/api/package.json` and `bun.lock`
  remove `@react-pdf/renderer`; the obsolete API-only Inter/Source Serif embedding is removed
  after all three browser documents consume child 1's loaded fonts.
- Remove `PDF_THEMES`, `PressPdfThemeQuerySchema`, `theme`, and direct `brandColor` renderer
  inputs. Orientation and validated HTTP(S) QR destination remain unchanged.

**Acceptance criteria**:
- [ ] Full template A/B PDFs, curated horizontal/vertical one-sheets, and release one-sheets
  all resolve Records roles from `voices/families.css` under light mode and retain US Letter
  geometry/background printing.
- [ ] A service test proves Studio resolves Studio, Records resolves Records, and null/unknown
  producer resolves Records without consulting a route.
- [ ] Creator decoration appears only for `{ handle, brandColor }`; handle-only, color-only,
  and neither use the voice decoration. Text remains on the verified voice pair.
- [ ] Full-template export wins over any route scope because the explicit PDF-root selector
  resolves the aliases independently.
- [ ] The real Chromium integration still produces a one-page creator sheet with real Garage
  media and a release PDF; computed output contains no unresolved required voice variables.
- [ ] No source or package manifest reference to `@react-pdf/renderer`, `PdfTheme`,
  `PDF_THEMES`, `DEFAULT_ACCENT`, or `DEFAULT_SECONDARY` remains.

### Unit 3: Retire caller-selectable PDF modes

**Files**:
- `apps/web/src/routes/creators/$creatorId/manage/-press-editor.tsx`
- `apps/web/src/routes/creators/$creatorId/manage/manage-press.module.css`
- `apps/web/tests/unit/routes/creators/manage/press-manage.test.tsx`

**Story**: `brand-voice-export-theming-authoring-cleanup`

```tsx
<a href={`/api/creators/${encodeURIComponent(creatorId)}/press/one-pager.pdf`}>
  Preview full press PDF
</a>
<a href={`/api/creators/${encodeURIComponent(creatorId)}/press/one-sheet.pdf`}>
  Preview one-sheet PDF
</a>
```

**Implementation notes**:
- Remove `PdfScheme`, `pdfScheme` state/reset logic, the Light/Dark/Creator Accent choice
  cards, and `.pdfGrid`/`.pdfChoice`/`.pdfPreview`/`.pdfDark`/`.pdfAccent` styles.
- Keep the site-wide curated creator color picker. Rewrite its warning/help and fixed-paper
  preview copy to state that eligible federated creators receive the color automatically as
  PDF decoration; no control claims to choose a voice or output mode.
- Present the two existing preview links directly in the card. The public press page's existing
  download URLs already omit `theme` and need no source change.

**Acceptance criteria**:
- [ ] The authoring UI exposes no PDF mode or voice choice and both preview links omit
  `theme=`.
- [ ] The creator color remains settable/clearable as site-wide profile data; saving still
  calls the existing profile endpoint.
- [ ] Obsolete state, reset branches, fixed dark/accent preview CSS, and tests asserting the
  old query contract are removed rather than hidden.

## Implementation order

1. `brand-voice-export-theming-renderer-contract`: extend the browser adapter, resolve export
   identity, theme all three public press PDFs, migrate the active release renderer, and verify
   the machine boundary.
2. `brand-voice-export-theming-authoring-cleanup`: remove the contradictory picker only after
   fixed-light automatic output is operational, then run API/web unit suites, API integration,
   typechecks, and PDF geometry/visual inspection.

The normal implementation owner should carry both checkpoints as one cohesive feature bundle.
`work-view --blocking` could not run because the parent epic currently has duplicate `stage`
frontmatter; the sibling chain was checked manually: renderer has no sibling dependency and
cleanup depends only on renderer, so it cannot form a cycle.

## Simplification

- Migrate the one still-active release React-PDF sheet before deleting
  `@react-pdf/renderer`; do not falsely classify the current service as dead.
- Delete the three-mode theme API and manage-state branches instead of retaining ignored or
  dual behavior.
- Remove API-owned duplicate color literals and font embedding; child 1's compiled web token/
  font layer remains the single source of truth.
- Do not add a shared registry, static token copy, hidden PDF route, route-derived voice, or
  creator voice preference.

## Testing

- **Browser adapter interface tests** protect preparation ordering and validation: retained
  head + replaced body, document attributes before readiness, invalid combinations, and all
  existing deadline/cleanup/fit behavior.
- **Press service tests** protect the stable export contract: producing-unit resolution,
  unknown fallback, creator eligibility matrix, direct light voice-role references, three
  browser-rendered document shapes, QR/layout behavior, and no unresolved legacy literals.
- **Route tests** protect thin-handler wiring: every press PDF supplies explicit Records
  identity, old theme selection is absent, orientation/QR validation and response headers stay
  intact.
- **One real integration slice** protects the risky cross-package assumption that navigating
  the live page retains compiled token/font styles after body replacement and still embeds real
  media into a one-page Letter PDF. Extend the existing library/PDF integration rather than
  create a parallel fixture system.
- **Web unit test** protects the removed-choice contract while retaining brand-color save/clear
  and both preview destinations.
- **Output inspection**: render full A/B, horizontal/vertical one-sheet, and release fixtures;
  assert Letter page count/size and inspect the fixed light output plus eligible/non-eligible
  creator decoration. This is existing-output verification, not a mockup phase.
- No duplicate unit test is added for every CSS declaration, and no existing fit/asset/QR test
  is removed merely because the renderer theme changes.

## Risks

- **Riskiest assumption — retained-head token availability**: one-sheet/release rendering now
  depends on the public press page completing SSR and loading the child-1 stylesheet before body
  replacement. The browser's existing non-2xx/asset deadline makes failure explicit; fallback is
  a generated stable token asset only if deployment evidence shows the live-head contract is
  unreliable.
- **Creator contrast**: curated colors were validated against dark, not light paper. Restricting
  exact creator pigment to non-text decoration avoids an accessibility regression; expanding it
  to text requires a separately verified light-paper palette/derivation.
- **Cascade precedence**: the live press subtree will also receive Records route aliases once
  child 2 ships. The later explicit PDF-root selector must win, and a test must cover a conflicting
  route attribute so export never accidentally becomes route-derived.
- **Release fidelity**: moving the compact release sheet from React-PDF to HTML can shift line
  wrapping. Exact Letter/single-page fit preflight plus a long-field fixture and rendered output
  inspection guard the active route contract.
- **SSR recurrence**: the previous PDF feature recorded a local press-route SSR `fetch failed`.
  If still reproducible, it blocks all retained-head exports and must be treated as a renderer
  prerequisite, not bypassed by copying token values.
- **Concurrent worktree**: child 1 token files and child 2 item design are being edited in the
  shared tree. Implementation must consume the finalized child-1 names after the declared feature
  dependency completes and avoid committing unrelated worktree changes.

## Implementation summary

- Extended the shared Playwright adapter with pre-launch validation, retained-head URL body replacement, and `data-*` document preparation before style/assets/print.
- Added explicit producing-unit export identity and light voice scopes for Parent, Studio, TV, and Records; creator pigment is eligible only with both federation handle and curated color and is consumed only as `--export-accent-decoration` on non-text rules/bands.
- Converged full press, creator one-sheet, and release one-sheet output on the browser renderer; removed React-PDF, its API-only fonts/color branches, the theme query contract, and all obsolete package references.
- Replaced the manage editor's three PDF modes with two direct query-free previews while retaining site-wide creator color save/clear and accurate automatic-decoration copy.
- Execution capability: `gpt-5.6-sol` from the autopilot caller; direct-read implementation retained one feature owner across both sequential checkpoints. Review weight: `standard` from the caller, with review delegated to the orchestrator.
- Design discrepancy: the unused `PdfScheme` export remains in `-press-editor-model.ts` because that file was outside this worker's explicit write scope. No import, state, reset, selector, route query, or runtime compatibility behavior remains.

## Integrated verification

- `bun run --filter @snc/api typecheck` — passed.
- `bun run --filter @snc/api test:unit` — 126 files / 2,036 tests passed.
- `bun run --filter @snc/api test:integration` — 12 files / 54 tests passed against real PostgreSQL, Garage, imgproxy, live web SSR, and Chromium.
- `bun run --filter @snc/web typecheck` — passed after route generation.
- `bun run --filter @snc/web test` — 195 files / 2,019 tests passed.
- `bun run --filter @snc/web build` — passed; existing third-party `use client` bundle warnings only.
- Output inspection rendered live full Template A and B PDFs, horizontal and vertical creator sheets with real Garage media, and a long-field release fixture. All documents reported US Letter media boxes; creator/release sheets each reported exactly one PDF page, fixed-light token/font assets loaded after retained-head replacement, and the recorded press-route SSR `fetch failed` did not reproduce.
- Source/manifest scan found no `@react-pdf/renderer`, `PdfTheme`, `PDF_THEMES`, `DEFAULT_ACCENT`, `DEFAULT_SECONDARY`, API-only Inter/Source Serif dependency, old renderer name, or `theme=` caller reference.
