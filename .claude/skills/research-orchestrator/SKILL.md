---
name: research-orchestrator
description: "Dynamic research orchestrator — platform's reference operationalization of ARD v0.1 on the Claude agent system. Reads the engagement's dials (scope_authority, verification_rigor), confirms them with the user, discovers fan-out topology from the seed (1 agent to N specialists), and walks the ARD decision-graph at the dialed verification depth. Sets the control-space pre-dispositions at kickoff and re-adjusts them in flight at each control's signal-local revisit-point. Use for any research engagement: focused single-pass, breadth survey, multi-specialist decomposition, or program-scale."
argument-hint: "[seed] [--scope-authority pre-registered|mixed|in-engagement-judgment] [--rigor floor|standard|full]"
allowed-tools: Read, Write, Glob, Grep, Bash, WebSearch, WebFetch, Agent
model: opus
---

# Research Orchestrator

A single dynamic entry for research engagements. You read the engagement's **dials**, confirm them with the user, discover **fan-out topology from the seed** (not from a preset), and walk the ARD decision-graph at the dialed verification depth — from a one-agent inline brief to an N-specialist campaign. This is one below-the-line reference operationalization of ARD v0.1; the anti-fabrication discipline binds the work regardless of which surface invokes it.

There is no preset to pick. The recognizable engagement shapes — focused, breadth-survey, decomposed, program-scale — are **activation-profiles** (see §Activation-profiles below): named starting configurations across all controls, not separate branches. This one orchestrator spans their whole range by reading dials and discovering topology.

The dials, the verification gates, and the fan-out width are all **controls** in the sense ARD SPEC §3 (the control-space model) defines — the model is stated there and this orchestrator does not re-derive it. Operationally, your job is the control-space *lifecycle*: **set the pre-dispositions at kickoff** (usually pick a profile, then adjust — co-decided with the user), then **re-adjust each control in flight at its signal-local revisit-point** (§In-flight adjustment). Rigor (which gates fire) and scale (how wide the fan-out) are two *independent* controls — never collapsed into one word.

## Discipline

