# Session note — press-kit template integration: Scribus evaluation → epic decomposition (2026-09-04)

For the next session's agent. Short session, all platform-lane, no campaign
involvement: continuation of the press-support arc (read the 2026-09-03
session note + retrospective first — their rules of thumb inherit in full).

## What happened

1. **Scribus deep-dive** (operator stretch-goal question → research pass,
   verified against primary sources): `docs/scribus-bridge-and-finisher.md`
   + landscape-doc correction (commit f8e1cde). Outcome: SLA declined as a
   format target (undocumented churn — 1.7.1 renamed core elements; no
   public spec beyond the 1.4-era wiki page; PyScribus dormant since Aug
   2023); survey's "slow development" corrected (dual-track lockstep
   1.6.6 stable / 1.7.3 dev, both 2026-04-13); **IDML bridge adopted**
   (our generated IDML opens in Scribus 1.6.6 — spike criterion) +
   **finisher lane adopted** (Scribus ≥1.6.4 for PDF/X-4/CMYK physical
   print); scribus-mcp on watch (validated on both tracks; Scripter, not
   SLA parsing). Version-maze warning for future agents: the wiki carries
   1.4-era strata; the readthedocs manual is "1.8" WIP = next stable, not
   shipped; pin claims to the project ChangeLog.
2. **Board-game lane input**: operator's flow (spreadsheet →
   scribus-generator → Python Scripter → PnP PDFs + TTS deck PNGs) mapped
   structurally onto the press lane; parked as
   `idea-boardgame-scribus-lane-reuse` (a231452). Design constraint it
   produced: the template package artifact contract stays domain-neutral
   (card-deck model fits without PressContent assumptions).
3. **Epic scoped + decomposed**: `press-kit-template-integration`
   (4d3e62e) → five children (098331f), stage implementing:
   - `press-kit-template-primitives-compiler` — deps `[]` — tokens/** to
     data; CSS vars byte-compatible + Typst defs + IDML swatches
   - `press-kit-template-registry` — deps `[]` — declarative registry;
     ports the four hand-wired PDF products; per-slot geometry + capacity
   - `press-kit-template-typst-track` — deps `[primitives]` — typst-WASM
     spike (determinism + capacity measurability) then minimal lane
   - `press-kit-template-idml-interchange` — deps `[primitives]` — IDML
     parse/write + Scribus 1.6.6 criterion
   - `press-kit-template-artifact-contract` — deps `[registry, typst,
     idml]` — package contract + ingestion; render-manifest ≡ capacity/
     previews as ONE mechanism; domain-neutrality test

## Decisions on record

- Sibling-not-parent: the two debrief-scoped features
  (`press-kit-template-picker-and-image-specs`,
  `press-kit-programmatic-surface`) keep their briefs; coordination points
  live in child briefs, no depends_on freezing.
- CSS/Chromium stays the execution lane; Typst is an input track.
- No SLA target ever; Scribus via IDML import + Scripter only.
- Spikes embedded as spike-first features (criteria = first implementation
  units).

## Where to pick up

`feature-design` on the two ready children (primitives-compiler,
registry). The primitives pass is where tooling gets installed (typst-WASM
bindings) and real IDML samples get pulled. Decomposition risks live in
the epic body (capacity-vocabulary drift across features is the one to
watch; the contract feature owns reconciliation).

## Repo state

All on platform `main`, pushed this session. Parent SNC repo got the
submodule pointer bump only (its other dirty files are unrelated in-flight
work — left untouched).
