---
paths:
  - ".research/**"
  - ".claude/skills/research-*/**"
---

<!-- ARD v0.4.1 SNC-operationalization layer over the vendored catalog data (ard-kernel/catalogs.json), per platform-0014. The catalog *members* (failure shapes, lint categories, statuses, predicates, enums) live as data in ard-kernel/catalogs.json and are consumed by the lints; this file carries the SNC-operational prose — how the catalogs apply in platform — and defers enumerable member lists to the data rather than re-narrating them. Companion to research-band-spec.md. Re-sync members by cp -r of the kernel, not by hand-editing here. -->

# ARD — SNC-Operationalization Catalogs (v0.4.1)

The inventory companion to [SPEC.md](research-band-spec.md), which specifies ARD as a framework for grounded, verifiable research conducted by AI agents — a tunable control-space of always-on checks plus selectable gates. Where the spec names what is **invariant**, this file populates the framework's **current baseline** — the catalogs an adopter starts from and **extends**.

Every catalog here is **closed-with-extension**: coin an ad-hoc option (lowercase-hyphen), document it inline at the point of use, surface it for consolidation, and promote it to baseline at roughly three independent uses. Nothing here is a fixed ceiling; the lists grow (and prune) under your own empirical pressure. This is the adopt-and-extend boundary the architecture-vs-inventory cleavage keeps visible.

The **consolidation surface** — where surfaced ad-hoc options are reviewed for promotion — is a deployment choice: for a solo deployment it is the maintainer's own judgment over this file; a shared, multi-party adoption needs a named venue (a registry, a periodic review). The recipe's invariant is the *gradient* (coin → use → promote at recurrence), not a specific review mechanism.

---

## 1. Failure-shape inventory

Failure shapes are named in ARD's **locus-of-failure** coordinate system (see [SPEC.md](research-band-spec.md) [§2](research-band-spec.md#2-the-failures-ard-addresses)) — seven loci keyed to *where in the trajectory the failure lives*: `AQ` Acquisition · `GR` Grounding · `CX` Context-use · `CO` Composition · `FR` Framing · `PR` Propagation · `WM` Warrant/meta. The v0.4.1 baseline is **22 shapes across all seven loci** (the `WM` locus populated from v0.2). The full per-shape inventory — every shape, locus, status, and committed fence — lives as **data in `ard-kernel/catalogs.json`** (`failure_shapes`), consumed by the lints; this section keeps the **SNC-operational view**: the shapes platform's verification stack actively fences, and how.

