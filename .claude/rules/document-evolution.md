---
paths:
  - ".memory/**"
  - ".work/**"
  - ".claude/**"
  - "docs/**"
  - "AGENTS.md"
  - "CLAUDE.md"
  - "**/AGENTS.md"
  - "**/CLAUDE.md"
---

# Document Evolution

How persistent artifacts (rules, skills, research, designs, sessions, AGENTS.md / CLAUDE.md, ops docs) are maintained.

## Calcification triggers

"Nothing is axiomatic" is the value. Every convention in this project is revisable — designs, research positions, skills, rules, CLAUDE.md, board taxonomy, directory structure, this file. Sticky things (PostgreSQL, git submodules, AGENTS.md adoption) cost more to change, but "sticky" means "expensive," not "immovable."

Here are the **triggers** — when to actually stop and push on a pattern instead of mirroring it:

- **Before matching an existing pattern**, ask whether the pattern is still right for the current context. If it isn't, say so and propose the alternative rather than perpetuating it.
- **When starting work in an area that's being mirrored from prior work**, re-evaluate the framing before extending it.
- **When a rule or convention requires judgment to apply** and two readings disagree, surface the ambiguity rather than picking silently.
- **When a doc or rule exists because it used to exist** and you can't articulate what it's earning, name it and propose deletion or rewrite.
- **When a document grows beyond what its scope justifies**, split it or shrink it. Growth without corresponding scope is itself a calcification signal.

Both humans and agents have preservation bias. The counterweight is whoever is working in the project right now. Default to asking "does this still make sense?" rather than assuming it does.

## Current state, not history

Documents capture **what we think right now**, not the story of how we got here. When a position changes, rewrite the relevant section rather than appending a new version alongside the old one.

**Default delete:** scratchpad artifacts, implementation details, stale TODOs, relocation records, duplicated content, obsoleted how-tos. Skill artifacts that aren't actively useful after a task completes are the short-lifespan end of this — delete when the task completes.

## Artifacts defend themselves inline

This project keeps **no separate decision-record tier**. A position worth keeping lives in the artifact it governs — not in a parallel, history-bearing record that has to be formally superseded.

- **Artifacts defend themselves inline.** A rule, doc, spec, or config states its own constraint and names any load-bearing alternative it rejects — "we use Vidstack, not Plyr (Plyr is deprecated)" is one sentence in the tech reference, not a separate record. If a rationale matters, it lives in the artifact it justifies; if it doesn't matter enough to live there, it isn't preserved.
- **Alternatives that were seriously considered** — name them where the constraint lives, with the reason for rejection a future adversarial reviewer would need. Three-word sketches of obviously-wrong options don't qualify; options that required weighing do. Test: "would a future agent reading this be surprised that we didn't consider X?" → name X and the why-not in the rule/doc/config/spec that owns the choice.
- **Position reversals are in-place rewrites.** Change the artifact to state the new position. When a past agent relying on the old form would behave *wrongly* under the new form — i.e. the path is hazardous to re-walk — name the rejected path explicitly in the artifact and add a checkable revisit condition (see §"Revisit if" applies broadly), so the guard survives. Position *refinements* (better precision on the same form) are rewrite-in-place with no preservation needed.
- **Research-grounded stances** live in `.research/analysis/positions/`; rules and docs link to the position rather than restating its derivation.

Why no decision tier: a decision tier's one unique function is forcing a rejected alternative to be written down. The expectation above replaces that forcing function — self-grounding artifacts carry their own load-bearing rejections inline. The thing a decision record protected against (re-walking a settled path) is, for almost everything, the over-hardening that expectation removes; for the few genuinely *hazardous* paths, the guard survives as an inline sentence in the artifact that owns the constraint.

## Opportunistic inline self-defense

When you encounter load-bearing rationale embedded in prose (a research doc, a design brief, a long CLAUDE.md aside) during normal work — a rejected alternative or a non-obvious constraint a future agent would re-litigate — move it inline into the artifact it justifies then, rather than hunting proactively. Perfect inventory isn't the goal; the goal is that rationale you trip over has a self-grounding home. Bring forward what's in your way; leave what isn't.

## Substrate before stance

Don't make positional claims before the substrate to ground them is in hand. Positional claims include framework selections, source classifications, cluster assignments, categorical claims about how a source fits a pattern, and commitments to a cut or decomposition before the material has been substantively engaged.

