# .research/ Conventions — platform working contract

Operational conventions for platform's research substrate. This file is the band's **working
contract** — the shapes the author, the lint, and the query tooling all rely on — and the
surface the agentic-research plugin names as the substrate's contract.

<!-- ARD framework used under MIT license (Agentic Research Discipline, ARD v0.5.1).
     Copyright 2025–2026 Kevoun Nklisch. See https://code.s-nc.org/Kevoun/ARD for the
     canonical framework. Attribution carried from the retiring band rules
     (research-band-spec.md, research-band-catalogs.md, research-band-platform.md)
     at plugin adoption, 2026-06-10. -->

**Platform adopts ARD as a consumer, transitively through the agentic-research plugin.**
The framework architecture (anti-fabrication core, verification stack, control-space model,
data contracts) and the baseline catalogs (failure shapes, source classes, lint patterns,
adversarial/evaluator jobs, decision points, registration enums, provenance values) are
published at **ARD v0.5.1** by the agentic-research plugin's drift-fenced vendored kernel
copies (the plugin's `scripts/lint-citations.py`, `scripts/catalogs.json`, and
`skills/research-discipline/SKILL.md`). **Where this file and pinned ARD differ, pinned ARD
is authoritative.**

**Consumption model — plugin-only.** Platform carries no in-tree ARD kernel copy and no
ARD submodule. All kernel surfaces (lint, catalogs data, discipline bundle, templates) are
provided by the agentic-research plugin as an external tool installed alongside this
sub-project. The prior in-tree `ard-kernel/` vendor (v0.4.1, per the former decision
platform-0014) was retired at plugin adoption: the plugin now provides the same drift-fenced
kernel without a per-project copy to maintain, resolving the re-sync burden and the
standalone-clone concern (the plugin is treated as an external tool, not a path inside the
project tree).

**ARD version pin: v0.5.1** (consumed via the plugin's vendored kernel; the plugin's
`ard.json` carries the adoption record at `adopts.version`).

## Layout

```
.research/
  CONVENTIONS.md                        # this file — the band's working contract
  attestation/<handle>.md               # flat, per-source-handle — the citation anchor
  precis/<slug>.md                      # engagement-unit aggregations from raw
  analysis/                             # cross-source analytical work
    <topic>.md                          #   named-pattern catalogs, glossaries
    briefs/<slug>.md                    #   single-pass briefs (-landscape.md for surveys)
    campaigns/<slug>/                   #   multi-specialist + program bundles
    positions/<slug>.md                 #   research-time settled positions
    hypothesis/<arc>-ledger.md          #   working hypotheses + cross-arc ledgers
  reference/                            # source-direct only: raw fetches (gitignored),
    <corpus>/INDEX.md                   #   per-corpus INDEX + README
    input/                              #   ingest holding-spot
  bin/research-view                     # the plugin's query tool (installed)
```

**Down-gradient read rule:** `reference → attestation → precis → analysis`. A higher tier may
read lower tiers; never the reverse. Cite sources, not sibling syntheses (ARD SPEC §4.6, §10.2).

Raw fetches under `reference/` are gitignored; `INDEX.md` files, attestations, precis, and
analysis artifacts are tracked.

Platform's active band as of conversion (2026-06-10): 5 attestation files, 29 briefs under
`analysis/briefs/`, `.gitkeep` placeholders in `precis/` and `reference/` (no ingested corpus
yet). The band grows on demand; no corpus shapes have been formalized yet beyond the attestation
tier.

## Citation rule

`[handle]{N}` — `handle` resolves to `attestation/<handle>.md` (whose `source_handle:` must
match the filename stem); `N` resolves by number against the source's per-corpus
`reference/<corpus>/INDEX.md` entry when a reference corpus exists, or is used as a plain
ordinal when no reference corpus is maintained for that source. **Handles are unique** —
the lint flags `colliding-handle` when two or more attestations declare one `source_handle`.
**INDEX files are append-only** — assign the next integer to a new source; never renumber.

## Attestation frontmatter

### Normative minimum (ARD SPEC §4.2)

Attestations live at `attestation/<handle>.md`. The citation chain depends on these fields:

```yaml
source_handle: <handle>        # MUST equal the filename stem and the [handle] in citing prose
fetched: <YYYY-MM-DD>
source_url: <URL>              # one of source_url / source_path is required
# source_path: <local-path>   # for ingested / local sources
provenance: source-direct
```

