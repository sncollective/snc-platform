---
status: settled
authored: 2026-06-10
provenance: agent-synthesis
revisit_if:
  - Platform research scales from single-pass briefs into multi-specialist campaigns — populate analysis/campaigns/ and confirm the evaluate gate is wired
  - A platform-domain failure shape or source class reproduces ~3 times — coin it into the catalogs via the extension recipe and consider surfacing it upstream to ARD
  - Standalone-clone self-containment is no longer a goal for platform — relax the no-escaping-links constraint
  - The plugin's ARD version bumps significantly — re-read the release notes and update the working contract in .research/CONVENTIONS.md
---

# Position: platform adopts .work/ and .research/ output bands, managed via plugins

**Status: settled.** Platform adopted both output bands alongside the substrate band, and
subsequently converted both to plugin-managed posture. The bands are now in their operational
state.

## The stance

Platform holds three persistent-state bands:

- **`.work/`** — work items (output-class), managed by the agile-workflow plugin. Active
  items, backlog, releases, archive.
- **`.research/`** — research output (output-class), operationalizing ARD v0.5.1 via the
  agentic-research plugin's drift-fenced vendored kernel. Reference, attestation, precis,
  analysis.
- **`.memory/`** — internal substrate: sessions, scratchpad, agents.

The working contract for `.research/` is `.research/CONVENTIONS.md`. The working contract
for `.work/` is `.work/CONVENTIONS.md`.

### Why both bands were adopted

Platform held ~20 active items, 168 backlog items, 3 release bundles, and 28 research
artifacts before the split was formalized — it had earned both output bands outright. Keeping
items and research under `.memory/` perpetuated split-brain against the output-namespace
structure and left items invisible to output-class tooling (tag views, release tooling).

### Self-containment posture (load-bearing)

Platform is a standalone-cloneable submodule. Everything in these bands — rules, skills,
scripts — stands alone at platform scope: no markdown link or link-checked path escapes the
submodule root; conventions are restated locally rather than linked to a parent; ARD provenance
is a version-pin string + MIT attribution in `.research/CONVENTIONS.md`.

## Rejected alternatives

### Stay on the flat `.memory/` layout

Keeping items and research under `.memory/` perpetuates split-brain against the monorepo's
settled output-namespace structure and leaves platform's items invisible to the output-class
tooling that keys on `.work/`. Rejected.

### Fork the monorepo's operationalized research rules

The available operationalized research rules carry ~1,955 lines woven with 143 cross-references
and 42 decision-record citations into another scope's decision graph — a divergent fork that
rots as that scope evolves and that violates standalone self-containment. Vendoring ARD's clean,
purpose-built framework (zero escaping references, MIT, agent-agnostic) is dramatically more
maintainable and lets platform track an upstream version instead of a fork. Rejected.

### Defer the research band; migrate only items

Platform held 28 research artifacts already — it had earned `.research/` outright. Migrating
items without research would leave the research output stranded. Rejected.

## Post-adoption evolution: plugin management

The bands initially operated on bespoke convention rules (`item-convention.md`,
`item-pipelines.md`, `research-band-spec.md`, etc.) and an in-tree ARD kernel vendor. Both were
subsequently converted to plugin management:

- `.work/` is now managed by the **agile-workflow plugin** (CONVENTIONS.md, work-view, managed
  rules block). The bespoke item rules are retired.
- `.research/` is now operationalized through the **agentic-research plugin's** drift-fenced
  vendored kernel (v0.5.1). The in-tree `ard-kernel/` vendor and bespoke band rules are retired.
  The working contract is `.research/CONVENTIONS.md`.

Both conversions maintained the self-containment posture: plugins are referenced as external
tools, not as paths inside the project tree.