Failure mode: positions calcify. Downstream work treats them as settled. When the substrate lands and the position turns out wrong, the wrong position has already propagated — discharging the calcification costs many sessions of retroactive cleanup. This is fabrication-adjacent: it is the general-authoring form of the research band's premature-commitment shape (ARD's `FR.2`).

When the temptation to pre-position arises:

- **Frame as inference, not finding.** "I think X probably says Y" is fine as a tracked working hypothesis (a hypothesis ledger, or a clearly-marked open question); "X says Y" without engaging X is the failure.
- **Mark the gap explicitly.** Use "TBD" / "untested" / "position pending engagement" markers — pre-positioning shows up most easily when the position is left implicit.
- **Push back when asked for the position pre-substrate.** Surface the contamination risk; offer the inference-not-finding alternative.

The same shape applies whether the substrate is a source corpus (research engagement), a code grounding pass (the design stage), or accumulated experience with a system (refactor decisions). Don't commit positions ahead of the substrate that grounds them.

### Second-order substrate-before-stance

The first-order discipline addresses **positions-before-substrate**: don't assert a claim about a source or system before engaging it. The **second-order** discipline addresses **framing-before-substrate**: a post-hoc synthesis artifact used as pre-engagement framing pre-positions what the next reader looks for, importing the synthesis's analytical framings into the descriptive layer before the source has been read on its own terms.

The mechanism is different — the agent may have engaged the raw material, but the analytical frame it applies was already set by a synthesis artifact consulted pre-engagement. The resulting work looks substrate-grounded while actually being framing-derived.

