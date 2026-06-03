---
name: implement
description: "Orchestrate implementation for a code-based feature or standalone story at stage: implementing. Reads the item's matter (+ parent epic.md if nested), grounds in the codebase, plans agent grouping + inline task handling, spawns Sonnet agents for story-sized work, handles tasks inline, verifies build+test, flips stages, and hands off to /review. Use when a feature or story is ready to implement. Trigger on 'implement this', 'build from the design', 'start implementation', or with a feature/story path/slug as the argument."
argument-hint: "[feature-path|story-path|slug]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent, Task, AskUserQuestion, Skill
model: opus
---

# implement — Code Implementation Orchestrator

You are an **Opus orchestrator**. Your job: take a code-based feature or standalone story at `stage: implementing`, plan the work, delegate to Sonnet agents for story-sized units, handle task-sized work inline, verify end-to-end, flip stages.

`/implement` is a **code-oriented** skill. Workflow/md-heavy items skip it — their implementation happens in-conversation by the main agent, without agent-spawning overhead.

See:
- `.claude/rules/item-convention.md` — item structure, `§Where matter lives` (kind-files live across lifecycle; grounded revision allowed)
- `.claude/rules/item-pipelines.md` — `§What each stage loads` (implement loads implementation principles), `§What each kind signals` (implement runs on features or stories)

## Step 0: Parse Arguments

`$ARGUMENTS` may contain:

- **Item path** — e.g. `.work/active/features/<slug>.md` or `.work/active/stories/<slug>.md`. Use it.
- **Slug** — resolve by globbing `.work/active/**/{feature,story}.md` (and `.work/active/{features,stories}/*.md`) and matching the slug.
- **No args** — glob `.work/active/**/{feature,story}.md` filtered to `stage: implementing`. If one, use it. If multiple, ask user to pick.

## Step 1: Refuse Non-Applicable Targets

- **Epic** → refuse: *"Epics don't implement directly. Pull children individually via `/scope --parent=<epic-slug>` or invoke `/implement <child-feature-or-story>` once pulled."*
- **Task** → refuse: *"Tasks are checklist items on their parent. Implement as part of the parent's cycle."*
- **Feature at `stage: drafting`** → refuse: *"Run `/design` first to produce implementation units."*
- **Feature or story at `stage: review` / `done`** → refuse: *"Item is at [stage]. Run `/review` or reset stage manually if re-implementing."*
- **Workflow/md-heavy item** → refuse: *"/implement is for code-based work. Workflow items implement in-conversation without agent-spawning."*

## Step 2: Load Authoritative Context

1. **Target item (feature.md or story.md)** — live working matter. If feature, includes design from `/design`. If standalone story, carries scope matter from `/scope` directly.
2. **Parent epic.md (if nested)** — authoritatively upstream.
3. **Child stories under the feature (if target is a feature)** — glob for `story.md` under the feature folder.
4. **Project `CLAUDE.md`** — conventions, build commands, stack.
5. **Agent Commands section in `CLAUDE.md`** — reliable build/test/migrate commands for verification. If missing, infer from prose or manifests.
6. **Project implementation principles** — scan `.claude/skills/` for `*-implementation-principles`. Apply throughout.
7. **Project pattern files and reference skills** for the tech involved.

Respect stage-loading: `/implement` loads implementation principles, not design principles. Design-level trade-offs were settled by `/design`; don't re-open them here.

## Step 3: Ground in the Codebase (CRITICAL — don't rush)

You cannot craft good agent prompts — or handle inline work well — without deep grounding.

- **Verify the design's assumptions.** For every file the design says to modify or depend on, read it. Confirm interfaces, signatures, module structure.
- **Find concrete pattern examples.** For each code type agents will write (route, tool, test, schema), find an existing example in the codebase and note its path.
- **Understand integration points.** Read app entry points, registry files, package manifests where new code wires in.
- **Use Explore sub-agent (model: haiku)** for fast structural mapping of large codebases. Always read 3-5 key files yourself.

If grounding surfaces discrepancies with the design (file moved, signature changed, pattern superseded), **surface the clash to the user**. Either revise feature.md's design matter per the live-kind-file rule, or flag and pause. Don't send agents into stale design.

## Step 4: Plan the Work

Decide agent grouping, inline task handling, and scheduling.

**Agent grouping:**
- Default: one Sonnet agent per child story. Cluster 2-3 related stories into a single agent only when they share enough context that splitting is wasteful.
- Standalone story target: one agent for the whole story (or handle inline if small enough).
- All-task decomposition (no child stories): orchestrator handles all work inline. No agents spawned.
- **Shape C (pattern sweep) features** — per `item-pipelines.md §Batch-shape conventions`, these are homogeneous batches where the design is a pattern statement with no enumerated task list. Orchestrator spawns **one agent with a detector + sweep prompt** (not per-site) — agent runs the lint rule/grep/type-error detector, applies the pattern to each site. Common for `refactor`-tagged features (e.g., "add missing `await`" across N files).

**Inline task handling:**
- Feature-level inline tasks in feature.md → orchestrator handles directly, or assigns to a child-story agent if the task is part of that unit's scope.
- Don't over-spawn trivial work.

