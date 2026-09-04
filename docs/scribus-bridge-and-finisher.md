# Scribus — bridge, finisher lane, and the SLA question

Follow-up deep-dive on the Scribus entry from
[typesetting-toolchain-landscape.md](typesetting-toolchain-landscape.md),
prompted by two operator inputs (2026-09-04): stretch-goal interest in
Scribus as an interchange target beyond IDML, and the operator's existing
board-game production flow (scribus-generator mail merge + Python Scripter
outputs). All version-sensitive claims verified against primary sources,
listed at the end.

## Questions

1. Is `.sla` a viable parse/generate interchange target?
2. Does Scribus's IDML import make our planned IDML export a one-way bridge?
3. What does programmatic Scribus cost (Scripter API, CLI, MCP)?
4. What does Scribus uniquely offer that the RGB Chromium pipeline lacks?
5. Is the first survey's "slow development" note still accurate?
6. Is there a viable open-source GUI DTP alternative?

## Verified version picture (2026-09)

Authoritative source: the project ChangeLog. Dual-track releases in
lockstep (even minor = stable, odd minor = dev):

| Track | Releases | Latest |
|---|---|---|
| Stable 1.6.x | 1.6.0 (2024-01-01) → 1.6.4 (2025-04-20) → 1.6.5 (2025-12-14) → **1.6.6 (2026-04-13)** | 1.6.6; 1.6.7 unreleased |
| Dev 1.7.x | 1.7.0 (2025-01-25) → 1.7.1 (2025-12-14) → 1.7.2 (2026-01-09) → **1.7.3 (2026-04-13)** | 1.7.3; 1.7.4 unreleased |

Corrections vs the first survey and press coverage:

- **Development is active**, not slow — three dev point releases in four
  months, stable patches in lockstep. The survey note is retired.
- **PDF/X-4 is not new in 1.6.0** — it landed in the 1.5.7/1.5.8 dev era;
  1.6.0 (Jan 2024) was the first stable to carry it. Critically, 1.6.4
  (Apr 2025) fixed "Exported PDF/X-4 not read by Adobe Acrobat and
  Microsoft Edge" — **pin ≥ 1.6.4 for PDF/X-4 work**; current 1.6.6
  qualifies.
- **IDML import also predates 1.6** (changelog fixes in 1.5.6/1.5.8) —
  two-plus years of stable-track presence.

Documentation strata (the version maze): the wiki carries a 1.4-era file
format spec (self-declared incomplete, no newer page) plus old release
notes; the readthedocs manual self-labels "Scribus 1.8 Manual" (WIP — the
manual for the stable that dev 1.7.x will become); the homepage carries
almost no version information. Three generations, no current format
reference.

## SLA as a format target — declined (sharpened)

- No public spec beyond the 1.3.5–1.4 wiki page; the de facto documentation
  for the current format is the C++ loader itself
  (`plugins/fileloader/scribus150format/`).
- Project's own stance since 2012 (forums): *"parsing \*.sla is not
  recommended since the structure might change. Scripter is the preferred
  route."*
