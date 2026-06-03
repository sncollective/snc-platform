---
paths:
  - ".research/**"
  - ".claude/skills/research-*/**"
---

# Research band — platform operationalization

Platform adopts **ARD v0.1** (Agentic Research Discipline) — MIT-licensed, agent-agnostic. The invariant architecture is vendored in `research-band-spec.md`; the baseline catalogs in `research-band-catalogs.md`. ARD names concepts ("the attestation tier", "a citation-chain lint mechanism", "the substrate band layout") and leaves each deployment to map them onto its own filesystem and tooling. This file is platform's concrete mapping — the deployment-specific half the spec defers.

## Version pin

Platform tracks **ARD v0.1**. The vendored spec + catalogs are a pinned snapshot; upstream revisions arrive as a deliberate re-vendor (a position-changing commit), not automatically. Per ARD's SemVer, a MAJOR bump requires migration; MINOR/PATCH are free re-vendors.

## Substrate band layout (maps SPEC §10.2)

The research substrate lives under `.research/`, read down-gradient only (descriptive layers never consult analytical artifacts):

```
.research/
├── reference/      source-direct: raw fetches (gitignored), per-corpus INDEX + README
├── attestation/    flat per-source-handle files: <handle>.md — the citation anchor
├── precis/         engagement-unit aggregations authored from raw (source-coherent)
└── analysis/       cross-source analytical work:
    ├── <topic>.md          named-pattern catalogs, glossaries
    ├── briefs/<slug>.md    standalone single-pass briefs (-landscape.md for breadth surveys)
    ├── campaigns/<slug>/    multi-specialist + program-scale bundles
    ├── positions/<slug>.md  research-time settled positions (distinct from .memory/decisions/)
    └── hypothesis/<arc>-ledger.md   working hypotheses + cross-arc ledgers
```

`.research/reference/` raw fetches are gitignored; INDEX, attestation, precis, and analysis are tracked.

## Attestation tier + citation wire-form

- Attestations live flat at `.research/attestation/<handle>.md`, carrying the normative-minimum frontmatter (`source_handle`, `fetched`, `source_url`/`source_path`, `provenance`) plus per-source-class extensions per `research-band-catalogs.md` §2.
- Citations use `[handle]{N}` (grammar `\[([\w-]+)\]\{(\d+)\}`): `handle` resolves to the attestation, `N` indexes the per-corpus bibliography.
- The citation-chain lint (`research-band-catalogs.md` §3) is the `lint-research-claims.py` script under the project's `scripts/` dir, run over `.research/analysis/` with `--attestation-dir .research/attestation/`.

## Discipline propagation (maps SPEC §5)

The anti-fabrication core must reach every authoring sub-context. Platform's mechanism: the `research-discipline` skill (the six load-bearing sections) is injected into research sub-agents via `skills:` frontmatter on the agent definitions (`research-specialist`, `adversarial-reader`, `evaluator`) and on the `research-orchestrator` skill. A sub-agent that authors research output without the core reintroduces exactly the failure ARD fences.

## Verification stack (maps SPEC §7)

- `lint` (hard floor) → the `lint-research-claims.py` script.
- `adversarial-read` (selectable) → the `adversarial-reader` agent.
- `evaluate` (selectable, cross-specialist shapes) → the `evaluator` agent (isolated context).
- `spot-check` (hard floor, terminal) → the human-context check at engagement close.

## Tier 3 — platform trade-offs

Platform-specific `primitives_extends:` / `primitives_opts_out:` declarations and any coined catalog values are recorded in a platform decision record under `.memory/decisions/` and surfaced here when they stabilize. None committed yet.

## Revisit if

- ARD ships a MAJOR version (migration required) — re-vendor `research-band-spec.md` + `research-band-catalogs.md` deliberately and reconcile this mapping.
- Platform research scales from single-pass briefs into multi-specialist campaigns — populate `analysis/campaigns/` and confirm the `evaluate` gate is wired.
- A platform-domain failure shape or source class reproduces ~3× — coin it into `research-band-catalogs.md` per the extension recipe and consider surfacing it upstream.
</content>