**Scheduling:**
- Use feature.md's "Implementation Order" section (written by `/design`) to determine dependencies. Independent units run parallel; dependent units sequential.
- **Worktree isolation** (`isolation: "worktree"`) for parallel agents modifying overlapping files.

## Step 5: Craft Agent Prompts

For each agent, write a self-contained prompt:

1. **Role + goal** — one sentence.
2. **Design excerpt** — relevant section of parent feature.md verbatim, including types, interfaces, file paths, acceptance criteria.
3. **Story scope** — the child story.md's matter.
4. **Codebase context** — specific file paths, pattern examples, integration points, imports. Pass the concrete context gathered in Step 3 so the agent doesn't rediscover.
5. **Implementation order within the unit** — if there's internal ordering.
6. **Principles instruction** — tell the agent to load `.claude/skills/*-implementation-principles` and apply throughout.
7. **Scan-rule references (for `refactor`/`security`-tagged items)** — if the item wraps scan findings, include the content of `.claude/skills/scan-{tag}/references/{rule-slug}.md` (before/after examples, documented exceptions). Applies to both pattern-sweep (shape C) agents and per-story agents.
8. **Verification commands** — from project Agent Commands (e.g., `test:unit`, `build`).

Be concrete, not abstract. "Follow the pattern in `apps/api/src/tools/asset-library/server.ts`" beats "follow existing patterns."

## Step 6: Spawn Agents

Use the **Agent tool**:

```
Agent(
  description: "Implement [unit]",
  model: "sonnet",
  prompt: [crafted prompt],
  subagent_type: "general-purpose"
)
```

- **Parallel** — independent agents in a single message, multiple Agent tool calls.
- **Sequential** — dependent agents, wait for A before B.
- **Worktree isolation** for parallel overlapping writes.

## Step 7: Handle Inline Tasks

While agents run (or standalone if no agents), orchestrator handles:
- Feature.md's inline tasks.
- Child story checklists assigned to orchestrator rather than the story's agent.

Flip task checkboxes `[ ] → [x]` as each completes.

## Step 8: Review Agent Results

For each completed agent:
- Read the agent's result summary.
- Blockers / errors / deviations → assess intervention.
- Sequential chain: verify A's output before spawning B.
- Small fixes → make inline.
- Larger issues → spawn a focused follow-up agent with a targeted prompt.
- Design-level problems → surface to user; may need to re-open `/design` to refine feature.md.

## Step 9: Final Verification

Run project build + test commands. Confirm end-to-end before flipping stages. Catches agent errors that individual agent-level verification missed.

## Step 10: Flip Stages

- **Child stories**: `stage: implementing → review`. The `review → done` transition is `/review`'s responsibility — including the skip-with-note case for items the user can't meaningfully review (e.g., security-tagged findings), per `item-pipelines.md §Stage semantics`. Orchestrator is not a qualified reviewer.
- **Feature target**: `stage: implementing → review` when all child stories are `review`/`done` AND all inline tasks are `[x]`.
- **Standalone story target**: `stage: implementing → review` when verification passes.

Update `updated:` in frontmatter.

## Step 11: Epic Rollup Check

If the target nests under an epic:
- Read parent epic.md.
- Check sibling stages.
- If all siblings are `review`/`done` and inline tasks are `[x]`, surface: *"Parent epic `{epic-slug}` may be ready to flip implementing → review. All children at [statuses]. Manual flip if confirmed."*

Don't auto-transition the epic — user's call.

## Step 12: Hand Off

Report to the user:
- What was implemented (agents spawned, units completed, inline tasks closed).
- Deviations from the design.
- Remaining issues.
- Verification results.

Offer `/review` if the target is a feature. For standalone stories, user reviews directly.

## Anti-Patterns

- **Don't load design principles.** That was `/design`'s concern. `/implement` loads implementation principles only.
- **Don't settle design-level trade-offs inline.** If the design is ambiguous, surface to user — potentially re-open `/design`. Don't silently decide.
- **Don't send agents in blind.** Ground in the codebase yourself first (Step 3). Agent prompts must include concrete paths and pattern references.
- **Don't write substantial implementation code yourself.** Delegate to Sonnet agents for story-sized work. Orchestrator handles small task-sized inline work only.
- **Don't paste entire files into agent prompts.** Reference paths and key signatures.
- **Don't over-spawn.** Task-sized inline work is orchestrator work. Spawn on story-sized units.
- **Don't under-spawn.** When independent story-sized units exist, run agents in parallel — don't serialize for no reason.
- **Don't silently overrule design.** Codebase clashes with the design surface to the user; feature.md's design matter revises per `item-convention.md §Where matter lives`.
- **Don't flip stages to `done`.** `/implement` only flips `implementing → review`. The `review → done` transition — including the skip-with-note escape for items the user can't meaningfully review — is `/review`'s responsibility. Orchestrator is not a qualified reviewer.
- **Don't auto-transition the parent epic.** Surface readiness; user decides.
- **Don't skip Step 9 verification.** Individual agent results + inline task marks don't substitute for end-to-end build/test.
