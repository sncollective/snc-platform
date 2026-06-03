---
name: design
description: "Produce the code-level design for a feature at stage: drafting. Reads feature.md (+ epic.md if nested) as the scope context, loads project CLAUDE.md, patterns, and source, spawns Explore sub-agents to map the codebase, then writes design matter into feature.md in place and spawns child stories/tasks for each implementation unit. Hands off to /implement. Use when a feature is ready to design, or the user says 'design this feature', 'write the design', 'plan the implementation'."
argument-hint: "[feature-path|feature-slug]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion, Skill
model: opus
---

# design — Feature Design + Implementation Decomposition

Produce the code-level design for a feature. Extend `feature.md` in place with architectural overview, implementation units, test strategy, verification. Decompose work into child stories (story-sized units) and inline tasks (task-sized units). Flip the feature's stage to `implementing` so `/implement` can pick up.

`/design` is a **code-oriented** skill. It's for features where the deliverable is code. Workflow/md-heavy features do not use `/design` — their `feature.md` matter from `/scope` is their design.

See:
- `.claude/rules/item-convention.md` — item structure, `§Where matter lives` (kind-files live across stages; grounded revision surfaces clashes to the user)
- `.claude/rules/item-pipelines.md` — `§What each stage loads` (design loads codebase + project principles), `§What each kind signals` (design only runs on features)

## Step 0: Parse Arguments

`$ARGUMENTS` may contain:

- **Feature path** — e.g. `.work/active/features/<slug>.md`. Use it.
- **Feature slug** — e.g. `uploads-retry`. Resolve by globbing `.work/active/**/feature.md` (and `.work/active/features/*.md`) and matching the slug.
- **No args** — glob `.work/active/**/{feature.md,features/*.md}` filtered to `stage: drafting`. If one, use it. If multiple, ask user to pick.

## Step 1: Refuse for non-applicable targets

Refuse with a clear signal about the next action when the target is not a code-based feature at `stage: drafting`:

- **Target is not a feature** (epic / story / task) — *"/design runs on features. This is a [kind]. Epics pull children via `/scope --parent=<epic-slug>`; stories implement directly; tasks are inline or checklists."*
- **Feature is already past drafting** (`stage: implementing` / `review` / `done`) — *"This feature is at stage: [x]. /design runs at drafting. If you need to revise the design, the feature.md is a live artifact — edit in place, or re-scope via `/scope`."*
- **Feature is workflow/md-heavy** (tag `workflow` present, or no code-domain tag) — *"/design is for code-based features. Workflow features skip /design — feature.md matter from /scope is the design. Extend feature.md directly."*

Stop after the refusal; don't proceed into codebase loading.

## Step 2: Load Authoritative Context

Read, in this order:

1. **feature.md** — the live working matter from `/scope`. Treat as collaborative input, not frozen. `/design` may extend AND (with grounded revision) refine — surfacing clashes to the user per `item-convention.md §Where matter lives`.
2. **Parent epic.md (if nested)** — authoritatively upstream. Respect architectural direction; don't re-evaluate unless the child's work surfaces a grounded conflict with the epic.
3. **Project `CLAUDE.md`** — project conventions, build commands, stack.
4. **Project pattern skills** — scan `.claude/skills/` for pattern files, project principles (`*-design-principles`, `*-implementation-principles`). Apply design principles; defer implementation principles to `/implement`.
5. **Reference skills for libraries the feature targets** — glob `.claude/skills/` for matching skill directories. For each critical tech, check whether the reference covers the **specific APIs you'll design against**. A partial reference is not a blanket greenlight. If uncovered APIs are in play, flag to the user before designing against them.
6. **Related research** — `.research/`. Surface relevant prior exploration.
7. **Scan-rule references (for `refactor`/`security`-tagged features)** — if the feature wraps scan findings, read `.claude/skills/scan-{tag}/references/{rule-slug}.md` for each rule cited. Before/after examples and documented exceptions inform the design. When multiple valid approaches exist for how to satisfy a rule, surface the approach-comparison in Step 5.

## Step 3: Explore Codebase via Sub-Agents

Spawn parallel Explore sub-agents (model: **haiku**) for fast codebase mapping. Launch in a **single message**:

1. **Codebase structure** — directory layout, module structure, entry points. All source files and primary exports.
2. **Interface & type inventory** — exported interfaces, types, function signatures with file paths and full signatures.
3. **Test structure** — testing patterns, helpers, fixtures, test file organization.

Wait for all results before proceeding.

## Step 4: Cross-Check Sub-Agent Results

Read **2-3 key source files yourself** to verify the sub-agent findings. Verify paths, signatures, patterns — catch stale or wrong output.

## Step 5: Clarify Ambiguities with the User

Identify ambiguities before committing design decisions:

- **Requirements gaps** — missing acceptance criteria, unclear edge cases, undefined error behavior.
- **Architecture trade-offs** — when multiple valid approaches exist, surface with pros/cons and ask the user.
- **Scope clashes with feature.md** — if codebase discovery surfaces that something in feature.md (from `/scope`) conflicts with reality, surface the clash, propose the revision, confirm with the user before rewriting.
- **Scope boundaries** — what's in vs. out when feature.md is unclear.
- **Integration assumptions** — external system / API / service behavior.
- **UX decisions** — interaction details not covered by wireframes or UX docs.

Ask the user. Don't guess. A design built on silent assumptions is worse than one that paused for clarification.

## Step 6: Design Implementation Units

Each unit specifies:

- **Exact file path** (e.g. `apps/api/src/routes/uploads.ts`, not "the uploads file")
- **Interfaces, types, function signatures** in the project's language (full code blocks)
- **Implementation notes** for non-obvious logic
- **Acceptance criteria** — testable assertions, not subjective judgments

