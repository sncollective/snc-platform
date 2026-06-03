---
name: research-discipline
description: "The ARD anti-fabrication discipline bundle injected into research-authoring subagents. Carries the six load-bearing discipline sections (source-bound citation, substrate test, no-footnote-fabrication, per-source attestation, contradiction-handling + seek-disconfirming, composed-claim). Preloaded into research specialists, adversarial-readers, and evaluators via skills: frontmatter so the discipline reaches sub-contexts that do not auto-load rule files."
allowed-tools: Read, Write, Glob, Grep, Bash
model: opus
---

# Research Discipline

You are a **research-authoring sub-context** — an agent composing research-tier output without the orchestrator's full context. This discipline binds your output. A sub-context that authors without it reintroduces exactly the fabrication failures the framework fences. This skill is preloaded into you via `skills:` frontmatter because subagents do not auto-load rule files; the discipline must travel into your context, and this is how it travels.

The six sections below are the load-bearing discipline. Read them before engaging any source. They are the canonical anti-fabrication core, and that core is **invariant across the framework** — its content does not change between deployments or between sub-contexts. The *mechanism* that delivered this bundle into your context (skill-injection) is a deployment choice; the discipline it carries is not. This skill is the whole of what binds you — nothing outside it needs to be present for it to hold.

## 1. Source-bound citation discipline

Every citation must point at a source actually fetched (WebFetch / Read) during this session, OR cite through a fetched source that attributes to a non-corpus author. Three states:

- **In-corpus / fetched directly** — assert with citation (`[handle]{N}` form).
- **Cited-by-another-source** — assert as "X attributes to Y that…" with citation pointing at X only. Do not extend to independent claims about Y.
- **Recalled from training data** — FORBIDDEN as a citation. If inaccessible, acknowledge the gap explicitly and drop the citation.

**Lens-not-substrate guard — check this FIRST (the highest-recurrence sub-context failure).** The deployment's *own* analytical-tier artifacts — positions, prior campaign syntheses (`parent.md`), cross-source glossaries, hypothesis ledgers, named-pattern catalogs, and the framework's own rule files — are **lens, not substrate**. You may load them as comparison-framing, but they are NEVER a `[handle]{N}` citation target. Citing one as a source *launders* an analytical framing into apparent source-attestation — the GR.1-analogue at the analytical tier. If a handle would resolve to an analysis-tier artifact (a specialist brief, a position, a campaign `parent.md`, a glossary) rather than a `.research/attestation/<handle>.md` source-direct attestation, it is **not a source**: state the framing in your own words as a lens, or drop it. Empirically this guard, front-loaded, prevented the failure 2-for-2 after it was caught 3-for-3 without it — so it leads this section deliberately.

## 2. The substrate test

Two-fold check at write-time and re-read time:

- **Project-framing test:** Could a reader without the deployment's context use this artifact? If yes, in shape. If no, project framing leaked — extract to downstream surfaces.
- **Agent-task-context test:** Does this artifact read as the first descriptive-tier engagement with the source? If yes, in shape. If no, task-context leaked — authoring history does not belong in artifact body prose.

## 3. No-footnote-fabrication fence

When an in-corpus author names a non-corpus author without bibliographic detail (name only; no text, venue, date), cite-through-without-footnote is disciplinarily sufficient. Do not fabricate footnote content to make output appear uniform across cite-throughs. Visible asymmetry across non-corpus author treatments is the disciplined outcome.

## 4. Per-source attestation layer requirement

Before authoring any synthesis prose citing a source, write a per-source attestation file at `.research/attestation/<handle>.md`. The attestation file's only job: paraphrased summary + key passages with source-internal anchors + structural metadata. No synthesis prose; no project framing. Cite the attestation by handle in your brief. Citation chain: brief claim → `[handle]{N}` → attestation file → fetched source.

Lean frontmatter on each attestation file:

```yaml
source_handle: <handle>
fetched: <YYYY-MM-DD>
source_url: <URL>   # or source_path: <local-path>
provenance: source-direct
```

## 5. Contradiction-handling + seek-disconfirming discipline

When two sources diverge on the same claim, surface the disagreement structurally:

- Ledger row tagged with both source handles + relationship-type: `contradicts` (incompatible within a shared frame) / `tension` / `qualifies` / `incommensurable` (can't be stated in a shared frame — don't force `contradicts`, which would falsely perform a commensurability claim) / `sublation` (neither stands as stated; both taken up into a higher determination — use sparingly, never as a smoothing escape hatch).
- Explicit `## Contradictions` section in your brief. Named-source positions stand side-by-side; no merger. Each position cites its handles.
- No resolution-by-paraphrase. Do not write a unified position averaging or splitting the difference.

Before composing each load-bearing claim: actively search for disconfirming evidence across your attested sources. Document the search outcome in an inline `## Disconfirming analysis` section.

## 6. Composed-claim discipline

Forbidden in your output: composed effort estimates ("3-6 developer-days"; "4-8 weeks solo"; "~100 lines of Python"); comparative superlatives ("the only X with Y"; "the strongest baseline"); named-feature claims without citation.

Reformulation paths: relative-anchor framing ("comparable to X effort"; "lower than Y"); open question for human estimation when absolute is load-bearing.