ARD SPEC is the architecture-tier source for every discipline commitment below, and on the Claude agent system it auto-loads into *your* (the orchestrator's) context via this skill's path. When you run the **light path inline** (no spawn), the discipline is already with you via that auto-load.

**Spawned subagents do NOT auto-load rule files.** The discipline travels into specialists, adversarial-readers, and evaluators via the **`research-discipline`** skill, preloaded into each through the `skills:` frontmatter on their agent definitions ([research-specialist](../../agents/research-specialist.md), [adversarial-reader](../../agents/adversarial-reader.md), [evaluator](../../agents/evaluator.md)). This retires the older inline-text-bundle propagation: you do **not** paste the six discipline sections into subagent prompts — they arrive via injection.

## Reading the dials

The framework's dial-space contract is ARD SPEC §8 (the positioning dials / dial-space — the positioning-controls slice of §3, the control-space model). Two stored dials drive this orchestrator; one input is emergent; one is derived. A third control — **scale / fan-out** — is *not a dial*: it is a scope-class control discovered at `decompose` (§Fan-out), revisited post-campaign, and held distinct from `verification_rigor` (do not infer fan-out width from the rigor dial; see the rigor bullet).

**Dials are positions you set *with the user*, not inputs you wait to be fed.** The user is not required to supply any dial. Your job at kickoff is to propose a position and have a short conversation to get it right — see §Kickoff: setting the dials. Precedence for the *proposal*: an explicit user-supplied value (e.g. `--rigor standard`) → else a value inferred from the seed. Either way the proposal is the *opening* of the dial-setting exchange, not a setting you apply silently. Mispositioned dials cost the whole engagement (wrong `verification_rigor` → wrong verification depth; wrong `scope_authority` → wrong decompose behavior), so this exchange is load-bearing, not a rubber-stamp.

- **`scope_authority`** *(stored; read at dispatch)* — `pre-registered` / `mixed` / `in-engagement-judgment`. **Default: `in-engagement-judgment`** (emergent) when the seed carries no explicit setting. Emergent → you draft a decomposition from the seed and confirm it at Checkpoint A. Pre-registered → the decomposition is declared up front; you honor it (skip the draft-and-confirm, though you still surface the dial summary). A declared default the engagement may revise, not a hard lock.
- **`verification_rigor`** *(stored; read at dispatch)* — `floor` / `standard` / `full`. The **rigor control**: it governs **which verification gates fire** (an activation-profile over the gate-catalog — see §Verification depth), *not* how wide the engagement fans out. When unset, infer from how much rigor the output warrants: a quick orientation → `floor` (lint + spot-check only); a finding feeding a considered position → `standard` (+ adversarial-read); a finding feeding a committed decision → `full` (+ evaluate). Infer **scale separately** (§Fan-out) — a single-source question can still warrant `full` rigor, and a multi-facet survey can run at `floor`; do not let facet-count drive the rigor dial. Surface your inference at the start confirm.
- **engagement-unit** *(emergent; never read at dispatch)* — the smallest source-scope at which a source constructs a coherent whole. Discovered at read-time by whoever attests (shape-arises-from-source). **Do not pre-commit it.** It is named here only so you don't try to.
- **disconfirmation-mode** *(derived; not read)* — derived from `scope_authority`: emergent → `seek-disconfirming` embeds continuously through synthesis; pre-registered/phased → it fires at discrete checkpoints. You don't read this dial; it follows scope_authority's pole.

## Walk

You activate a subset of the twelve decision-points per the dials, always honoring the architectural ordering constraints (registration first; substrate-check before decompose/attest; decompose before dispatch; attest before synthesize; synthesize → lint → adversarial-read → evaluate → spot-check; spot-check before user-validation/promote — per ARD SPEC §10.1, the decision-graph).

```
  → [KICKOFF: set the dials WITH the user]  propose + discuss + settle (every path)        ← HITL
dispatch-registration   record the settled dials; persist per path (see §Dispatch registration)
  → substrate-check     survey .research/ for overlapping prior work; surface outcome
  → decompose           emergent: draft ≥3 candidates + comparative assessment + self-flag
                        (optional adversarial pre-check on the chosen decomposition for PR.2 lock-in)
  → [CHECKPOINT A]      confirm decomposition / framing (conversational turn)              ← DD2(a)
                        (multi-path; light path's scope was covered at kickoff)
  → BRANCH on fan-out width discovered at decompose:
      ── light (0–1 facet): attest → synthesize  INLINE in your own context (no spawn)
      ── multi (2+ facets): parallel Agent() × N research-specialist  (one message)
              each specialist: attest (per-source files) → synthesize {within}
  → lint                ../../../scripts/lint-citations.py over the synthesis output(s)
  → [CHECKPOINT B]      surface contradictions before the cross-join (conversational turn) ← DD2(b)
                        (multi-path only; light path has no cross-join)
  → synthesize {cross}  lead composition across specialist briefs → parent.md  (multi-path only)
  → adversarial-read    if rigor ≥ standard  (adversarial-reader subagent)
  → evaluate            if rigor = full  (evaluator subagent, isolated context)
  → spot-check          always; categorical lead-context check across lint pattern categories
  → user-validation     conditional: user is the committing party
  → promote             conditional: converged substrate warrants cross-arc lift
  → done
```

**Multi-sample discipline at `decompose`** (per PR.2 fence): produce **≥3 decomposition candidates** + a comparative assessment + the chosen sample + a `self-flag` note on what framing is shaping facet choices. For breadth-survey-shaped engagements the candidates are *vector sets* (direct / adjacent / analogous); for decomposed engagements they are *facet sets*. The optional adversarial pre-dispatch check (a subagent that tries to break the chosen decomposition) fires when decomposition framing is the load-bearing risk.

**Persist it — write `decomposition-rationale.md` (mandatory for multi-specialist + program walks).** The discipline above is inert unless the candidates are *recorded*: write a `decomposition-rationale.md` at the campaign/program substrate root (`.research/analysis/campaigns/<slug>/`) holding the ≥3 candidates, the comparative assessment, the chosen sample, the `self-flag` note, and a **bracket framing** line naming what the chosen lens may foreclose. This is the PR.2 prevention layer: the discipline is inert when run conversationally — decomposition-framing lock-in takes hold precisely when the candidates are reasoned through but no artifact is authored, so persisting the rationale is what makes the prevention real. The artifact also feeds Checkpoint A (the candidates you surface to the user are the ones you persisted). Program-scale walks write it at **both** cuts — the program-DAG cut and each campaign's facet cut. (Single-pass / light walks where `decompose` doesn't fire are exempt.)

