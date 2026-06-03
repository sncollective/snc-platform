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

How persistent artifacts (rules, skills, decisions, research, designs, sessions, AGENTS.md / CLAUDE.md, ops docs) are maintained.

## Calcification triggers

"Nothing is axiomatic" is the value. Every convention in this repo is revisable — decisions, designs, research positions, skills, rules, CLAUDE.md, board taxonomy, directory structure, this file. Sticky things (PostgreSQL, git submodules, AGENTS.md adoption) cost more to change, but "sticky" means "expensive," not "immovable."

Here are the **triggers** — when to actually stop and push on a pattern instead of mirroring it:

- **Before matching an existing pattern**, ask whether the pattern is still right for the current context. If it isn't, say so and propose the alternative rather than perpetuating it.
- **When starting work in an area that's being mirrored from prior work**, re-evaluate the framing before extending it.
- **When a rule or convention requires judgment to apply** and two readings disagree, surface the ambiguity rather than picking silently.
- **When a doc or rule exists because it used to exist** and you can't articulate what it's earning, name it and propose deletion or rewrite.
- **When a document grows beyond what its scope justifies**, split it or shrink it. Growth without corresponding scope is itself a calcification signal.

Both humans and agents have preservation bias. The counterweight is whoever is working in the repo right now. Default to asking "does this still make sense?" rather than assuming it does.

## Current state, not history

Documents capture **what we think right now**, not the story of how we got here. When a position changes, rewrite the relevant section rather than appending a new version alongside the old one.

**Default delete:** scratchpad artifacts, implementation details, stale TODOs, relocation records, duplicated content, obsoleted how-tos. Skill artifacts that aren't actively useful after a task completes are the short-lifespan end of this — delete when the task completes.

**Preserve via structured fields, not prose appendage:**

- **Alternatives that were seriously considered** with reasons for rejection a future adversarial reviewer would need. Three-word sketches of obviously-wrong options don't qualify; options that required weighing do. Test: "would a future agent reading this be surprised that we didn't consider X?" → put it in the decision record's `Alternatives considered` section.
- **Decision reversals** — `superseded_by` / `supersedes` frontmatter on the relevant decision records. The old decision's existence and reversal rationale stay; the prose narrative doesn't.
- **Position changes where a past agent relying on the old form would behave wrongly under the new form** — write a new decision record (or revise an existing one's `Revisit if`) capturing the shift. Position *refinements* (better precision on the same form) are rewrite-in-place, not preservation.

When a decision deserves preservation, **promote it to `.memory/decisions/<scope>-NNNN-<slug>.md`** with structured frontmatter (`status`, `revisit_if`, alternatives in matter). Records carry the load; prose docs stay current.

## Opportunistic decision promotion

When you encounter decision content embedded in prose (research docs, design briefs, CLAUDE.md, other artifacts) during normal work, promote it to a structured decision record then, rather than hunting for hidden decisions proactively. Perfect inventory of historical decisions isn't the goal — the goal is that decisions encountered in practice have a structured home. Bring forward what's in your way; leave what isn't.

## "Revisit if" applies broadly

Decision records carry `revisit_if:` frontmatter — explicit conditions under which the decision should be reconsidered. The pattern extends beyond decisions: research positions, rules, design assumptions, and anything else that stakes out a view should name its own revisit conditions. Checkable conditions are stronger than prose breadcrumbs because an agent (or a future scan rule) can walk the repo and flag conditions that may have tripped.

Prose breadcrumbs of the form `Revised 2026-04-20 (previously favored X — see git history)` are still useful as pointers when a full rewrite isn't warranted — but prefer structured fields on docs that can carry them.

## Link rather than inline

When supporting context is relevant but not essential, link to it rather than copying it into the current doc. A decision record links to the research that motivated it. A design doc links to the decision that committed it. An item links to the design doc. Each layer preserves its own concerns; nothing duplicates.

Agents reading a doc should be able to reach everything they need in one or two hops, but shouldn't have to absorb all of it upfront. Lazy loading beats eager loading when the reader's question is narrow.

Prefer extending existing docs over creating new ones when scope overlaps. Every new doc is a new thing to maintain; fold into an existing doc unless the scope is genuinely distinct.

## Reference direction (the durability gradient)

Persistent artifacts sit on a durability gradient. `.memory/decisions/`, `.claude/rules/`, and `.research/` are **durable** — settled positions, conventions, and substrate. `.work/` is **transient**: items move through a lifecycle (`active/` → `archive/` → `releases/`) and are re-pathed or deleted as work completes.

**References flow up the gradient, never down.** A durable artifact must not carry a markdown link — or a link-checked backtick path — *into* `.work/`. Such links rot the moment the item archives or is re-pathed, and `scripts/check-doc-links.py` flags them then. Transient `.work/` items freely reference durable substrate (a story cites the decision that governs it); the reverse is the violation.

When a durable artifact needs to record provenance ("decided during work X") or routing ("this triggers work Y"), **name the work in plain prose** — the slug or a descriptive phrase, no link and no backtick path — or link the **durable output** the work produced (a decision record, a `.research/` position, a rule). The prose mention survives the item's lifecycle; the link does not.

`.memory/sessions/` is exempt: session notes are point-in-time snapshots that record what was true then (including active-at-the-time `.work/` paths); the link-checker skips them.

Why: a durable record's worth is that it stays correct as the work around it churns. A link down into transient work couples the record's integrity to the item's lifecycle — exactly the coupling this gradient prevents.

## Commit messages on position-changing commits

Commit messages are the index for git as an archive. When a commit **changes a position, reverses a decision, or moves content between durability tiers** (canon → decision, scratchpad → canon, research → decision record), write the message as if a future agent will need it to reconstruct why.

Default code-change commits don't need this weight — save the discipline for commits that touch how we *think*, not how we *build*. A commit that moves a research position into a structured decision record with restructured rationale deserves a few sentences of framing. A commit that fixes a typo needs `fix typo`.

## Archaeology cost is asymmetric

If an answer needs to be cheap for an agent reader to find, put it in a structured field where retrieval is one read. If the answer is rare and its cost is justified, git archaeology is acceptable as a deliberate tool call — not the default path for anything an agent may need to rediscover often.

## Revisit if

- A convention here is consistently violated in practice — indicates rule unclarity, drift, or that the convention has stopped earning attention.
- Decision-record volume grows past grep practicality (e.g., hundreds per project) — may need an indexer or `tag-view.py --decisions` extension; structured-retrieval-as-default starts breaking.
- A new persistent-artifact tier emerges that doesn't fit the current decisions / research / designs / sessions split — revisit which conventions apply.
- Calcification-trigger reflex stops surfacing real questions — either over-internalized to no signal, or the rule has lost cultural weight.
- Forensic archaeology becomes a recurring pain point in practice — revisit whether the structured-records-cover-the-common-case bet still holds, and whether to revive the parked archaeology-mechanism question.
- Cross-agent adoption reaches a tipping point where non-Claude readers can't follow these conventions for structural reasons — may need to relocate the rule to a more neutral home or restate in agent-agnostic terms.
