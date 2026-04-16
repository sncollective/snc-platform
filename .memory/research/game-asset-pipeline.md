---
updated: 2026-04-16
---

# Game Asset Production Pipeline (March 2026)

Research into tools and approaches for a board game card asset production pipeline. Evaluated for S/NC's game publishing workflow: structured card data → templated rendering → print/digital/community outputs.

## Current Workflow & Pain Points

Google Sheets (card data) → Python scripts → ScribusGenerator (Scribus plugin) → PDF/PNG. Custom symbol font creation from SVGs via FontForge + Inkscape. Token substitution (^tap^ → character in symbol font) not yet coded.

**Pain points:**
- SVG → custom font creation is tedious and fragile (FontForge + Inkscape manual workflow)
- Scribus documentation is fragmented across versions (1.4.x/1.5.x/1.6.x wikis layered)
- Headless rendering unreliable (xvfb hack, not a supported feature)
- No unified interface combining data editing, art management, and rendering

## SVG-to-Font Pipeline

### Tool Comparison

| Tool | License | Ligature Support | Automation | Notes |
|------|---------|-----------------|------------|-------|
| **svgtofont** | MIT | Yes — filenames become ligatures | CLI/Node.js | Best option. `ligatures: true` flag. Name `tap.svg` → typing "tap" renders icon. |
| **fantasticon** | MIT | No | CLI/Node.js | Most popular (54k weekly), but no ligatures. Codepoint-mapped only. |
| **svgicons2svgfont** | MIT | Yes — via naming convention | Library | Engine under svgtofont and fantasticon. Lower-level. |
| **ligscrib** | MIT | Yes — purpose-built | Library | Specialized ligature icon font generator. Fallback if svgtofont insufficient. |
| **fonttools** | MIT | Yes — programmatic GSUB tables | Python | Maximum control. ~100-200 lines to build "SVG dir → font with ligatures". |
| **FontForge scripting** | GPL-3.0 | Yes — addLookup API | Python | Full automation possible but requires FontForge installed. GPL implications. |
| **IcoMoon** | Free/paid | Yes — per-glyph assignment | Web UI | Good for manual use, not scriptable for CI/CD. |
| **Fontello** | MIT | No (open issue since 2017) | Web UI | Not suitable. |

### Recommended Approach

**svgtofont** with `ligatures: true` is the practical starting point:

```bash
npx svgtofont --sources ./icons --output ./font --fontName GameIcons --ligatures
```

Name SVG files after their token: `tap.svg`, `fire.svg`, `credit.svg`. Typing "tap" in the font renders the tap icon. No pre-processing needed.

Enable in CSS:
```css
@font-face {
  font-family: 'GameIcons';
  src: url('game-icons.woff2') format('woff2');
}
.card-text {
  font-family: 'GameIcons', 'CardBody', sans-serif;
  font-feature-settings: "liga" 1;
}
```

This is the same approach Google Material Icons uses at scale. The "Sans Bullshit Sans" project demonstrates the fonttools approach for maximum control (SVG glyphs → PUA codepoints → GSUB ligature table).

For mixed-font rendering (body text + icons): CSS font stacking with `unicode-range` targeting PUA codepoints, or merge icon glyphs into the text font via fonttools.

## Scribus Assessment

### Verdict: Not viable for automated pipelines

- **No real headless mode** — requires X display, xvfb is a hack not a supported feature
- **CLI PDF generation is second-class** — ScribusGenerator generates SLA files from CLI, but PDF export requires a separate script through `scribus -g -py to-pdf.py`
- **Per-character font switching** works via Python API (`selectText` + `setFont`) but is fragile and slow
- **Documentation** spans 1.4.x (Python 2, no OpenType) through 1.6.x (Python 3, OpenType ligatures since 1.5.3) with conflicting information
- **No trajectory toward server-side use** — headless has been "in progress" for years
- **1.6.x** (Dec 2024) is the current stable with OpenType support — use this version if using Scribus at all

Scribus is a desktop DTP application. It can be forced into server use but every piece is held together with tape. For a production pipeline processing hundreds of cards, look elsewhere.

## Rendering: HTML/CSS → PDF/PNG

### WeasyPrint (recommended)

Python HTML/CSS → PDF renderer. Uses Pango for text layout and HarfBuzz for OpenType shaping.

**Print capabilities (v67.0+):**
- `@font-face` with full OpenType feature support including `font-feature-settings: "liga" 1` — icon font ligatures work natively
- `@page { size: 2.5in 3.5in; bleed: 3mm; marks: crop; }` — card dimensions with print marks
- CMYK color support (recent addition)
- `bleed` and `marks` CSS properties for crop/cross marks
- Font embedding and subsetting in PDF output
- CSS Grid layout for card zones
- PDF/A compliance

