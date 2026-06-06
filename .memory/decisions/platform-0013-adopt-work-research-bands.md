---
id: platform-0013
title: Adopt `.work/` (work items) + `.research/` (ARD v0.1) output bands
status: active
created: 2026-06-03
updated: 2026-06-03
supersedes: []
superseded_by: null
revisit_if:
  - "ARD ships a MAJOR version (migration required) — re-vendor research-band-spec.md + research-band-catalogs.md deliberately and reconcile research-band-platform.md"
  - "Platform research scales from single-pass briefs into multi-specialist campaigns — populate analysis/campaigns/ and confirm the evaluate gate is wired"
  - "A platform-domain failure shape or source class reproduces ~3× — coin it into research-band-catalogs.md per the closed-with-extension recipe and consider surfacing it upstream"
  - "Standalone-clone self-containment is no longer a goal for platform — relax the no-escaping-links constraint"
---

## Context

Platform's persistent state previously lived entirely under `.memory/`: work items in `.memory/{active,backlog,releases}/` and research in `.memory/research/`. This predated the output-vs-substrate cleavage that separates output-class artifacts (consumed by tooling, adjacent agents, external readers) from internal substrate. Items already carried correct frontmatter (`kind`/`stage`/`tags`/`release_binding`) — they were convention-compliant, just in the wrong namespace.

Platform had earned both output bands outright: ~20 active items, 168 backlog items, 3 release bundles, and 28 research artifacts. The split was overdue, not premature.

The research band is now a stabilized, published framework — **ARD v0.1** (Agentic Research Discipline): MIT-licensed, agent-agnostic, with its own architecture-vs-inventory cleavage and a four-tier adoption guide.

## Decision

Adopt the two output bands alongside the substrate band:

- **`.work/`** holds work items — `active/{epics,features,stories}/`, `backlog/`, `releases/`, `archive/`. Governed by the work-item rules (`item-convention.md`, `item-pipelines.md`, `tag-taxonomy.md`). Platform ships versioned releases, so items bind to a release at review-pass.
- **`.research/`** holds the research band, **operationalizing ARD v0.1** — `reference/`, `attestation/`, `precis/`, `analysis/{briefs,campaigns,positions,hypothesis}/`. Read down-gradient only.
- **`.memory/`** retains internal substrate only — `decisions/`, `sessions/`, `scratchpad/`, `agents/`.

### ARD adoption level

> **Revised by [platform-0014](platform-0014-adopt-ard-kernel-contract.md):** the consumption *mechanism* below (hand-narrated prose vendor) and the **v0.1** pin are superseded — platform now adopts the ARD `kernel/` consumption contract (data + verbatim + conformance) at **v0.4.1**, vendored in-tree. The band layout, self-containment posture, and verification-stack wiring in this record stand.

Platform adopts at **Tier 1 (framework) + Tier 2 (catalogs) + Tier 4 (version-pin)** per ARD's adoption guide:

- The architecture is **vendored** as `.claude/rules/research-band-spec.md` (← ARD SPEC) + `.claude/rules/research-band-catalogs.md` (← ARD CATALOGS), with `.claude/rules/research-band-platform.md` carrying platform's concrete deployment mapping (substrate layout, attestation tier path, citation lint, discipline-propagation mechanism). These are a **pinned snapshot of ARD v0.1**; upstream revisions arrive as a deliberate re-vendor, not automatically. MIT attribution is carried in-tree.
- The verification stack is wired: `lint` (the `lint-research-claims.py` / `lint-citations.py` scripts), `adversarial-read` + `evaluate` (the `adversarial-reader` / `evaluator` agents), `spot-check` (terminal human check). Discipline propagates into research sub-agents via the `research-discipline` skill injected through `skills:` frontmatter.

### Self-containment

Platform is a standalone-cloneable submodule. Everything in these bands — rules, skills, agents, scripts — stands alone at platform scope: no markdown link or link-checked path escapes the submodule root, conventions are restated locally rather than linked to a parent, and the ARD provenance is a version-pin string + MIT attribution rather than a link back to the upstream spec.

## Tier 3 — platform trade-offs

None committed yet. Platform-specific `primitives_extends:` / `primitives_opts_out:` declarations or coined catalog values will be recorded here (and surfaced in `research-band-platform.md`) if they stabilize.

## Alternatives considered

### Stay on the flat `.memory/` layout

Rejected. Keeping items and research under `.memory/` perpetuates split-brain against the monorepo's settled output-namespace structure, and leaves platform's items invisible to the output-class tooling (kanban/tag views, release tooling) that keys on `.work/`.

### Fork the monorepo's operationalized research rules

Rejected. The available operationalized research rules carry ~1,955 lines woven with 143 cross-references and 42 decision-record citations into another scope's decision graph — a divergent fork that rots as that scope evolves and that violates standalone self-containment. Vendoring ARD's clean, purpose-built spec (zero escaping references, MIT, agent-agnostic) is dramatically more maintainable and lets platform track an upstream version instead of a fork.

### Defer the research band; migrate only items

Rejected. Platform held 28 research artifacts already — it had earned `.research/` outright, and migrating items without research would leave the research output stranded in the retired `.memory/research/` location.
</content>
