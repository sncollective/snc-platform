---
name: print-design
description: >
  Enforces the S/NC print-design system for print, PDF, one-sheet, press sheet,
  US Letter, @page, print grid, baseline, print typography, QR, and bleed work.
  Auto-loads for print mock generation and adversarial review so page geometry,
  grids, type floors, spacing rhythm, image resolution, and QR pre-flight are
  checked rather than treated as optional visual vocabulary.
user-invocable: false
updated: 2026-08-08
---

# Print Design Reference

Use this for every printable PDF, press one-sheet, and print mock. It is an
**enforcement layer**, not an inspiration list: a mock that evokes Tufte,
Vignelli, or Müller-Brockmann but fails these checks is not done.

For S/NC press sheets, carry over the design-system vocabulary deliberately:
`#1a1a2e` dark ground, `#f0f0f0` text, `#f5a623` accent, `#5bb5b5`
secondary, Georgia for editorial display/headings, and Inter for body/meta.
Do not carry over web-card density, screen type sizes, or fluid screen spacing.

## 1. Page geometry and `@page`

### Canonical dimensions

| Unit | US Letter portrait |
|---|---:|
| Physical | `8.5in × 11in` |
| PostScript/CSS points | `612pt × 792pt` |
| CSS reference pixels at 96px/in | `816px × 1056px` |

CSS defines `1in = 96px` and `1pt = 1/72in`; these pixel dimensions describe a
CSS canvas, **not** a 96dpi print raster.[2] Use `in` or `pt` in print rules.

`@page` sets the page box. Its margin removes space from the page area into
which document content flows; it is not extra padding around an already
Letter-sized `.sheet`.[1]

**Office/non-bleed PDF recipe — safest default:**

```css
@page {
  size: letter portrait;
  margin: 0.5in;
}

@media print {
  html, body { margin: 0; }
  .sheet {
    width: auto;       /* @page area is 7.5in wide */
    min-height: 10in;  /* @page area is 10in tall */
  }
}
```

**Exact Letter mock canvas recipe — background reaches the page box:**

```css
@page { size: letter portrait; margin: 0; }

.sheet {
  box-sizing: border-box;
  width: 8.5in;
  height: 11in;
  padding: 0.5in; /* content safe area; page background may extend outward */
}

@media print {
  html, body { margin: 0; }
  .sheet { box-shadow: none; }
}
```

A physical printer has a device-specific non-printable strip at the sheet
edges; CSS cannot know it reliably.[1] Therefore:

- Keep all text, logos, QR codes, rules, and essential image content at least
  `0.5in` from the edge for ordinary office/non-bleed printing.
- Never promise edge-to-edge output from an office printer. A dark Letter page
  may acquire an unprinted white rim.
- For a commercial full-bleed job, extend backgrounds/images `0.125in` past
  trim on every side and keep critical content at least `0.25in` inside trim.
  The supplied artwork is therefore `8.75in × 11.25in` before trimming.
- Confirm the printer's required bleed and safe area: bleed is a trimming
  margin of error, and the print provider owns the final production spec.[3]

CSS Paged Media defines `bleed` and `marks`, but browser/PDF support is not a
production guarantee.[1] If the renderer supports them, the intent is:

```css
@page {
  size: letter portrait;
  margin: 0;
  bleed: 0.125in;
  marks: crop;
}
```

Otherwise export through a production tool or an oversized artboard with crop
marks. Do not label a browser PDF “bleed-ready” without inspecting its boxes.

## 2. The grid system

Müller-Brockmann's modular-grid method turns the page into repeatable fields;
the baseline grid aligns text across columns and pages.[4][5] S/NC makes that
operational with two mandatory grids:

1. **Horizontal editorial grid:** define either 6 columns for a simpler
   one-sheet or 12 columns when finer spans are required. The 12-column grid is
   a subdivision, not permission for 12 unrelated alignments. Declare column
   count, page inset, and gutter at the top of the CSS.
2. **Vertical baseline grid:** `4px = 3pt`. Every text line-height, section
   boundary, image height, rule offset, and vertical spacing token lands on a
   multiple of 4px. Font sizes may be optically chosen; their **line boxes**
   must snap.

```css
.sheet {
  --baseline: 4px;       /* 3pt */
  --page-inset: 48px;    /* 0.5in */
  --gutter: 12px;        /* 9pt */
}

.editorial-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  column-gap: var(--gutter);
}

/* Example spans; use the same starts throughout the page. */
.hero    { grid-column: 1 / -1; }
.story   { grid-column: 1 / span 8; }
.facts   { grid-column: 9 / -1; }

/* Reviewer-only overlay: remove/disable in the exported PDF. */
.debug-baseline {
  background-image: repeating-linear-gradient(
    to bottom,
    rgb(91 181 181 / 0.22) 0 1px,
    transparent 1px var(--baseline)
  );
}
```

