---
name: scope
description: "Interactive sizing and active-tier promotion. Takes a backlog slug, a --parent child idea, or a fresh seed, sizes into epic/feature/story/task, and writes the active folder + kind-named file. Hands off to /design for features. Trigger on 'scope this', 'scope this out', \"let's plan X\", 'I want to build X', 'help me think through X', or with a backlog slug as the direct argument to promote a parked item."
argument-hint: "[slug|seed-idea] [--parent=<parent-slug>]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion, Skill
model: opus
---

# scope — Item Sizing + Active Promotion

You guide the user through sizing new work and promoting it into the active tier. The kind-file (`epic.md` / `feature.md` / `story.md`) is the output of this session — not a prerequisite.

See:
- `.work/CONVENTIONS.md` — item structure + frontmatter schema + §Where matter lives
- `.work/CONVENTIONS.md` — stage flow, §What each kind signals, §What each stage loads
- `.work/CONVENTIONS.md` — tag rubric

## Step 0: Parse Arguments

`$ARGUMENTS` may contain, in any combination:

- **Slug** (positional) — if it matches `.work/backlog/<slug>.md`, enters **promote-from-backlog** mode.
- `--parent=<parent-slug>` — enters **nested-child** mode. Child will land under `.work/active/.../<parent-slug>/<child-slug>/`.
- **Free text** — treated as a seed idea for **fresh-discovery** mode.
- **No args** — enters **intake** mode.

Normalize slugs to lowercase kebab-case.

## Step 1: Resolve Entry Mode

Four entry modes:

**(a) Promote-from-backlog** — slug matched a backlog file. Read it; use its tags, matter, and any `release_binding` as the conversation starting point.

**(b) Nested-child** — `--parent=<slug>` matched an active item. Locate parent folder, read parent's kind-file for upstream authoritative context.

**(c) Fresh-discovery** — seed idea given (or none, user supplies). Start discovery without a source file.

**(d) Intake** — no args, backlog non-empty. Glob `.work/backlog/*.md`. List ripe items grouped by tag in one message. Ask user to pick one to scope now. Replaces the old "scan area boards for ripe items" flow.

If intake finds nothing, prompt for a fresh seed idea.

## Step 2: Orient

Scan for related items before starting discovery — avoid duplicates, surface connections:

- Glob `.work/active/**/{epic,feature,story}.md`.
- Glob `.work/backlog/*.md` (skip if intake mode already listed them).
- Optionally run `python3 scripts/tag-view.py <tag>` if the target tag is clear from the seed or backlog file.

Filter matches by tag overlap or slug-seed overlap with the target. When matches surface:

> "Found a related item: `feature-uploads-retry` (stage: implementing). Should this land as a child, sibling, or separate work?"

If the user confirms a match as parent, switch to nested-child mode with that parent.

Read authoritative upstream context:
- **Parent chain** — if nested, read the parent's kind-file (and grandparent's if any).
- **Related positions** — glob `.research/analysis/positions/` for entries matching the target's domain.
- **Related research** — glob `.research/` for relevant prior exploration.

Tell the user: *"Let's scope this out. I'll write as the shape firms up; interrupt whenever."*

## Step 3: Discovery Conversation

Collaborative brainstorming, not a questionnaire. Be generative:

- Suggest features, angles, edges the user hasn't mentioned.
- Connect to existing items, decisions, research.
- Propose alternative approaches; challenge scope; flag trade-offs.
- Think about the user experience end-to-end, not just the technical ask.

Reflect back a tightened version after each exchange. Let the conversation evolve.

**Context boundaries.** See `item-pipelines.md §What each stage loads` for the per-stage context scope. `/scope` loads item-level artifacts (epic, rules, existing items, decisions, research, design briefs) but not project `CLAUDE.md`, principles, or source code — those are `/design` and `/implement` concerns.

If discovery starts pulling design-level detail (exact interfaces, library API behavior, integration-point wiring), that's a signal the work is feature-sized and wants `/design`'s grounding. Note the detail in the kind-file as an open question, but don't pin the design decision — leave it for `/design`.

## Step 4: Sizing — Pick the Kind

Decide together with the user.

Sizing decides which fresh-context load the next stage will do. See `item-pipelines.md §What each kind signals` for the per-kind rubric.

Concrete examples:
- A feature whose children are each design-worthy — **feature**.
- A clear rename + rewrite delivered in a single pass — **story**.
- "Fix a typo in a config file" — **task** (parent checklist or inline).
- "Migrate the upload pipeline to resumable uploads" — **epic** (5+ features, architectural).

Confirm the sizing with the user before writing frontmatter.

## Step 5: Write the Active Folder + Kind-File

Once sizing is confirmed, write immediately. Keep refining the kind-file's matter as conversation continues — scope often expands, contracts, or splits mid-session; the file is the working surface.

Frontmatter follows `item-convention.md §Frontmatter — active tier`. Set `kind`, tags from discovery, `parent:` if nested, `release_binding: null` unless propagating from a gate-finding backlog source.