Body: `## Paraphrased summary` (source argument in the agent's words) / `## Key passages`
(`>` blockquotes with source-internal anchors) / `## Structural metadata` (optional). A body
with **no `##` anchors and no `>` quotes is a thin attestation** (GR.5) — it cannot support
per-claim citation and the lint flags it.

### Extension fields in use on platform

Two optional fields are present on platform's existing attestations (both named as optional
properties in the kernel schema at ARD ≥ v0.5.0):

- **`source_class:`** — names the source class from the ARD baseline soft-enum (10 classes:
  `paper` / `book-chapter` / `essays` / `tool-doc` / `blog-post` / `github-readme` /
  `wiki-page` / `light-form` / `standard` / `talk-podcast`). Platform's current attestations
  use `blog-post` and `tool-doc`. The full class set and per-class handle conventions are in
  the plugin's `scripts/catalogs.json`.

- **`substrate_confidence:`** — engagement depth (`source-direct` / `search-summary` /
  `snippet-thin`; default-and-omitted is `source-direct`). Two of the five existing
  attestations carry `substrate_confidence: search-summary` to flag reduced-depth engagement;
  the other three omit it (implying `source-direct`). Downstream synthesis inheriting a
  non-`source-direct` attestation carries ARD's `{confidence: …}` per-claim marker.

### Per-source-class shapes (platform active classes)

#### `blog-post`
```yaml
---
source_handle: <author-or-venue>-<post-slug>
source_class: blog-post
source_venue: <venue or platform>
fetched: <YYYY-MM-DD>
source_url: <post URL>
provenance: source-direct
title: <post title>
author: <author or studio byline>
post_date: <YYYY-MM-DD>
---
```
`source_venue:` captures the venue without encoding it in `source_class:`. Platform current
examples: `direct-to-fan-funnel`, `iubenda-gdpr-double-opt-in`, `laylo-creators`,
`qr-at-shows-fan-capture`.

#### `tool-doc`
```yaml
---
source_handle: <tool-name>-<topic>
source_class: tool-doc
fetched: <YYYY-MM-DD>
source_url: <docs URL>
provenance: source-direct
tool: <tool name>
version: <version when fetched>
topic: <specific feature or page>
---
```
`version:` is load-bearing — tool docs revise frequently. Platform current example:
`tally-webhooks`.

Other source classes (paper, github-readme, etc.) are available from the plugin's catalogs
and extend on demand following the closed-with-extension recipe: coin an ad-hoc option,
document it inline at the point of use, surface for consolidation at ~3 independent uses.

## Position frontmatter shape

Positions live at `analysis/positions/<slug>.md`. They record research-grounded stances —
technology selections, consumption-model decisions, architectural commitments — at the
analysis tier. Rules and docs link to positions rather than restating their derivation.

```yaml
---
status: settled | held-neutral | held-pending-downstream
authored: <YYYY-MM-DD>
provenance: <brief note on the grounding — research brief, spike, or platform experience>
related:
  - to: <slug or artifact name>
    type: <grounds | contradicts | refines | extends | supersedes | ...>
    note: <optional one-liner>
revisit_if:
  - <checkable condition>
---
```

`status` values:
- **`settled`** — position is grounded, alternatives weighed, guard survives inline in the
  artifact. Change via in-place rewrite; name the rejected-path explicitly.
- **`held-neutral`** — a structural constraint defers a choice. Position holds until the
  blocking condition resolves; the position names the condition.
- **`held-pending-downstream`** — position is blocked on upstream work; explicit revisit
  condition is required.

Body convention: a brief statement of the position, the load-bearing rejected alternatives
with rejection reasons a future adversarial reader would need, and any go/no-go criteria
that were satisfied. No narrative history — current state only. Prose length proportional
to the complexity of the rejected alternatives (simple choices get one sentence; weighed
trade-offs get a table or bullet list).

## Engagement entry and handoff

Research engagements run through the **agentic-research plugin's `research-orchestrator`
skill**, which reads the `research_dials:` block from the commissioning `.work/` item
(`scope_authority`, `verification_rigor`, `intent`, `output_kind`). The discipline bundle
(the anti-fabrication core) is inlined into every authoring dispatch by the orchestrator —
platform carries no committed research agent definitions.

Emission back to `.work/` from `.research/` is gated by the **plugin's `research-handoff`
skill** (operator-confirmed; never auto-fires). Work items that drove a research engagement
carry cross-band edges in their frontmatter:

- `research_refs:` — list of attestation handles or analysis artifact slugs produced
- `research_origin:` — the work item that commissioned the engagement

## Lint invocation

The agentic-research plugin's `scripts/lint-citations.py` is the citation-chain lint. Run it
over the band's attestation and analysis tiers:

```sh
# from the project root
python3 <plugin-root>/scripts/lint-citations.py .research/analysis/ \
    --attestation-dir .research/attestation/ \
    --analysis-dir .research/analysis/ \
    --stats
```

Where `<plugin-root>` is the installed agentic-research plugin directory. The lint's
`--stats` flag adds the handle audit (by-handle/by-file deployment counts, colliding-handle
detection, filename ≠ `source_handle`). Default posture is warn-only; `--exit-code-on high`
blocks on `unresolved-handle` / `colliding-handle`.

Platform carries no `scripts/lint-citations.py` shim — invoke the plugin's lint directly.

## Discipline propagation

ARD's invariant (SPEC §5): the anti-fabrication discipline must travel into every
research-authoring sub-context. Platform's mechanism: the plugin's `research-orchestrator`
inlines the discipline bundle (from `skills/research-discipline/SKILL.md`, which vendors
`ard/kernel/discipline.md` verbatim) into each authoring dispatch. Platform carries no
committed research agent definitions with `skills:` frontmatter — the plugin composes role
briefs into dispatches instead.

The prior mechanism — `skills:` frontmatter injection into committed `.claude/agents/`
definitions (`research-specialist`, `adversarial-reader`, `evaluator`) — was retired with
those agent definitions when the discipline propagation rewrote to plugin-inline-dispatch
(2026-06-10). The committed-agents + skill-injection mechanism is the known-good fallback,
recoverable from git history, if inline-into-dispatch propagation proves unreliable.

## Platform-specific deployment notes

### Tier 3 trade-offs (from retiring `research-band-platform.md`)

Platform's research band operates at Tier 3 of the ARD adoption ladder: single-pass briefs,
standard verification (lint + adversarial-read), no multi-specialist campaigns yet. The
trade-off is accepted: the band's 29 existing briefs are single-pass; `analysis/campaigns/`
is present but carries only a `.gitkeep` placeholder. Revisit when: platform research scales
into multi-specialist decomposition (populate `campaigns/` and confirm the `evaluate` gate is
wired), or a platform-domain failure shape reproduces ~3× (coin it into the catalogs via the
extension recipe and consider surfacing it upstream to ARD).

No `primitives_extends:` / `primitives_opts_out:` declarations are committed at the platform
level yet. Engagement-specific extensions are recorded in-engagement per the closed-with-extension
recipe.

### Raw-layer retention

Reference raws are gitignored regardless of source class — platform tightens the ARD
per-class IP profile (more restrictive retention), never loosens it. The tracked attestation
body follows the five-component write-discipline. `light-form` sources are paraphrase-only
(no verbatim posts; PII risk).

### Source-direct vs reduced-substrate attestations

Two of the five existing attestations carry `substrate_confidence: search-summary` — these
were authored from search summaries, not primary source fetches. The header comments in those
attestation files call out which key passages are search-summary-reported and unverified at
source. Downstream synthesis citing these must carry `{confidence: search-summary}` per-claim
markers.

## MIT attribution

ARD (Agentic Research Discipline) is MIT-licensed. This working contract, and the research
practice it describes, adopts ARD under that license.

Copyright 2025–2026 Kevoun Nklisch.
License: MIT — https://code.s-nc.org/Kevoun/ARD/raw/branch/main/LICENSE

The prior in-tree vendor surfaces (`research-band-spec.md`, `research-band-catalogs.md`,
`research-band-platform.md`) that carried this attribution have been retired; this file is
their successor and inherits the attribution obligation.

## Revisit if

- The plugin's ARD version bumps (the `adopts.version` in the plugin's `ard.json` changes) —
  re-read the release notes and update this file if the pin statement, extension fields, or
  lint invocation form changes.
- Platform research scales from single-pass briefs into multi-specialist campaigns — populate
  `analysis/campaigns/` and confirm the `evaluate` gate is wired.
- A platform-domain failure shape or source class reproduces ~3× — coin it into the catalogs
  via the extension recipe and consider surfacing it upstream.
- The plugin's engagement entry surface changes (skill name, dial vocabulary) — update
  §Engagement entry and handoff.
- A new source class becomes active on platform — add its per-class frontmatter shape here.