**Snap test:** for every block, its top coordinate, line-height, vertical
padding, vertical margin, fixed media dimension, and bottom coordinate must be
expressible as `N × 4px`. A baseline grid follows the document's leading; do
not set `line-height: 1.23` and hope it aligns.[5]

Do not use fixed heights for text-bearing rows or sections. Use intrinsic
content height, baseline-multiple padding, and explicit grid spans. Fixed
heights are allowed for deliberate media crops and the Letter page itself.

## 3. Print type floors

Print and screen sizes are not interchangeable. At 96 CSS px/in,
`5px = 3.75pt` and `7px = 5.25pt`: both are below the S/NC metadata floor.
Butterick recommends `10–12pt` for normal printed body text and notes `6–8pt`
only for compact professionally typeset matter such as business cards.[6]
The smaller limits below are **hard emergency floors for a dense one-sheet**,
not preferred defaults.

| Role | Hard minimum | Minimum px at 96px/in | Baseline-snapped line-height | Measure / use |
|---|---:|---:|---:|---|
| Wordmark / masthead | `18pt` | `24px` | `21pt / 28px` | One short line |
| Hero display | `24pt` | `32px` | `27pt / 36px` | Prefer ≤30 characters |
| Section heading / deck | `12pt` | `16px` | `15pt / 20px` | 1–3 lines |
| Body / prose | **`7.5pt`** (prefer `9–10.5pt`) | **`10px`** (prefer `12–14px`) | minimum `9pt / 12px`; use `12pt / 16px` at 9pt or `15pt / 20px` at 10–10.5pt | **45–75 characters/line** |
| Caption / metadata | **`6.5pt`** (prefer `7–8pt`) | **`8.67px`** | `9pt / 12px` | Short labels/facts only; never prose |

Most text needs leading around `120–145%` of point size.[7] Baseline snapping
wins within that range: choose the next 4px line-height that fits. The target
measure is 45–75 characters per line (about 66 is comfortable); Butterick's
broader outside bound is 45–90.[7][8]

**Enforcement:** if content does not fit, edit the copy, change spans, remove a
low-value element, or add a page. Never solve overflow by shrinking prose below
`7.5pt`, metadata below `6.5pt`, or leading below `120%`. Proof Georgia and
Inter at actual print size: equal point sizes do not imply equal apparent size.[6]

## 4. Spacing scale and rhythm

All layout spacing comes from this scale. One-off `2px`, `5px`, `7px`, `9px`,
`10px`, `14px`, `18px`, or `20px` gaps fail review.

| Token | CSS px | Print pt | Use |
|---|---:|---:|---|
| `--print-space-1` | `4px` | `3pt` | label-to-value, optical micro-gap |
| `--print-space-2` | `8px` | `6pt` | tightly related items |
| `--print-space-3` | `12px` | `9pt` | paragraph/item separation |
| `--print-space-4` | `16px` | `12pt` | intra-section groups |
| `--print-space-6` | `24px` | `18pt` | section separation / gutter |
| `--print-space-8` | `32px` | `24pt` | major section break |
| `--print-space-12` | `48px` | `36pt / 0.5in` | page inset only |

- **Intra-section:** `4–16px`; related content stays visibly together.
- **Section gap:** `24–32px`; a section boundary must exceed its internal gaps.
- Hairline widths, crop geometry, font sizes, and letter-spacing are not
  spacing tokens; do not use that exception to invent layout gaps.

### Intentional whitespace, never trapped whitespace

Whitespace is intentional when it separates levels in the reading sequence or
is assigned to one named flexible page buffer. It is trapped when a fixed-height
section, `minmax(..., 1fr)`, `align-content: center`, or vertically centered card
leaves a void around tiny content that cannot participate in the page rhythm.

**Never hide leftover page height inside sections.** Let sections size to their
content and put all surplus height into **one deliberate buffer immediately
before the footer**:

```css
.sheet-inner {
  min-height: 100%;
  display: grid;
  grid-template-rows: auto auto auto minmax(0, 1fr) auto;
}
.page-buffer { min-height: 0; } /* the one declared surplus-height sink */
.footer { align-self: end; }
```

No other content section may use `align-content: center` to disguise a fixed
row. In review, outline every section: unexplained internal voids fail even if
the total page looks balanced.

## 5. Alignment spine