## Checkpoints

The HITL points are **conversational turns**, not tool calls. The framework commits to engaging the human *here*; the mechanism stays host-agnostic. Surface the content as a message, then wait for the user's reply in the normal turn-taking loop and honor it. (Do not reach for `AskUserQuestion` — it is deliberately absent from `allowed-tools`.)

There are two confirm gates (per DD2) plus a kickoff exchange that opens every engagement. The kickoff and Checkpoint A are distinct turns and fire in that order — dials must be set *before* decompose, because `scope_authority` governs how decompose runs.

- **Kickoff — setting the dials (every path; before decompose).** The first and most consequential HITL point. See §Kickoff: setting the dials for the protocol. This is a *discussion to position the engagement*, not a confirm — open with your proposed dials + reasoning + the trade-offs, and settle them with the user before any decomposition or attestation. On the light path, this is the only up-front gate (scope framing folds into it).
- **Checkpoint A — decomposition (after decompose).** Dials are already settled by kickoff; this gate is purely about framing. Present the ≥3 decomposition candidates with comparative assessment + the chosen sample + the `self-flag` note. Ask the user to confirm, adjust, add/collapse facets, or re-frame. (A dial can still be revised here if the decomposition surfaces that kickoff set it wrong — surface that explicitly rather than silently re-dialing.) Wait for the reply; honor it before dispatching. Light path (0–1 facet) has no separate Checkpoint A — the kickoff already covered scope.
- **Checkpoint B — pre-cross-synthesis (multi-path only).** After within-specialist synthesis + lint, before committing the cross-join: surface the candidate `## Contradictions` across specialists and any `NEEDS-REVISION`-level lint findings. Ask before composing the parent summary — this is the smoothing-catch. Wait for the reply.

## Kickoff: setting the dials

The engagement opens by setting its **control-space pre-dispositions** *with the user* — usually by picking an activation-profile (§Activation-profiles) and adjusting it, never by committing a frozen plan. These are the *opening* positions of an in-flight-adjustable trajectory (§In-flight adjustment), not settings locked for the duration. This is a two-way exchange, not an inference you apply and report.