**For card games:**
```css
@page card {
  size: 2.5in 3.5in;
  bleed: 3mm;
  marks: crop;
}
.card { page: card; }
```

### Puppeteer/Playwright (alternative)

- Custom `@font-face` works (base64-encode fonts as data URIs for reliability in headless mode)
- 300 DPI via `deviceScaleFactor` or viewport sizing (750x1050px for poker cards at 300 DPI)
- No native CMYK — post-process via Ghostscript with ICC profiles
- No native bleed/trim marks — must be CSS-implemented
- ~200-500ms per card screenshot, parallelizable
- Advantage: exact WYSIWYG match between browser editor and export

### Comparison

| Feature | WeasyPrint | Puppeteer |
|---------|-----------|-----------|
| Bleed/trim marks | Native CSS | Manual CSS |
| CMYK | Native (recent) | Ghostscript post-process |
| Custom fonts + ligatures | Yes (Pango/HarfBuzz) | Yes (@font-face) |
| Editor ↔ export fidelity | Minor reflow differences | Exact match |
| JavaScript in templates | No | Yes |
| Print quality | Excellent | Excellent |
| Dependencies | Python + system libs | Chrome/Chromium |

**Recommendation:** WeasyPrint for the render pipeline (native print features). Browser preview uses the same CSS with minor rendering differences. If exact WYSIWYG fidelity is required, use Puppeteer for both and accept Ghostscript for CMYK.

## Dedicated Card Game Tools

| Tool | License | Status | Notes |
|------|---------|--------|-------|
| **Squib** | MIT | Stalled (last release Apr 2023) | Ruby DSL, Cairo/Pango rendering, bleed/safe zones, sprue sheets. Good for prototyping. |
| **CardPen** | Open source | Active | Browser-based, Mustache templates + CSV + CSS. Client-side only. |
| **nanDECK** | Closed source | Active | Windows only. Board game community standard. Reference only. |
| **HCCD** | Open source | Active | Java, HTML/CSS + CSV, auto-regenerates contact sheets. Simple. |
| **Jubbly Card Creator** | MIT | Minimal (11 commits) | Browser-based, Alpine.js + CSV + HTML/CSS. Proof of concept. |

None of these are suitable as a production cooperative pipeline. The HTML/CSS + WeasyPrint approach is more capable and maintainable.

## Web Editor → Render Pipeline Architecture

```
PostgreSQL (card data) + S3 (art assets)
         |
    API (JSON card data + asset URLs)
         |
    +----+----+
    |         |
  Web Editor  Export Pipeline
  (browser)   (server)
    |         |
  Same HTML/CSS template
  + @font-face (icon font with ligatures via svgtofont)
  + Handlebars/EJS placeholders
    |         |
  Live preview  Puppeteer renders at 300 DPI
  in browser    + Ghostscript CMYK conversion
    |         |
  WYSIWYG     Output targets:
              - Individual card PNGs (300 DPI, 1/8" bleed)
              - Print-ready CMYK PDF (Delano manufacturing)
              - TTS sprite sheet (grid PNG)
              - Digital PNGs (web/community tools)
```

This architecture is proven — Google Material Icons (ligature fonts), Bannerbear/APITemplate.io (HTML-to-image) all use variants of this pattern.

## Template Authoring

The pipeline renders HTML/CSS templates. The open question is **how those templates get created** — this is where the tradeoff between designer control and automation lives. The right approach depends on the game's visual complexity, which hasn't been decided yet.

### Approach A: Code-First Templates

A developer or CSS-literate designer writes card templates directly as HTML/CSS with placeholder slots for data fields. Non-technical creators fill in card data via the web editor but can't modify the layout.

**Tradeoffs:**
- Fastest to build the pipeline — no template editor UI needed
- Full CSS control (Grid, Flexbox, custom properties, media queries)
- Limits template creation to people who know HTML/CSS
- How most open-source card generators work (Squib, CardPen, nanDECK)
- Good enough if: one developer/designer creates templates, many creators fill them with data

### Approach B: Curated Templates with Parameters

Ship a set of well-designed card templates (standard TCG layout, Euro-game layout, etc.) with exposed customization points — colors, fonts, zone proportions — via CSS custom properties. Creators pick a template and adjust parameters through a settings UI, not a full editor.

**Tradeoffs:**
- Accessible to non-technical creators for customization (color picker, font selector, slider for text area size)
- Still requires a CSS-literate author for new template creation
- 80/20 approach — covers most card game layouts without a visual editor
- Good enough if: the game has a defined visual language and templates rarely change

