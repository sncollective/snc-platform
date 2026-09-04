# Typesetting toolchain landscape — template authoring side

First-pass survey (2026-09-03) for the press-kit platform's authoring lane:
professional typesetting input/output and programmatic/agentic template
authoring. Sources: web survey (Typst blog, speedata Publisher benchmark,
Figma/Adobe docs, npm/GitHub for the MCP tooling). Promotion candidate for
the research band if pursued further.

## The landscape, sorted by fit with our stack (TS/Bun + Chromium + CSS)

### Our pipeline is already a typesetting engine
The session's proof: deterministic single-page templates, fit-check
machinery, luminance-mapped placement, WYSIWYG image geometry — print-grade
output from CSS + headless Chromium. The authoring question is about
(1) a formal pagination substrate for growth, (2) an agent-native template
language, (3) professional file interchange.

### Typst — the agent-native candidate (strongest fit for agentic authoring)
- Plain-text markup + real programming language; the source IS the
  document — LLMs read/write it directly (the property that made our
  content-as-code work). MCP servers exist (typst-mcp et al.); the
  official blog positions automated generation as a first-class use case.
- Fast (0.3ms/page at scale per the speedata benchmark), tiny (vs LaTeX's
  >1GB), WASM-playable, modern accessibility story.
- Gaps: not CSS (a second template language to staff), younger ecosystem,
  CMYK/PDF-X output still maturing.

### Paged.js / Vivliostyle — the CSS-native formalization
- CSS Paged Media in the browser: page boxes, margins, running heads,
  counters — the standards-grade version of what our fit-check hand-rolls.
  Vivliostyle actively maintained (2026 updates); Paged.js is the polyfill
  approach used by publishing toolchains.
- Fit: extends OUR exact stack. Our single-page determinism was deliberate
  (the pin); multi-page templates (booklet EPKs, tour books) would inherit
  proper pagination primitives instead of building them.
- Gaps: browser RGB vs CMYK (print shops convert; lossy for saturated
  colors — same limitation our current pipeline already carries).

### IDML — the professional interchange (input/output pro files)
- InDesign Markup Language: XML, documented, no InDesign needed to
  read/write. `idmlkit` / `idml-mcp` (MIT, v0.1.0 — early): "AI-native
  toolkit — parse, summarize, safely write back." Community MCP servers
  for InDesign exist; Adobe's Firefly Services offers cloud InDesign
  scripting.
- Fit: this is the "input/output professional typesetting files" answer —
  pro designers author in InDesign, IDML bridges to our renderer (and
  back). Early tooling; the format itself is stable and well documented.

### Figma — agent-native authoring, wrong production grade
- Official MCP server (read/write designs, code connection) — genuinely
  agent-friendly. But print production is weak: RGB not CMYK, limited
  bleed/marks control, screen-grade PDF export (confirmed by print-for-
  Figma workarounds like printability.app existing as a business).
- Fit: a design-input layer (mood/layout exploration via MCP) that feeds
  our real typesetting pipeline — not the source of truth for print.

### Surveyed and declined
- **Scribus**: 1.6 stable, slow development, XML+Python but dated —
  connector not worth building.
- **LaTeX**: agent-friendly plain text but heavyweight, slow, accessibility
  liabilities; Typst is its modern successor for this niche.
- **speedata Publisher**: philosophically aligned (trial typesetting =
  our fit-check, "pages until a human checks" = our loud-overflow) but
  niche Go/Lua/XML stack; watch, don't adopt.

## Recommendation shape (for the design pass)
1. **Stay CSS-first** for template execution (our proven lane); adopt
   Paged.js/Vivliostyle concepts when multi-page templates arrive.
2. **Typst as the agent-authoring track**: templates as readable/
   writable Typst source, compiled in CI against the same capacity-
   contract tests — the most agent-native path to "author a variant."
3. **IDML interchange** via idmlkit-style tooling for professional
   import/export — the bridge if pro designers join the authoring side.
4. **Figma via MCP as design-input only**, never the print source.

All four compose: Figma explores → Typst/CSS authors → IDML interchanges →
our Chromium pipeline renders.

## Architecture decision (operator, 2026-09-03)

The Typst authoring harness is a **separate project** (operator's lane) —
platform takes Typst as a template-input track rather than containing the
authoring workflow. Platform's lane: template registry + ingestion, Typst
compile track (WASM) alongside the CSS/Chromium track, IDML interchange
for pro designers. The gate between the projects is a **template package
artifact contract**: Typst source + content-field schema mapping + measured
capacity contract + previews. Known cost, accepted: two render engines,
mitigated by typst-WASM in-process and the shared @snc/shared content
model feeding both tracks.

## Design authority regime (operator, 2026-09-03)

When pro designers join, the designer's artifact (InDesign via IDML) becomes
the design source of truth; pipelines conform toward it. Coder-regime
(Typst originates design) and designer-regime (IDML originates; Typst/CSS
implement) both gate through the same capacity contracts. Conformance is
enforced by render-fidelity checks: template output at fixed test content
compared against the designer's artifact (extract-and-compare, luminance
checks). The style grammar card is the shared designer/implementation
vocabulary. IDML snapshots express design intent at fixed content;
templates are the functions producing that design across varying content —
the variant contract declares the behavior at every content volume.