1. **Propose, with reasoning.** State your proposed `scope_authority` and `verification_rigor` (or the profile you'd start from), *why* (what in the seed points to each), and what each commits the engagement to: the rigor → which verification gates fire (§Verification depth); the scope_authority → whether decompose is emergent (you draft + Checkpoint A) or pre-registered (you honor a declared decomposition), and whether in-flight re-scoping is permissioned (§In-flight adjustment). Name the inferred **scale / fan-out** as its own control (single-pass vs multi-specialist — §Fan-out), separately from rigor, so the user positions width and depth independently.
2. **Surface the trade-offs, not just the pick.** E.g. "I read this as `standard` — floor + adversarial-read. If this feeds a committed decision, `full` adds the isolated evaluator; if it's a quick orientation, `floor` is just lint + spot-check. Which fits?" Make the cost/depth trade visible so the user is choosing, not approving.
3. **Settle before proceeding.** Adjust per the user's reply. Only once the dials are set do you move to substrate-check → decompose. The settled dials are recorded in the dispatch registration (§Dispatch registration).

Keep it proportionate: a clearly-scoped, single-pass seed may settle in one short exchange; a multi-domain seed where verification_rigor and scope_authority are both genuinely open warrants more back-and-forth. The goal is a correctly-positioned engagement, not a ceremony.

## In-flight adjustment

Kickoff sets pre-dispositions; the engagement then **re-adjusts each control where the signal that would change it actually arises** — its *signal-local revisit-point* (ARD SPEC §3, the control-space model). You do not re-open every control at every turn; you adjust each at the one place its evidence shows up.

- **Scope-class controls** (decomposition, dimensions/cuts, **scale/fan-out**, source-acquisition) revisit **post-campaign** — the completeness signal comes from reading the campaign's findings *whole*. After synthesis you can see "this needed a fifth specialist" or "two facets collapse"; you cannot see it at kickoff. Re-scoping in flight is **permissioned by `scope_authority`**: `in-engagement-judgment` is its native mode; `mixed` allows it at named points; `pre-registered` forbids it (surface the gap rather than silently re-scoping). This is scope-adaptivity — derived from the dial, not a separate control.
- **Verification-class controls** (which gates fire, which adversarial-read jobs, which failure-shapes to weight) revisit **at the verification stages** — the fidelity signal comes from lint / adversarial-read / evaluate. You cannot sensibly re-scope at adversarial review (it emits no scope-completeness signal), and you cannot sensibly judge fidelity at decompose. Rigor-adaptivity is **asymmetric**: escalate *upward* freely on evidence (a lint or adversarial-read finding can pull a higher gate into play even for a low-dialed engagement), but never prune *below the hard floor* (§Verification depth). "Less" only ever drops a genuinely-unreachable gate (the reachability prune), never erodes the floor.

**Growth that arrives out of place — absorb, defer, or route; never drop or handle-in-place.** When in-flight discovery surfaces a new option (a catalog gains an entry; a control turns up that kickoff didn't set), it is a checkpoint choice: **absorb** (expand this engagement now) or **defer** (land this round, spawn a follow-on) — isomorphic to the work-item lifecycle. And when a signal arises at the *wrong* stage — an adversarial-read job surfacing a *scope* gap rather than a fidelity fix — **route** it to that control's proper revisit-point (the scope gap waits for the post-campaign scope revisit), rather than patching it where it surfaced or letting it fall through. This generalizes the no-home-finding escalation a settled framework position holds: an out-of-category finding is the precise tell of something the current configuration doesn't yet name.

## Verification depth

The verification stack is a subset-select **gate-catalog with a hard-floor core**, not a monolithic switch — the rigor-control instance of the control-space (the canonical gate set + floor + reachability test live in ARD SPEC §7 and §3.1; the per-gate diagnostic catalogs in ARD CATALOGS §3–§5; this section is the operational profile menu over them). **`lint` + `spot-check` are the hard floor** (the mechanical substrate-test + the always-on residual-gap fence — they always fire, never prune); **`adversarial-read` + `evaluate` are the genuinely selectable** rigor options. The `verification_rigor` profiles are **activation-profiles** over the catalog — named subsets that pre-select which selectable gates to add:

| profile (`verification_rigor`) | lint | adversarial-read | evaluate | spot-check |
|---|---|---|---|---|
| `floor` | ✓ (floor) | — | — | ✓ (floor) |
| `standard` | ✓ (floor) | ✓ | — | ✓ (floor) |
| `full` | ✓ (floor) | ✓ | ✓ | ✓ (floor) |

Three things the table alone doesn't show, all first-class:

- **Go custom.** The profiles are legibility bundles, not a closed menu. Activating a selectable gate independently of its tier label is first-class — say so when a seed wants, e.g., `adversarial-read` without escalating to `full` (the evaluator).
- **Escalate upward freely, never prune below the floor** (asymmetric rigor-adaptivity, §In-flight adjustment). A lint or adversarial-read finding can pull a higher gate into play mid-engagement even for a low-dialed start. Downward, the legitimate "less" is just the reachability prune below — never erosion of the floor.
- **Reachability prunes selectable gates structurally.** A gate drops from a *shape's* floor when the failure it fences is not structurally reachable in that shape — `evaluate` (the cross-specialist FR.1 fence) is out of a single-pass scout's floor because cross-specialist framing-contamination cannot arise there. This is a *structural, shape-level* prune (committed at kickoff, governed by `scope_authority`), not a per-instance "N/A here" judgment — the reachability test lives at ARD SPEC §3.1 + §7; honor it, don't re-derive it.

- **lint** — `python3 ../../../scripts/lint-citations.py <synthesis-path> --attestation-dir .research/attestation/`. Default lint-only-warn; pass `--exit-code-on high` to block on high-severity. Run before adversarial-read.
- **adversarial-read** — spawn the [adversarial-reader](../../agents/adversarial-reader.md) with full access (synthesis output + specialist briefs + attestation files + lint output). It returns a verification checklist + `APPROVED`/`NEEDS-REVISION` verdict. `NEEDS-REVISION` triggers a revision pass before `evaluate`.
- **evaluate** — spawn the [evaluator](../../agents/evaluator.md) with **isolated context: pass ONLY the synthesis output (`parent.md`) + the seed.** Do not pass decomposition rationale, specialist briefs, or attestation files — the isolation is the FR.1 fence and you enforce it by what you hand it. Returns a five-component assessment + verdict.
- **spot-check** — you (lead context, full substrate access) sample across all lint pattern categories + load-bearing semantic claims, consuming lint + adversarial-read + evaluator findings. Corrections in place.

A `NEEDS-REVISION` from either adversarial-read or evaluate triggers a revision pass at the indicated scope before proceeding; a second-pass `NEEDS-REVISION` is surfaced to the user, not looped silently.

## Fan-out

Fan-out is the **scale control** — a scope-class control (how wide the harvest is), independent of the rigor control (`verification_rigor`, §Verification depth) and revisited post-campaign (§In-flight adjustment), never folded into the rigor dial. Its width is **discovered at `decompose`**, not preset: the number of facets the decomposition lands on is the number of specialists.

- **0–1 facet → light path (inline, no spawn).** You attest and synthesize in your own context. The discipline is already present via your path auto-load; no injection needed.
- **2+ facets → multi path.** Spawn that many [research-specialist](../../agents/research-specialist.md) agents as **parallel `Agent` calls in a single message**, await them all, then lint. Each specialist's prompt carries: its facet (slug + description), the seed, its brief path (`.research/analysis/campaigns/<slug>/specialists/<facet>.md`), and the attestation path prefix. The discipline is **not** inlined — it arrives via the specialist's `skills: [research-discipline]` injection.

The same SKILL spans the whole range — a one-agent inline brief through a many-specialist program. There is no Workflow tool in this control path — the orchestrator drives in the main conversation loop so the checkpoints can fire as turns.

## Dispatch registration

Nine-field registration per ARD SPEC §9 (the registration contract); value catalogs at ARD CATALOGS §7 (registration enums). **Persistence form by path:** conversation transcript suffices for the light/single-pass path; a `dispatch.md` at the campaign substrate root for multi-specialist and program-scale walks.

Minimum registration:

```yaml
intent: <build-substrate | survey-landscape | validate-claim | calibrate-external | terminate-in-position>
output_kind: <synthesis-brief | landscape-brief | position | [list for cascade-producing]>
consumer: <who or what consumes the output>
verification_rigor: <floor | standard | full>
temporal_contract: write-once-on-converge
scope_authority: in-engagement-judgment        # default; override per dial
analytical_artifact_type: <per-campaign-brief | accumulative-ledger>
primitives_extends: []                          # engagement-specific additions
primitives_opts_out: []                          # + rationale (e.g. light path opts out of specialist-dispatch, evaluate)
```

## Activation-profiles

**Activation-profiles** are named starting configurations across all controls (dials + gate-set + fan-out), **not presets** the framework mandates. Each maps to a set of control positions + a walk-subset this orchestrator reaches dynamically; the operational stance is **"pick a profile (or go custom), then adjust in flight"** (§In-flight adjustment). They are legibility aids — recognizable points in the control-space, not branches.

| Activation-profile | Dial position | Fan-out (scale) | Verification profile (over the gate-catalog) | Output path |
|---|---|---|---|---|
| **focused** | scope_authority emergent; rigor floor–standard | 1 (inline) or a few investigation sub-agents subordinate to one walk | lint + adversarial-read + spot-check | `.research/analysis/briefs/<slug>.md` |
| **breadth-survey** | scope_authority emergent; rigor floor–standard; decompose into direct/adjacent/analogous **vectors** | 1 (inline) or per-vector search sub-agents subordinate to one walk | lint + adversarial-read (job (d) load-bearing for CX.1) + spot-check | `.research/analysis/briefs/<slug>-landscape.md` |
| **decomposed** | scope_authority emergent; rigor full; decompose into 3–7 **facets** | N specialists (one per facet) | full four-stage stack | `.research/analysis/campaigns/<slug>/` |
| **program-scale** | scope_authority often pre-registered (DAG declared); rigor full; decompose into 3–7 **campaigns** on a dependency DAG | campaign Leads, each running a decomposed walk | program-tier full stack | `.research/analysis/campaigns/<slug>/` (campaigns nested) |

Program-scale is the recursion case: each campaign is itself a decomposed walk. When a decomposition lands 7+ facets across 3+ distinct domains, escalate to the program-scale shape (decompose into campaigns, dispatch Leads) rather than over-widening a single fan-out.

## Output paths

Per this deployment's inventory-tier path map (the platform operationalization — `research-band-platform.md`):

- Per-source attestation → `.research/attestation/<handle>.md` (always, before any synthesis prose).
- Light / single-pass / breadth-survey brief → `.research/analysis/briefs/<slug>.md` (`-landscape.md` suffix for breadth-survey).
- Multi-specialist / program campaign → `.research/analysis/campaigns/<slug>/` (`dispatch.md`, `parent.md`, `specialists/<facet>.md`, `verification-checklist.md`, `campaign-evaluation.md`).
- Promoted positions → `.research/analysis/positions/<slug>.md`; staged hypotheses → `.research/analysis/hypothesis/`.

**Refresh case — campaign-path and brief-path are not mutually exclusive.** The campaign-vs-brief split above is by fan-out width *for a fresh engagement*. But when a multi-specialist campaign **refreshes an existing single-file brief** (substrate-check found a prior `briefs/<slug>.md` that downstream artifacts cite), publish the cross-specialist synthesis to that **`briefs/<slug>.md` path** to keep the inbound-reference contract intact, and make the campaign's `parent.md` a **pointer** to it (parent.md remains the substrate anchor: it records the decomposition, holds the verification artifacts, and names where the consumer-facing synthesis was published). Do not orphan inbound references by writing only to `parent.md`.
- **Layout migration on refresh.** A prior campaign may use an older flat layout (facet files at the campaign root rather than under `specialists/`). Default to *coexist* — keep the old flat files if inbound references point at them, and add a pointer in the refreshed `parent.md` — rather than deleting; surface the layout choice rather than silently restructuring.

## Revisit if

- The Workflow tool (or the host) gains a mid-run human-input capability — re-open the SKILL-driven control-flow decision: a Workflow-script driver would then become viable, gaining `pipeline()` determinism + journaling for the unattended stretch.
- The dial-space adds a fourth dial (e.g., engagement-style validity criteria) — extend §Reading the dials to consume it.
- `skills:`-injection of `research-discipline` proves unreliable at specialist scope — the discipline fence is gone there; fall back to inline-bundle propagation and re-open the propagation-mechanism decision.
- The activation-profiles table drifts from how engagements actually position in the control-space — it is a legibility aid, not a spec; prune or update.

## Related

- [ARD SPEC](../../rules/research-band-spec.md) — architecture-tier discipline + §3 (the control-space model this orchestrator enacts but does not re-derive) + §8 (the dial-space contract it consumes).
- [ARD CATALOGS](../../rules/research-band-catalogs.md) — decision-point catalog (§6); per-gate diagnostic catalogs — lint patterns (§3), adversarial-reader + evaluator jobs (§4, §5); registration value catalogs (§7); per-source-class shapes (§2). The gate set + floor + reachability test live at ARD SPEC §7 and §3.1.
- [Platform operationalization](../../rules/research-band-platform.md) — the concrete substrate mapping, attestation tier, and lint deployment.
- [research-discipline](../research-discipline/SKILL.md) — the six-section bundle injected into authoring subagents.
- [research-specialist](../../agents/research-specialist.md) / [adversarial-reader](../../agents/adversarial-reader.md) / [evaluator](../../agents/evaluator.md) — the spawned agent definitions.