Choose one primary left edge and use it for masthead, title, body, labels,
images, facts, contact, and footer. Secondary edges must be declared column
starts—not hand-tuned indents.

Tints and images may bleed outward; their content does not drift inward:

```css
.tinted-section { position: relative; }
.tinted-section::before {
  content: "";
  position: absolute;
  z-index: 0;
  inset: 0 calc(-1 * var(--page-inset));
  background: var(--color-bg-elevated);
}
.tinted-section > * { position: relative; z-index: 1; }
```

Align optically, not merely mathematically: inspect cap height, round glyphs,
icons, rules, and image subjects at 100% print size. Display quotations may use
`hanging-punctuation: first`; browser support is uneven, so verify the PDF and
fall back to a controlled negative text indent rather than shifting the whole
section.[9]

## 6. Editorial separation over web-card containment

A press one-sheet is a page, not a dashboard.

- Prefer `24–32px` whitespace plus a `0.5pt` or `1px` hairline rule between
  sections.
- Do not wrap members, releases, metrics, and contact details in nested rounded
  cards. Group through grid position, typography, and rules.
- Reserve `--color-bg-elevated` for **one** load-bearing element or band per
  page (for example, the release proof block). Everything else stays on the
  dark page ground.
- Avoid shadows, pills, and radii unless the object itself requires them. A
  label is usually text; a fact is usually a line, not a component.

## 7. Images for print

The platform acceptance rule is **300 source pixels per inch at final printed
size after crop**. Image dimensions and resolution are separate: resolution is
pixels per inch, while resampling adds/removes pixels.[10]

```text
required source width  = printed width in inches  × 300
required source height = printed height in inches × 300
```

Examples: a `4in × 3in` crop needs at least `1200 × 900px`; an `8.5in` full-width
hero needs at least `2550px` across at trim, or `2625px` across if its source
must cover an `8.75in` bleed width.

- Define the print frame's aspect ratio first; crop the source to that ratio.
- Evaluate the **remaining cropped pixels**, not the uncropped file dimensions.
- Never stretch to fit. Use `object-fit: cover` plus an intentional persisted
  crop/focal point.
- Do not upscale a low-resolution web derivative and call it print-ready.
- Prefer lossless/vector logos and QR codes. Inspect the exported PDF at 100%
  and a zoomed raster check for interpolation or compression artifacts.

## 8. QR codes for print

There is no universal physical minimum independent of encoded data: final size
is `(symbol modules + quiet-zone modules) × module size`. DENSO WAVE requires a
clear **four-module quiet zone on every side** and shows size calculated from
module count and printer resolution.[11]

S/NC's conservative one-sheet rule:

- QR footprint including quiet zone: **at least `0.8in × 0.8in`**
  (`57.6pt`, `76.8px` at 96px/in).
- Each printed module: **at least `0.4mm`**. If the generated code is dense
  enough to make modules smaller at `0.8in`, enlarge the whole code.
- Preserve a white/high-contrast quiet zone of four modules; no border, text,
  image, or tinted band may enter it.
- Export as SVG/vector or a 1-bit raster at sufficient resolution; never blur,
  round, recolor individual modules, or place a logo over the code.
- Encode a short, stable, **customizable creator URL**. Default to the creator's
  Linktree when no destination is configured; print the human-readable URL
  beside the QR so the page survives scanning failure.
- Use error-correction **M (about 15%)** by default. Use Q (about 25%) only for
  likely wear/damage or difficult print conditions. Higher correction adds
  codewords and can make the symbol denser/larger; it does not excuse a small
  code or broken quiet zone.[12]
- Test the final PDF at actual printed size with at least two phone cameras,
  not only the on-screen HTML preview.

## 9. Print pre-flight — required before “done”

A generator must satisfy this list; an adversarial reviewer must independently
check it.

### Geometry

- [ ] `@page { size: letter portrait; ... }` is present.
- [ ] Final trim is `8.5in × 11in`; CSS canvas math is `612 × 792pt` / `816 × 1056px`.
- [ ] The chosen `@page` margin and `.sheet` dimensions do not double-count margins.
- [ ] Critical content is inside the declared safe area.
- [ ] A bleed claim includes `0.125in` artwork beyond trim, crop/trim handling, and print-provider confirmation.

### Grid and rhythm

- [ ] A 6- or 12-column grid, gutter, and content spans are explicitly defined.
- [ ] A `4px / 3pt` baseline is defined; line-heights and vertical spacing snap to it.
- [ ] Every layout gap comes from `4 / 8 / 12 / 16 / 24 / 32px` (plus `48px` page inset); no arbitrary gaps.
- [ ] Sections use intrinsic height; text-bearing rows have no fixed heights.
- [ ] Surplus page height exists only in one named buffer before the footer.
- [ ] No section uses centering to trap whitespace around undersized content.