Synthesis artifacts — cross-source mappings, framework surveys, a vocabulary file's analytical sub-sections — are post-hoc reading material for analytical work, **not** pre-engagement framing for descriptive work. Read the source on its own terms first; consult synthesis artifacts to check how surfaced hypotheses relate to the accumulated synthesis afterward. The research band's strict layer-directionality discipline (analytical-tier artifacts not consulted during descriptive-layer authoring — ARD's structural fence) is the structural enforcement; this rule addresses the cognitive risk that survives even structural separation when an agent reaches across layers in its reasoning.

## "Revisit if" applies broadly

Anything that stakes out a view should name its own revisit conditions — research positions, rules, design assumptions, the hazardous-path guards named inline per §Artifacts defend themselves inline. A `revisit_if:` frontmatter field (or a `## Revisit if` section) makes the condition checkable: an agent, or a scan rule, can walk the project and flag conditions that may have tripped. Checkable conditions are stronger than prose breadcrumbs.

Prose breadcrumbs of the form `Revised 2026-04-20 (previously favored X — see git history)` are still useful as pointers when a full rewrite isn't warranted — but prefer structured fields on docs that can carry them.

## Link rather than inline

When supporting context is relevant but not essential, link to it rather than copying it into the current doc. A rule links to the research position that motivated it. A design doc links to the rule that constrains it. An item links to the design doc. Each layer preserves its own concerns; nothing duplicates.

Agents reading a doc should be able to reach everything they need in one or two hops, but shouldn't have to absorb all of it upfront. Lazy loading beats eager loading when the reader's question is narrow.

Prefer extending existing docs over creating new ones when scope overlaps. Every new doc is a new thing to maintain; fold into an existing doc unless the scope is genuinely distinct.

## Rules describe behavior directly

A rule in `.claude/rules/` (and a skill in `.claude/skills/`) is an agent-facing behavior spec: an agent reads it and applies it, without following outbound links to recover the rule's *operative* meaning. Keep the behavior in the rule's own voice; don't make a rule depend on an external doc to be understood.

- **No links into transient `.work/` items.** Items are temporal by design (`active/` → `archive/` → `releases/`), so a rule that links a specific item rots when the item moves (the durability gradient below). Name the behavior involving the tier generically instead — *"write a `.research/` position when X"*, *"item structure follows `.work/CONVENTIONS.md`"* — that's describing behavior, not chaining the agent to a specific transient artifact.
- **Research / position links are allowed as lean pointers.** A rule may cite a `.research/analysis/positions/` artifact as its archaeology surface (the rule is the operative spec; the position carries the derivation and the revisit conditions). Keep the pointers lean: a rule shouldn't bury its behavior under a thicket of refs, and any "why" that needs more than a pointer's worth of space is either inlined in the artifact that owns the constraint (per §Artifacts defend themselves inline) or written into a `.research/` position the rule then references — not left to thicken the rule.

## Reference direction (the durability gradient)

Persistent artifacts sit on a durability gradient. `.claude/rules/` and `.research/` are **durable** — conventions, settled positions, and substrate. `.work/` is **transient**: items move through a lifecycle (`active/` → `archive/` → `releases/`) and are re-pathed or deleted as work completes.

**References flow up the gradient, never down.** A durable artifact must not carry a markdown link — or a link-checked backtick path — *into* `.work/`. Such links rot the moment the item archives or is re-pathed, and `scripts/check-doc-links.py` flags them then. Transient `.work/` items freely reference durable substrate (a story cites the rule or position that governs it); the reverse is the violation.

When a durable artifact needs to record provenance ("decided during work X") or routing ("this triggers work Y"), **name the work in plain prose** — the slug or a descriptive phrase, no link and no backtick path — or link the **durable output** the work produced (a `.research/` position, a rule). The prose mention survives the item's lifecycle; the link does not.

`.memory/sessions/` and `.research/analysis/campaigns/` are exempt: session notes and completed campaign bundles are point-in-time snapshots that record what was true then (including active-at-the-time `.work/` paths); the link-checker skips them.

Why: a durable record's worth is that it stays correct as the work around it churns. A link down into transient work couples the record's integrity to the item's lifecycle — exactly the coupling this gradient prevents.

Three behavioral rules follow from the gradient:

- **Durable artifacts stand on their own.** A reader of a rule, a `.research/` position, or a doc should learn the position, the rationale, the alternatives, and the revisit conditions *from the artifact itself* — not by following links into work items. The authoring trail is recovered via *inbound* references **to** the artifact (`grep` its slug across `.work/`), not maintained as outbound references **from** it.
- **Genuine exception — structural waiting on structural.** When a durable artifact genuinely depends on work that will land in a durable tier, describe the structural *condition*, not the transient artifact: *"when the attestation primitives land in `.research/…`"*, not *"when feature X ships."* The condition is durable; the item that delivers it is not.
- **Self-healing.** A future agent touching a durable doc and finding a downward reference into `.work/` rewrites the section to remove the link (preferred), or upgrades the target if a more-durable destination exists for the same material (point at a `.research/` position or a rule instead of an active item).

READMEs are user-facing surfaces with their own discipline — see [readme-discipline.md](readme-discipline.md). AGENTS.md / CLAUDE.md serve agents; the general principles in this file apply when authoring them.

## Commit messages on position-changing commits

Commit messages are the index for git as an archive. When a commit **changes a position, reverses a settled call, or moves content between durability tiers** (scratchpad → canon, research position → rule, prose rationale → inline self-defense), write the message as if a future agent will need it to reconstruct why.

Default code-change commits don't need this weight — save the discipline for commits that touch how we *think*, not how we *build*. A commit that moves a research position into a rule with restructured rationale deserves a few sentences of framing. A commit that fixes a typo needs `fix typo`.

## Archaeology cost is asymmetric

If an answer needs to be cheap for an agent reader to find, put it in a structured field where retrieval is one read. If the answer is rare and its cost is justified, git archaeology is acceptable as a deliberate tool call — not the default path for anything an agent may need to rediscover often.

## Revisit if

- A convention here is consistently violated in practice — indicates rule unclarity, drift, or that the convention has stopped earning attention.
- Load-bearing rationale starts going unrecorded because no artifact obviously owns it — the inline-self-defense norm has a gap; revisit whether a lightweight structured home is needed for ownerless rationale.
- A new persistent-artifact tier emerges that doesn't fit the current research / sessions split — revisit which conventions apply.
- Calcification-trigger reflex stops surfacing real questions — either over-internalized to no signal, or the rule has lost cultural weight.
- Forensic archaeology becomes a recurring pain point in practice — revisit whether inline-self-defense plus git covers the common case.
- Cross-agent adoption reaches a tipping point where non-Claude readers can't follow these conventions for structural reasons — may need to relocate the rule to a more neutral home or restate in agent-agnostic terms.