| Shape | Name | Platform fence |
|---|---|---|
| `GR.1a` | Anchor-and-drift — surrounding context composed while the anchor is fetched | per-source attestation + three-state citation + verification stack |
| `GR.1b` | Within-source attribution swap (figures correct, mapping reversed) | per-source attestation + semantic citation-chain walk |
| `GR.4` | Quote-context distortion — quote accurate, surrounding qualifier stripped | adversarial-read quote-context walk |
| `GR.5` | Thin attestation passing lint — frontmatter correct, body un-anchored | lint structural check + adversarial-read complement |
| `CX.1` | Noise domination — less-relevant retrieved content used over more-relevant | adversarial-read relevance-weighting (**detection only** — see [SPEC.md](research-band-spec.md) [§11](research-band-spec.md#11-known-limitations)) |
| `AQ.1` | Coverage gaps / unknown-unknowns | isolated-context evaluator (coverage component) |
| `CO.1` | Smoothed contradictions in cross-source synthesis | `## Contradictions` discipline + adversarial-read coherence-read |
| `FR.1` | Self-confirming framing | isolated-context evaluator (structural isolation) |
| `PR.2` | Decomposition-framing lock-in — a facet cut inherits a lens all downstream work runs inside | multi-sampling at `decompose` (≥3 candidates + comparative + bracket) + persisted rationale |

`GR.1a` / `GR.1b` are the two sub-shapes of the canonical `GR.1` anchor-and-drift umbrella. The remaining baseline shapes are carried in the catalog data and platform implements no dedicated fence for them beyond the always-on core: the **forward-looking** ones (`GR.2`, `GR.3`, `AQ.2`, `FR.2`, `PR.1` — named, no committed fence yet) and the v0.2 additions (`GR.1c`, `GR.6`, `GR.7`, `CO.2`, `CO.3`, and the `WM.1–3` warrant-locus shapes). The ordinal indexes shapes within a locus and is independent of fence status; the numbering never reflows.

---

## 2. Source-class soft enum + attestation shapes

Ten baseline source classes identify which attestation-body shape and handle convention applies:

`paper` · `book-chapter` · `essays` · `tool-doc` · `blog-post` · `github-readme` · `wiki-page` · `light-form` · `standard` · `talk-podcast`

**Five-component write-discipline** (across all classes unless a class says skip): (1) paraphrased summary — the source's argument in the agent's words, no synthesis prose, no project framing; (2) key passages — verbatim blockquotes for load-bearing claims, each with a source-internal anchor (section / page / paragraph / timecode); (3) structural metadata — organization, section list, version, extraction-quality flags; (4) nothing composed beyond the source; (5) substrate-test pass — usable by a reader without the deployment's context.

| Class | Handle convention | Load-bearing field(s) |
|---|---|---|
| `paper` | `<first-author>-<paper-slug>` | version (papers revise) |
| `book-chapter` | `<author>-<book-slug>-ch<N>` | edition (chapter numbering varies across editions) |
| `essays` | `<author>-<essay-slug>` | collection (essay-author attribution, not editor) |
| `tool-doc` | `<tool>-<topic>` | version (docs revise frequently) |
| `blog-post` | `<author-or-venue>-<post-slug>` | author byline, post date |
| `github-readme` | `<owner>-<repo>` | license (SPDX), last-commit |
| `wiki-page` | `<wiki-slug>-<page-slug>` | fetched-date (wikis drift), license |
| `light-form` | `<platform>-<thread-id>` | paraphrase-only (no verbatim posts; PII risk) |
| `standard` | `<body>-<doc-number>` | version + section anchors (revise at section granularity) |
| `talk-podcast` | `<speaker>-<talk-slug>` | transcript-source (hand-cleaned vs auto-captioned) |

**Per-class IP profile + raw-layer treatment** (ARD v0.4.1 catalog layer): each source class also carries an intellectual-property profile governing how much of its raw may be retained and in what form. Platform's operational stance — reference raws are gitignored regardless of class ([research-band-platform.md](research-band-platform.md) §Substrate band layout), and the tracked attestation body follows the five-component write-discipline above, with `light-form` **paraphrase-only** (no verbatim posts; PII risk) as the table notes. The authoritative per-class profile is the upstream ARD v0.4.1 source-class layer; platform tightens it (more restrictive retention), never loosens it.

**Engagement-time bracketing** (`bracket` verb) fires structurally when the goal is claim-validation or external-calibration, or for sources whose engagement mode is "audit existing framing"; it is optional otherwise, where the attestation primitive does the structural fence. Optional cross-class frontmatter: `extraction_pipeline` (records the pipeline used — drift-detectability across re-extractions) and `substrate_confidence` (`source-direct` / `search-summary` / `snippet-thin` — engagement depth, defaulting to source-direct).

---

## 3. Lint pattern catalog

Mechanical substrate-test patterns matched against synthesis output. `lint` is a hard-floor gate; this is its diagnostic catalog. Six baseline categories:

1. **Decimals with source attributions** — a decimal figure adjacent to a source name; highest empirical failure rate. Flags proximity for verification.
2. **Version numbers** — version identifiers in comparative/attributional claims without an in-corpus anchor.
3. **File / word / page counts** — numeric counts with units and no citation.
4. **Comparative superlatives** — "the only X with Y", "the strongest baseline" — claims requiring a full-set survey the agent did not perform.
5. **Named-feature claims** — capabilities attributed to a tool/system by name without a fetched anchor.
6. **Composed effort estimates** — quantitative effort claims constructed without substrate (forbidden per [SPEC.md](research-band-spec.md) [§4.4](research-band-spec.md#44-composed-claim-discipline)).

The six **categories** are the invariant diagnostic targets; the specific **matchers** (regexes, token-window heuristics, what counts as "adjacent" or as an "in-corpus anchor") are deployment latitude — an adopter implements detectors fit to its corpus. A category fires to flag a claim for human spot-check, not to auto-reject; the floor is "these shapes get checked," not a fixed regex set. New categories follow the extension recipe.

### Citation-chain integrity check

For every `[handle]{N}` occurrence, six sequential checks: (1) **handle resolution** — an attestation exists at the expected location; (2) **source-handle match** — the attestation's recorded handle equals the cited handle; (3) **source resolution** — the recorded URL/path resolves (URL failures warn, path failures error; the URL liveness probe is SSRF-fenced — public web targets only); (4) **provenance present** — both attestation and citing brief carry provenance; (5) **handle uniqueness** (ARD v0.4.1) — a `source_handle` declared by two or more attestations resolves ambiguously and is flagged `colliding-handle` (a corpus-scan; platform also surfaces this via `audit-handles.py --collisions`); (6) **scope** — applies to all `[handle]{N}` in the linted files. Per-citation status: `resolved` / `unresolved-handle` / `mismatched-source-handle` / `colliding-handle` / `unreachable-source` / `missing-provenance`, plus the two **non-broken** statuses `intra-program-resolved` (resolves to an analytical-tier intra-program artifact) and `reduced-substrate-attestation` (valid but deliberately reduced-depth). The check + status sets are sourced as data from `ard-kernel/catalogs.json` (`lint.citation_chain_statuses`); default posture is lint-only-warn, blocking on a severity threshold is opt-in.

---

## 4. Adversarial-reader job catalog

`adversarial-read` invokes a capable-model sub-agent with full access to synthesis output, briefs, attestations, and lint output. Four baseline jobs:

- **(a) Semantic citation-chain walk** — for each load-bearing claim, walk back to the cited attestation and verify it *semantically supports* the claim (distinct from lint's resolution check).
- **(b) Claim-shapes lint missed** — plausible-looking attributions with no citation; cite-throughs over-extended beyond the in-corpus source; comparatives framed as descriptions.
- **(c) Coherence-read for smoothed contradictions** — read as a coherent argument; flag where two sources were merged under a paraphrase that papers over disagreement.
- **(d) Noise-domination / relevance-weighting** — read *all* retrieved attestations for each major claim, not just the cited ones; flag a less-relevant citation where a more-relevant attestation went uncited. (The `CX.1` detection fence.)

Four extension jobs deepen coverage: **(e)** quote-context walk (`GR.4`); **(f)** analytical-tier inheritance walk (catches analytical framing re-used as if source-attested); **(g)** line-reference walk (sub-attestation granularity); **(h)** thin-attestation check (`GR.5`). Verdict: `APPROVED` / `NEEDS-REVISION`; a `NEEDS-REVISION` triggers a revision pass before `evaluate`.

---

## 5. Evaluator job catalog

`evaluate` invokes an **isolated-context** sub-agent — it sees only the synthesis output and the engagement seed, not the decomposition rationale, briefs, or attestations. Isolation is the fence against shared-context blind spots (`FR.1`). Five-component spec:

1. **Coverage** — does the synthesis address the seed's scope; what is omitted without acknowledgment?
2. **Coherence** — does it hold together; any internal tensions or join-seam inconsistencies?
3. **Contradictions** — is there a `## Contradictions` section; are the contradictions substantive; does the body contradict it?
4. **Groundedness** — do claims *present as* source-grounded (the evaluator can't verify chains but can read the citation posture)?
5. **Recommendations** — priority-ordered revision targets when the verdict is `NEEDS-REVISION`.

### Contradiction-surfacing shape

The contradiction-handling discipline ([SPEC.md](research-band-spec.md) [§4.5](research-band-spec.md#45-contradiction-handling-discipline)) is verified by adversarial-read job (c) and evaluator component 3, so the artifacts it produces carry a minimal shape:

**Ledger row** — one per surfaced divergence: `L-<n>` · `[handle-a]{N}` vs `[handle-b]{M}` · **\<relationship-type\>** · one-line statement of the divergence · discriminating-substrate pointer (or `unresolved`). Relationship-type ∈ {`contradicts`, `tension`, `qualifies`, `incommensurable`, `sublation`}.

**`## Contradictions` section** — in any cross-source synthesis, named positions stand side-by-side, each citing its handle, with no merged or averaged position:

```
## Contradictions
- **<dimension>** — [handle-a]{N} holds X; [handle-b]{M} holds Y.
  <relationship-type>. <resolution path, or "this engagement does not resolve">.
```

---

## 6. Decision-point catalog

The walk activates an applicable subset of these in the order [SPEC.md](research-band-spec.md) [§10.1](research-band-spec.md#101-the-decision-graph-activation--ordering) fixes. Tier: **D** = research-discipline (direct verb application), **V** = verification-stack orchestration (mechanism invoked), **M** = meta-workflow coordination.

| Decision-point | Tier | Fires | Conditional |
|---|---|---|---|
| `dispatch-time-registration` | M | — (coordination) | always (entry act) |
| `substrate-check` | D | `substrate-check` | always |
| `decompose` | D | `decompose` (+ `self-flag`) | when the walk admits decomposition |
| `specialist-dispatch` | M | — (coordination) | multi-specialist walks only |
| `attest` | D | `attest` (+ `bracket`, `stage`, `self-flag`) | always (`bracket` conditional) |
| `synthesize` | D | `synthesize` (+ `seek-disconfirming`, `stage`, `self-flag`) | always — `{within-specialist}` and/or `{cross-specialist}` scope |
| `lint` | V | `lint` | always (hard floor) |
| `adversarial-read` | V | `adversarial-read` | selectable; in-floor for synthesis-producing shapes |
| `evaluate` | V | `evaluate` | selectable; reachable only when a cross-synthesis artifact exists |
| `spot-check` | D | `spot-check` | always (hard floor; terminal) |
| `user-validation` | D | `user-validation` | when the user is the committing party |
| `promote` | D | `promote` | when converged substrate warrants cross-arc lifting |

The two `M` coordination decision-points are named-and-ordered by the framework; the coordination *acts* (how dispatch happens, how fan-out is spawned) are a deployment's orchestration topology.

---

## 7. Registration enums

Value catalogs for the nine registration fields ([SPEC.md](research-band-spec.md) [§9](research-band-spec.md#9-the-registration-contract)).

**`intent`** (5): `terminate-in-position` · `build-substrate` · `survey-landscape` · `validate-claim` · `calibrate-external`.

**`output_kind`** (11; single value or list for cascade-producing goals): `position` · `synthesis-brief` · `landscape-brief` · `attestation` · `corpus-piece` · `precis` · `hypothesis-capture` · `hypothesis-ledger` · `vocab-capture` · `adoption-recommendations` · `questions-list`. *(A position is promoted by research; a downstream project authors any decision record citing it — the two are separate acts.)*

**`temporal_contract`** (5):

| Value | Stop + after-revision semantics |
|---|---|
| `write-once-on-converge` | authored once on convergence; supersession via new artifact |
| `extend-on-source-rev` | extends in place when substrate revises (attestations, precis, indices) |
| `supersedes-prior` | breadth/claim-bound; superseded on a named trigger |
| `ttl-bounded` | time-bounded; auto-stales after a recorded TTL |
| `re-engage-on-trigger` | question-driven; re-engages in place on a checkable trigger |

**`verification_rigor`** (activation-profiles over the verification gate-catalog — a *subset-select* control, not a closed magnitude switch; every profile includes the hard floor `lint`+`spot-check`, and the selectable gates `adversarial-read`+`evaluate` are what a profile adds):

| Profile | Selectable gates activated (over the always-on floor) |
|---|---|
| `floor` | ∅ — hard floor only (`lint` + `spot-check`) |
| `standard` | `{adversarial-read}` |
| `full` | `{adversarial-read, evaluate}` |

These are named **subsets over the gate-catalog**, not a fixed magnitude enum: "go custom" (naming an explicit gate set) is first-class, and the catalog is closed-with-extension (a future gate may join). The three profiles form an ascending chain because reachability forecloses the off-chain config — `evaluate` is only reachable on a cross-specialist synthesis shape, and on those shapes `adversarial-read` is itself in-floor, so `{evaluate}` without `{adversarial-read}` has no shape where it is both legal and needed ([SPEC.md](research-band-spec.md) [§3.1](research-band-spec.md#31-the-floor--the-always-activated-core), §7).

**`scope_authority`** (3): `pre-registered` · `mixed` · `in-engagement-judgment`. **`analytical_artifact_type`** (2): `per-campaign-brief` (converging) · `accumulative-ledger` (accumulating). **`consumer`**: free-text, common values `future-agent` / `future-engagement` / `methodology-revisers` / `calibrated-work`.

**`primitives_extends`** / **`primitives_opts_out`**: free-text lists of verb or primitive names (drawn from the verb-set, [SPEC.md](research-band-spec.md) [§6](research-band-spec.md#6-the-act-vocabulary-the-verbs)) — engagement-specific additions and omissions respectively. Each `primitives_opts_out` entry carries a one-line rationale (an omission must be justified, never silent). Both default to empty.

---

## 8. Provenance values

Artifact-local warrant, rendered visibly (see [SPEC.md](research-band-spec.md) [§10.4](research-band-spec.md#104-citation-form-and-provenance)):

| Value | Applies to |
|---|---|
| `source-direct` | reference raws, indices, per-piece notes, vocab captures |
| `agent-authored-from-raw` | precis files, hypothesis captures |
| `agent-synthesis` | cross-source analytical artifacts (briefs, syntheses, positions, ledgers) |
| `generated-listing` | mechanically produced listings (no editorial content) |
| `hybrid-curated` | hand-authored kernel with agent-derived sections |

---

## 9. Typed cross-reference predicates (ARD v0.4.1)

Typed cross-references ([SPEC.md](research-band-spec.md) [§10.5](research-band-spec.md#105-typed-cross-references-optional)) — the `related:` frontmatter edges between artifacts — draw their predicate from a **closed-with-extension vocabulary of twelve baseline predicates** (CiTO / IBIS-Toulmin / SKOS + substrate-native), vendored as data in `ard-kernel/catalogs.json` (`typed_edge_predicates`); each predicate carries its source-ancestor (the ontology term it derives from) and semantic there. Edges are directed from the carrier outward; `related` (SKOS-derived) is the only symmetric predicate. Extend only with a cited source-ancestor or an explicit no-ancestor rationale. Optional + opt-in — platform wires `related:` into `.research/` artifacts where typed cross-references serve; structural predicates (`parent`, `supersedes` / `superseded_by`) stay as established top-level fields, not under `related:`.

---

*The catalog members are vendored as data in `ard-kernel/catalogs.json` (ARD v0.4.1); this file is the SNC-operational layer over them. Extend by the closed-with-extension recipe; re-sync ARD members by `cp -r` of the kernel + conformance, not by hand-editing here.*