**Epic** — write `.work/active/epics/<slug>.md` at `stage: drafting`. Matter is the architectural brief: scope (commits / explicitly-out), design principles, key decisions, expected child features/stories, done criteria, risks, revisit conditions. This IS the epic's matter; no side-file brief. Stage flips `drafting → implementing` when the first child is pulled.

**Feature** — write `.work/active/features/<slug>.md` (or under a parent folder if nested) at `stage: drafting`. Matter is whatever emerged from discovery — framing, scope, surfaced decisions, open questions, pattern references, risks, revisit. As rich or thin as the conversation produced. `/design` reads this and extends in place.

**Story** — write `.work/active/stories/<slug>.md` (or under a parent folder if nested) at `stage: implementing`. Matter is the scope itself: single-paragraph what-this-does, inline task checklist, risks, revisit. No design stage.

**Task** — two paths:

- **Checklist on parent** — append `- [ ] <task text>` to the containing item's kind-file. Update parent's `updated:` frontmatter.
- **Inline implement** — if the task is small enough to finish in-conversation and has no natural parent, do it inline with no item. Inline tasks currently have no durable trace — **call them out in the session wrap** so they end up in a session note.

## Step 6: Promote From Backlog (if applicable)

If entry mode (a): `git mv` before elaborating frontmatter.

```
git mv .work/backlog/<slug>.md .work/active/<kind>s/<slug>.md
```

History is preserved via git rename detection. No `[from backlog]` breadcrumb needed.

After the move, elaborate the backlog file's minimal frontmatter into the active-tier schema per Step 5. Tags propagate; add or refine if sizing surfaced more. `release_binding` propagates as-is (gate findings keep their binding).

## Step 7: Multi-Item Output (Context-Dependent)

**Default — feature work requiring codebase grounding.** Stop at the parent. Children get enumerated in the parent's matter (inline task list or child-stub table). Actual child folders get created by subsequent `/scope --parent=<parent-slug> <child>` invocations.

**Md-heavy exception.** If children emerged naturally in conversation AND the context (rules, existing items, epic framing) is enough to write them coherently without loading design or implementation principles, `/scope` may write child `feature.md` / `story.md` files directly.

**Forbidden:** writing children that would require loading project `CLAUDE.md`, design principles, implementation principles, or source structure. Stop and hand off.

## Step 8: Scoping Matter Persistence

See `item-convention.md §Where matter lives` for the canonical three-tier pattern. `/scope`'s default: inline in the kind-file. When a position surfaces that feels cross-cutting or likely to outlive the item (a convention other work will follow, a trade-off with explicit `revisit_if` conditions), write it to `.research/analysis/positions/` and reference it from the kind-file. Don't over-promote.

## Step 9: Offer Next Step

| Outcome | Suggestion |
|---|---|
| Code-based feature at `stage: drafting` | *"Written `<path>`. Ready to run `/design` to produce the implementation spec?"* |
| Md-heavy feature at `stage: drafting` | No next skill — feature matter from `/scope` is the design. User extends the feature file directly or pulls children via `/scope --parent=<feature-slug>`. |
| Story at `stage: implementing` | No next skill. User starts implementing or delegates a Sonnet agent. |
| Epic at `stage: drafting` | No next skill. Children pull via `/scope --parent=<epic-slug> <child-idea>` as they come. |
| Task (inline) | No artifact; remind user to note in session wrap if it warrants. |
| Task (checklist) | No artifact beyond the checklist line. |

A feature is md-heavy if its tags include `workflow` or it carries no code-domain tag (mirrors `/design`'s refusal rule at `design/SKILL.md §Step 1`). For code-based features, if user confirms, invoke `/design` via the Skill tool with the new feature path as the target.

## Anti-Patterns

- **Don't load design or implementation principles, project `CLAUDE.md`, or source-code structure.** That context belongs to `/design` and `/implement`. If you find yourself wanting it, the conversation has crossed into design territory — commit the scope, hand off.
- **Don't write children that would require codebase grounding.** Only md-heavy decomposition writes children in-session.
- **Don't enter plan mode.** Edit mode — write once sizing is agreed, refine as conversation continues.
- **Don't set `release_binding` at scope time.** Exception: it propagates from a backlog source that was a gate-blocking finding. See `item-pipelines.md §Release binding lifecycle`.
- **Don't duplicate parent matter into a child.** Reference or link; parent is authoritative.
- **Don't gratuitously rewrite settled content.** When scoping new work into an existing parent (a child pulled under an existing epic, a backlog item promoted into an active area), extend and cite. When incoming scope actually clashes with existing matter, surface the clash and work through it — grounded revision per `item-convention.md §Where matter lives`. Not silent rewrites.
- **Don't skip the sizing confirmation.** Frontmatter commitment (kind + tags) needs explicit agreement; freeform discovery before that is fine.
- **Don't ask clarifying questions past ambiguous tag-disambiguation.** Scope is conversational; only pause for questions that would change where the file lands or what kind it is.