What to avoid:

- Prose descriptions of interfaces instead of actual type definitions
- Leaving choices to the implementer ("use an appropriate data structure")
- Subjective acceptance criteria
- Missing error handling
- Code blocks with missing imports
- Test designs that don't work with the designed implementation interfaces

## Step 7: Design Test Approach

Per unit, design test structure, key test cases, fixture needs. Trace the call path from test to implementation — if the function as designed can't be tested, redesign the signature (add a parameter, extract a helper) before finalizing the test.

## Step 8: Verify Code Blocks

Before writing anything durable, re-read every code block in your draft and verify:

1. **Imports complete** — every symbol used in the snippet is imported or defined.
2. **Test approach matches implementation interfaces** — tests can actually call the functions with the arguments needed. If not, adjust the signature.
3. **Library behavior accounted for** — built-in serializers, interceptors, magic keys, option interactions. Check library docs for surprises.
4. **Type annotations help, not hurt** — if the library's inferred type carries richer info (generics, discriminated unions), omit explicit annotations.

## Step 9: Specify Implementation Order

Resolve dependencies. Which unit builds first; which need types/files from earlier units.

## Step 10: Write Design Matter Into feature.md

Extend `feature.md` in place. Append or refine the following sections after the scope matter from `/scope`:

```markdown
## Design Overview

{Architectural decisions with reasoning — not just the decision, include why. Trade-offs considered. Pattern references grounded in code.}

## Implementation Units

### Unit 1: {Name}

**File:** `path/to/file.ts`

\`\`\`typescript
// Exact interfaces, types, function signatures
\`\`\`

**Implementation notes:**
- {Non-obvious logic}

**Acceptance criteria:**
- [ ] {Testable assertion}

### Unit 2: ...

## Implementation Order

1. Unit X first (reason)
2. Unit Y next

## Test Strategy

{Per-unit test structure, key test cases, fixtures}

## Verification Checklist

{Commands to verify end-to-end — build, lint, test, type-check}
```

If `/design` revised earlier scope matter (per Step 5 clashes), the revision is already in feature.md — surfaced to the user during the clarification step. Don't silently rewrite.

## Step 11: Decompose — Child Stories and Inline Tasks

For each implementation unit, decide story vs task per `item-pipelines.md §What each kind signals`:

- **Story-sized** (contained delivery with its own scope worth tracking) → create `<feature-folder>/<unit-slug>/story.md` at `stage: implementing`. Brief scope (one paragraph pointing at the unit in parent feature.md), frontmatter with `parent: <feature-slug>`, optional story-internal tasks. `/implement` picks up stories later.
- **Task-sized** (checklist-line trivial, no additional ambiguity to surface) → append `- [ ] <task>` to feature.md's inline task list **or** to a child story's checklist if the task is part of that story's scope. `/design` judges where it belongs.

Decomposition rules:

- Don't gratuitously split. If all units live well as inline tasks in feature.md, don't force child stories.
- Don't under-split. If a unit has its own scope, edge cases, or delivery risk worth tracking, it's a story.
- Reference parent feature.md in child story prose rather than duplicating design unit details.
- **Agent grouping is not /design's concern.** How many agents run, which stories cluster into a single agent's scope, parallel vs sequential — all orchestrator decisions owned by `/implement`. /design names logical units and dependency order; the orchestrator schedules.
- **All-task decomposition is valid.** If every implementation unit is task-sized, no child stories get created — all tasks land as inline checklist items. `/implement` handles naturally in orchestrator mode (no agents spawned, work done in-conversation).

## Step 12: Flip Stage

Edit feature.md frontmatter: `stage: drafting → implementing`. Bump `updated:` to today.

## Step 13: Offer Next Step

> *"Design written to `<feature-path>`. {N} child stories created under the feature folder; {M} inline tasks listed. Feature flipped to stage: implementing. Ready to run `/implement`?"*

If user confirms, invoke `/implement` via the Skill tool with the feature path as target. If declined, stop cleanly.

## Anti-Patterns

- **Don't write code.** `/design` produces specs; `/implement` writes code.
- **Don't load implementation principles** (`*-implementation-principles`). That's `/implement`'s context per `item-pipelines.md §What each stage loads`.
- **Don't skip Step 4 cross-check.** Sub-agent output is high-quality but not perfect; verify key paths and signatures yourself.
- **Don't skip Step 5 clarification.** Ambiguities become guesses become bad designs. Ask the user.
- **Don't skip Step 8 verification.** Verifying code blocks pre-write catches the recurring issues the verification bullets name.
- **Don't gratuitously rewrite feature.md matter.** Grounded revision only — codebase discovery surfacing a real clash with scope. Surface the clash, propose the revision, confirm, then edit.
- **Don't overrule the parent epic.** If a feature's design surfaces a conflict with epic-level architectural direction, that's a signal to pause and discuss with the user, potentially refining the epic (grounded parent-revision per `item-convention.md §Where matter lives`) rather than silently diverging.
- **Don't vague the types.** NEVER be vague about types or interfaces — specify them exactly.
- **Don't skip error handling design.** Every unit that can fail designs its failure surface.
- **Don't annotate a return type when the library's inferred type carries richer info.** Let TypeScript infer.
- **Don't design against an uncertain API.** Check for reference skills first; if the library's APIs you need aren't covered, flag the gap before proceeding.
- **Don't design tests without verifying call paths.** Trace test → implementation to confirm the designed function can be called with the arguments the test needs.
- **Don't split into child stories gratuitously.** Inline tasks are fine when the unit doesn't need focused-context implementation.
- **Don't skip the stage flip.** feature.md at `stage: drafting` with design matter written but stage not flipped is an inconsistent state.