- 1.7.1 (2025-12-14) renamed core elements/attributes undocumented —
  `ITEXT`→`Content`, `PAGEOBJECT`→`PageObject`, `CH`→`Chars`,
  `PTYPE`→`PageType` (GitHub issue #207 asks for published change lists;
  the changelog only shows "Create 1.7.1+ file format loader to support
  new format changes").
- Historical corroboration of the hazard: 1.6.0's "Scribus silently
  upgrades your file to the new format" bug entry; 1.7.0 added a partial
  File→Save-As-older-version mitigation.
- PyScribus (the one read/generate/update SLA library, AGPLv3+) is
  dormant: repo tags stop at v0.3, Aug 2023 — predates the 1.7.1 renames
  by ~2.4 years.

## The bridge: IDML export → Scribus import — adopted

- Scribus's import plugin parses standard `idPkg:Fonts/Graphic/Styles/
  Preferences/MasterSpread` packages (importidml.cpp).
- The Aug 2026 forum report "IDML import is a show-stopper" decomposes
  into variable fonts (systematic — Scribus does not implement them) and
  an undiagnosed image case. Our machine-generated IDML with our own
  static fonts and explicit image links sidesteps the systematic failure.
- **Acceptance criterion for the IDML spike:** generated IDML opens
  correctly in Scribus 1.6.6 (stable track, the operator's lane);
  optionally re-check on 1.7.3.

## The finisher lane — adopted

- Scribus's unique strength vs our stack: PDF/X-4 export, ICC color
  management, CMYK — confirmed in production prepress use, including
  card-game-for-print workflows. Chromium is RGB; Typst's CMYK story is
  still maturing.
- Workflow: platform → IDML → operator finishes in Scribus → PDF/X-4 out.
  This is the design-authority regime with the operator in the designer
  chair; conformance via the existing render-fidelity checks.
- Pin ≥ 1.6.4 for PDF/X-4 (the Acrobat/Edge interop fix).

## Programmatic surface — watch, upgraded

scribus-mcp (community, actively developed) drives the Scripter API over
MCP: validated end-to-end on Scribus 1.7.3/Win11 and 1.6.3/Debian; ~140
Scripter functions work on both tracks; headless mode spawns a fresh
`scribus -g -py` per call (xvfb required on display-less Linux; a
startup-dialog papercut needs a workaround script). This is the
sanctioned programmatic surface — Scripter, not SLA parsing — and of
direct interest to the operator's board-game lane independently of
platform. Watch, not build: per-call process spawn and GUI-app internals
sit poorly with our determinism discipline; revisit if finisher
automation becomes a real bottleneck.

## Alternatives (question 6)

Production-grade open-source GUI DTP remains Scribus alone. 2026-era
entrants are all early: Pressable (browser DTP, Rust/WASM core, PDF/X,
auto-layout wizard — commercial; worth a watch line), Open Publisher
(Feb 2026, very small), BDoc Editor (book-restoration niche), Laidout
(imposition niche), Varve (v0.2 beta). The programmatic lane is unaffected
— the Typst decision stands. There is no better "different option" to
switch to; the question is only where Scribus plugs in.

## The operator's board-game lane — recorded as design input

Existing flow (runs outside platform today): spreadsheet of cards →
scribus-generator mail merge into a Scribus template → Python Scripter
programmatically outputs print-and-play PDFs and Tabletop Simulator
card-deck PNGs.

Structural rhymes with the platform press lane: content-as-data
(spreadsheet ↔ PressContent), data-merge into a designer template
(generator ↔ template render), designer artifact as source of truth
(SLA template ↔ designer-regime IDML), text-fitting capacity (card text ↔
variant capacity contracts), multi-target render with per-target geometry
(PnP PDF + TTS deck sheets ↔ print/web twins + per-slot image specs).

**Design constraint for the template-integration lane:** the template
package artifact contract and its content-field schema mapping stay
domain-neutral — a card-deck content model must fit the contract without
PressContent-specific assumptions. Boundary: the board-game lane consumes
concepts and data shapes, not platform code; no SLA target (declined
above); Scribus reached via IDML import + Scripter.

## Recommendation

Adopt B (bridge criterion folded into the IDML spike) + C (finisher
workflow, pinned ≥ 1.6.4). Decline A. Watch D with scribus-mcp named as
the surface and its xvfb/per-call-spawn cost noted.

## Reference skill

Deferred: Scribus stays operator-side with no platform code surface, so an
`.agents/skills/` reference becomes warranted only if the finisher
workflow or Scripter automation turns code-bearing.

## References

- ChangeLog (primary release table): https://github.com/scribusproject/scribus/blob/master/ChangeLog
- Issue #207 — undocumented 1.7.1 SLA renames: https://github.com/scribusproject/scribus/issues/207
- Wiki file format spec (1.3.5–1.4, incomplete): https://wiki.scribus.net/canvas/File_Format_Specification_for_Scribus_1.4
- 2012 "don't parse SLA" stance: https://forums.scribus.net/index.php/topic,718.0.html
- PyScribus v0.3 + repo tags: https://pypi.org/project/pyscribus/ · https://framagit.org/etnadji/pyscribus/-/tags
- IDML import thread (variable fonts): https://forums.scribus.net/index.php/topic,7015.0.html
- IDML import plugin source: https://github.com/scribusproject/scribus/blob/master/scribus/plugins/import/idml/importidml.cpp
- scribus-mcp: https://github.com/caewa/scribus-mcp
- Release coverage: 9to5linux (1.6.0, Jan 2024) · linuxcompatible.org (1.6.6 + 1.7.3, Apr 2026)
- Manual versioning: https://scribus-manual.readthedocs.io/ ("Scribus 1.8 Manual", WIP)
