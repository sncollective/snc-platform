<!-- ARD-Version: 0.4.1 -->
# ARD discipline bundle

The **anti-fabrication discipline** — the load-bearing content that must travel *verbatim* into every research-authoring sub-context (any agent that composes research output without the orchestrator's full context). This file is the injection-ready rendering of *ARD SPEC §4* (the anti-fabrication core) and *ARD SPEC §5* (discipline propagation). For the spec, see the [ARD project](https://code.s-nc.org/Kevoun/ARD).

**This is a `verbatim` vendorable artifact** (per `ard.json`). Copy it unaltered into your deployment's sub-context-injection mechanism — a preloaded skill, an inlined prompt bundle, or any host-native propagation that guarantees the content arrives. **Do not re-narrate or summarize it:** paraphrasing the discipline reintroduces exactly the drift it fences (*ARD SPEC §4.6, §5*). The propagation *mechanism* is your deployment's choice; the *content* below is invariant across deployments and sub-contexts. Where the bundle names a tier by concept ("the attestation tier"), map it to your own path — that mapping is the only adaptation permitted.

The six sections are the canonical anti-fabrication core. Read them before engaging any source.

## 1. Source-bound citation discipline

Every citation must point at a source actually fetched during this engagement, OR cite through a fetched source that attributes to a non-corpus author. Three states:

- **In-corpus / fetched directly** — assert with citation (`[handle]{N}` form).
- **Cited-by-another-source** — assert as "X attributes to Y that…" with citation pointing at X only. Do not extend to independent claims about Y.
- **Recalled from training data** — FORBIDDEN as a citation. If inaccessible, acknowledge the gap explicitly and drop the citation.

**Lens-not-substrate guard — check this FIRST (the highest-recurrence sub-context failure).** The deployment's *own* analytical-tier artifacts — positions, prior campaign syntheses, cross-source glossaries, hypothesis ledgers, named-pattern catalogs, and the framework's own rule files — are **lens, not substrate**. You may load them as comparison-framing, but they are NEVER a `[handle]{N}` citation target. Citing one as a source *launders* an analytical framing into apparent source-attestation — the GR.1-analogue at the analytical tier. If a handle would resolve to an analytical-tier artifact (a specialist brief, a position, a campaign parent synthesis, a glossary) rather than a source-direct attestation in the attestation tier, it is **not a source**: state the framing in your own words as a lens, or drop it.

## 2. The substrate test

Two-fold check at write-time and re-read time:

- **Project-framing test:** Could a reader without the deployment's context use this artifact? If yes, in shape. If no, project framing leaked — extract it to downstream surfaces.
- **Agent-task-context test:** Does this artifact read as the first descriptive-tier engagement with the source? If yes, in shape. If no, task-context leaked — authoring history does not belong in artifact body prose.

## 3. No-footnote-fabrication fence

When an in-corpus author names a non-corpus author without bibliographic detail (name only; no text, venue, date), cite-through-without-footnote is disciplinarily sufficient. Do not fabricate footnote content to make output appear uniform across cite-throughs. Visible asymmetry across non-corpus author treatments is the disciplined outcome.

## 4. Per-source attestation layer requirement

Before authoring any synthesis prose citing a source, write a per-source attestation file at your deployment's attestation tier (`<attestation-dir>/<handle>.md`). The attestation file's only job: paraphrased summary + key passages with source-internal anchors + structural metadata. No synthesis prose; no project framing. Cite the attestation by handle in your brief. Citation chain: brief claim → `[handle]{N}` → attestation file → fetched source.

Normative-minimum frontmatter on each attestation file (*ARD SPEC §4.2*; the schema is `kernel/schema/attestation.schema.json`):

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

Reformulation paths: relative-anchor framing ("comparable to X effort"; "lower than Y"); open question for human estimation when an absolute is load-bearing.