### Type and alignment

- [ ] Body/prose is at least `7.5pt / 10px`; metadata is at least `6.5pt / 8.67px`.
- [ ] Body measure is 45–75 characters and leading is 120–145%, snapped to 4px.
- [ ] Georgia/Inter are proofed at actual print size, not judged only in a scaled browser.
- [ ] All section content follows one left alignment spine; secondary starts match declared columns.
- [ ] Optical corrections do not move whole sections off the spine.

### Editorial composition

- [ ] Whitespace and hairlines provide the default separation.
- [ ] There are no nested-card containers or dashboard-style pill fields.
- [ ] Elevated background color is reserved for at most one load-bearing page element.
- [ ] Dark-page output has been checked for non-bleed white rims and color/contrast in the actual PDF.

### Assets and output

- [ ] Every photo has at least 300ppi after crop at final output dimensions.
- [ ] Crop ratio and focal point match the printed frame; no image is stretched.
- [ ] QR is at least `0.8in`, keeps four quiet modules, meets `0.4mm/module`, and scans from a printed proof.
- [ ] QR destination is customizable (default creator Linktree) and a readable fallback URL is printed.
- [ ] Export is Letter at 100% scale with browser headers/footers disabled; the PDF is visually inspected page by page.

## Sources

1. W3C, **CSS Paged Media Module Level 3** — page box/area, printable-area model, `size`, margins, bleed, and marks: https://www.w3.org/TR/css-page-3/
2. W3C, **CSS Values and Units Module Level 4**, §6.1 — `1in = 96px`; `1pt = 1/72in`: https://www.w3.org/TR/css-values-4/#absolute-lengths
3. Adobe Illustrator User Guide, **How to add printer's marks and bleeds** — bleed as trimming margin of error and provider-specific production extent: https://helpx.adobe.com/illustrator/using/printers-marks-bleeds.html; Sterling Printing, **Guidelines for bleeds and cut lines** — `0.125in` per side and an inside safety margin: https://www.sterlingprinting.com/guidelines-for-bleeds-and-cut-lines.html
4. Josef Müller-Brockmann, **Grid Systems in Graphic Design**, Niggli — column and modular grid method.
5. Adobe InDesign User Guide, **Use a baseline grid** — baselines aligned across columns/pages and grid tied to leading: https://helpx.adobe.com/indesign/desktop/layout-and-grid-tools/grids/use-a-baseline-grid.html
6. Matthew Butterick, **Practical Typography: Point size** — print vs screen sizing; 10–12pt print body guidance; 6–8pt compact professional matter: https://practicaltypography.com/point-size.html
7. Matthew Butterick, **Practical Typography: Line spacing** — 120–145% leading: https://practicaltypography.com/line-spacing.html
8. Robert Bringhurst, **The Elements of Typographic Style**, 4th ed., Hartley & Marks — 45–75 character measure and typographic/optical alignment. See also Butterick's broader 45–90 range: https://practicaltypography.com/line-length.html
9. W3C, **CSS Text Module Level 4**, §9.2.1 — hanging punctuation behavior and overflow caveat: https://www.w3.org/TR/css-text-4/#hanging-punctuation-property
10. Adobe Photoshop User Guide, **Image size and resolution** — pixel dimensions, output dimensions, resolution, and resampling: https://helpx.adobe.com/photoshop/using/image-size-resolution.html; Smartpress, **PPI, DPI & image resolution** — 300ppi for small-format print and the final-inches × 300 calculation: https://smartpress.com/support/printing-basics/image-resolution
11. DENSO WAVE, **Point for setting the module size** — symbol-size formula and mandatory four-module quiet zone: https://www.qrcode.com/en/howto/code.html
12. DENSO WAVE, **Error correction feature** — L/M/Q/H tradeoff; M ≈15%, Q ≈25%, and higher correction increases symbol data/size: https://www.qrcode.com/en/about/error_correction.html

**House-rule provenance:** `0.5in` office safe area, `0.125in` standard bleed,
6/12 columns, the `4px/3pt` baseline, S/NC type floors, spacing scale, 300ppi
asset gate, and `0.8in`/`0.4mm-module` QR minimum are deliberately conservative
S/NC acceptance thresholds derived from the cited models. They are not claims
that every printer, typeface, image process, or QR payload has one universal
minimum. When a print provider's job specification is stricter, it wins.