### Approach C: External Design Tool → Pipeline

A graphic designer creates card templates in a visual tool (Scribus, Inkscape, Figma), then the template is translated into HTML/CSS for the pipeline. The designer works with full typographic and layout control; the pipeline consumes the result.

**Tradeoffs:**
- Designers keep their full toolset — no capability loss
- Translation step (design → HTML/CSS) is manual work, either by the designer (if CSS-literate) or a developer
- Changes in the design tool require re-translation — no automatic round-trip
- Most realistic for complex, designer-driven card layouts
- Good enough if: a designer creates the template once (or rarely), and the pipeline handles hundreds of cards from it

**Tool-specific notes for this approach:**
- **Figma:** Figma's Dev Mode exports CSS for any element. Auto-layout maps to CSS Flexbox. A Figma frame can be translated to HTML/CSS semi-automatically, though text flow and dynamic content length need manual adjustment. Figma plugins could potentially automate more of this.
- **Inkscape:** SVG output can be embedded in HTML or used as template backgrounds. Less direct path to HTML/CSS text layout.
- **Scribus:** No clean export to HTML/CSS. Would need a full manual re-implementation. Scribus's strength is in its visual editing, not in interoperability.

### Approach D: Visual Template Editor (Browser-Based)

Build a drag-and-drop card layout builder in the browser — Canva-lite for card templates. Output is HTML/CSS that the pipeline renders.

**Tradeoffs:**
- Most accessible — any creator can design templates visually
- Enormous engineering effort (effectively building a page layout app)
- Competes with Figma, Canva, Scribus on their turf — hard to match their capability
- Typographic control will be limited compared to dedicated tools
- Good enough if: S/NC needs non-technical template creation at scale (many games, many designers)

### Recommendation

**Start with Approach A or B** — code-first or curated templates. These are buildable now and sufficient for the first game. Document the template format so that Approach C (external design tool) can be adopted when a graphic designer joins and needs full visual control. Approach D (browser editor) is a long-term aspiration, not an MVP requirement.

The critical insight: **the pipeline doesn't care how the HTML/CSS template was authored.** All four approaches produce the same artifact (an HTML/CSS template with data placeholders). The pipeline renders it identically. So the template authoring approach can evolve independently of the render pipeline — start simple, add visual tooling as the need and team grow.

## Community Tool Integration

### Card Data Shape

No universal standard exists. Every deckbuilder uses its own format, but the structure is consistent:

```json
{
  "id": "unique-identifier",
  "name": "Card Name",
  "type": "category",
  "text": "Rules text with [symbol] notation",
  "cost": 3,
  "set": "set-identifier",
  "image_url": "https://..."
}
```

Symbol notation varies: `[click]` (NetrunnerDB), `{T}` (MTG), `[reaction]` (ArkhamDB). Define a canonical format in PostgreSQL, write thin export adapters per platform.

### Export Targets

| Target | Format | Key Requirement |
|--------|--------|----------------|
| Deckbuilder webapp | JSON API | Card data + image URLs |
| Tabletop Simulator | Sprite sheet PNG + JSON save | Grid of cards as one image |
| OCTGN | XML set definition + card images | GUID per card |
| Cockatrice | XML card database | Name, text, type, stats |
| MakePlayingCards | Individual PNGs, 300 DPI, 3mm bleed, RGB | Per-card rendered images |
| DriveThruCards | PDF, 300 DPI, CMYK, PDF/X-1a, 1/8" bleed | Requires CMYK conversion |
| **Delano Games** | High-res PDF, CMYK, 300 DPI, 1/8" bleed | See Delano specs below |

### Delano Games Manufacturing Specs

Source: Delano File Preparation Guidebook (DSI-265 Rev 05_23).

**General requirements:**
- **Format:** High-resolution PDF (preferred). Also accepts native Adobe CC files packaged with links/fonts.
- **Color:** CMYK only. Do not use RGB. Spot colors (PMS) optional if arranged separately.
- **Resolution:** 300+ DPI for all continuous tone images.
- **Bleed:** 1/8" (0.125") past trim edge on all sides.
- **Safe zone:** 1/8" minimum from trim edge (3/16" preferred).
- **Black text:** 100% K only — not 4-color process black (avoids fuzzy edges).
- **Rich black** (large coverage areas): C60 M40 Y40 K100.
- **Fonts:** Must be embedded or outlined. Vector text only (no Photoshop rasterized type).
- **No JPEGs/GIFs/PICTs** — use high-res formats.

**Card-specific requirements:**
- **One page per card** in a multi-page PDF. Do NOT gang multiple cards on a single page.
- **Two PDFs per deck:** one for read/front sides, one for common/back sides.
- If common back is identical across all cards, back PDF can be a single page.
- **Card ordering:** Card 1 = first page of read document (read side up). Back document mirrors this order.
- **Common borders** placed on master page (same size/position on all cards).
- Die lines provided by Delano on a separate layer — do not modify.

**Other components** (boxes, boards, tuck boxes, tokens, rulebooks, foil packs, shippers) have their own die line templates provided by Delano. All follow the same CMYK / 300 DPI / 1/8" bleed rules.

**Toolchain implications:**
- Puppeteer renders RGB → Ghostscript CMYK post-processing is mandatory
- Ghostscript command: `gs -sDEVICE=pdfwrite -sColorConversionStrategy=CMYK -sOutputICCProfile=USWebCoatedSWOP.icc -o output.pdf input.pdf`
- Rich black (C60/M40/Y40/K100) and 100% K text rules need explicit handling in the CMYK conversion step
- Card export generates two multi-page PDFs per deck (fronts, backs) with page-per-card layout
- Same template CSS defines bleed (1/8"), safe zone (3/16"), and card dimensions

### Platform Strategy

The S/NC platform publishes the canonical card data via API. Community tools consume it directly instead of reverse-engineering scraped data. The same API serves:
- The web editor (CRUD)
- The render pipeline (read)
- Deckbuilder tools (read, public)
- Game rules reference (read, public)
- Community discussion (comments, errata, issues)

## Governance & Sustainability of Key Tools

Full audit at `.memory/research/tool-governance-audit.md`. Summary for tools specific to this pipeline:

| Tool | Bus Factor | Funding | Abandon Risk | Notes |
|------|-----------|---------|-------------|-------|
| **svgtofont** | 1 (Kenny Wong) | Volunteer | Medium-High | Solo maintainer with 300+ repos. Acceptable as build-time tool (not runtime). Fantasticon is a ready alternative; fonttools is the maximum-control fallback. |
| **WeasyPrint** | 2-3 (CourtBouillon) | Open Collective + NLnet grants + consulting | Low | Small French indie org, strongly aligned with cooperative values. BSD-3. Consider sponsoring. |
| **fonttools** | 3-5+ (community + Google employees) | Google employee time | Very Low | 27 years old, 174M monthly PyPI downloads. Industry standard. Safest bet in the stack. |
| **pg-boss** | 1 (Tim Jones) | Volunteer | Medium | 9 years active, MIT. Graphile Worker is the fallback. |

**WeasyPrint + fonttools** are the strongest governance matches for a cooperative — community-governed, clean licenses, no corporate capture risk. svgtofont and pg-boss carry single-maintainer risk but are both small enough to fork if needed.

## Key Decisions for Implementation

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Font pipeline | svgtofont with ligatures | One CLI command, SVG filenames become ligature triggers. MIT. Fallback: fonttools. |
| Render engine | Puppeteer + Ghostscript | Puppeteer renders RGB PDF/PNG (same engine as browser preview — exact WYSIWYG). Ghostscript converts to CMYK for manufacturing (Delano requires CMYK). No Python runtime needed — both are CLI tools in the Node.js stack. |
| Template system | HTML/CSS + Jinja2 | Same templates for browser preview and server export. |
| Card data storage | PostgreSQL JSONB or typed columns | Structured, queryable, API-servable. |
| Art storage | S3 (Garage) | Existing infrastructure. |
| Export queue | pg-boss | Same job queue as media pipeline. Reuse infrastructure. |
| Symbol font format | WOFF2 (web) + OTF (print) | svgtofont generates both. |

## References

- svgtofont: https://github.com/jaywcjlove/svgtofont
- fantasticon: https://github.com/tancredi/fantasticon
- fonttools: https://pypi.org/project/fonttools/
- Sans Bullshit Sans (ligature technique): https://pixelambacht.nl/2015/sans-bullshit-sans/
- WeasyPrint: https://weasyprint.org
- Squib: https://github.com/andymeneely/squib
- CardPen: https://cardpen.mcdemarco.net
- NetrunnerDB API: https://netrunnerdb.com/api/2.0/doc
- netrunner-cards-json: https://github.com/NetrunnerDB/netrunner-cards-json
- arkhamdb-json-data: https://github.com/Kamalisk/arkhamdb-json-data
- TTS Custom Deck docs: https://kb.tabletopsimulator.com/custom-content/custom-deck/
- MakePlayingCards specs: https://www.makeplayingcards.com/faq-photo.aspx
- DriveThruCards specs: https://help.drivethrupartners.com/hc/en-us/articles/12780748203543
- Google Material Symbols ligatures: https://developers.google.com/fonts/docs/material_symbols
