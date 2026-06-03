---
paths:
  - ".work/active/**"
  - ".work/backlog/**"
  - ".work/releases/**"
  - ".work/archive/**"
---

# Item Pipelines

A pipeline is a per-item stage flow. An item's `kind` determines which stages apply; its `stage` frontmatter field tracks where it is.

See `item-convention.md` for item structure and frontmatter.

## Stage by kind

| Kind | Stages | Notes |
|---|---|---|
| **epic** | `drafting` → `implementing` → `review` → `done` | `drafting` = architectural brief being written in `epic.md`. `implementing` = children in flight and inline tasks being worked. `review` = reviewed at epic scope (matters especially when an epic holds only inline tasks or stories). |
| **feature** | `drafting` → `implementing` → `review` → `done` | `drafting` = design (feature.md) being written. `implementing` = tasks/stories running. `review` = design + implementation reviewed; eligible for release binding. |
| **story** | `implementing` → `review` → `done` | Often skips drafting — `story.md` is written at creation as the scope itself. |
| **task** | `[ ]` → `[x]` | No frontmatter. Checklist line in a parent's file. |
| **release** | `planned` → `quality-gate` → `released` | See `item-convention.md §Frontmatter — release tier`. Gates live here, not on features. |

## Completion rollup

- A feature reaches `done` when all child stories are `done`, all inline tasks are `[x]`, and its own review passes.
- An epic reaches `done` when all child features/stories are `done`, all inline tasks are `[x]`, and epic-level review passes.
- A story reaches `done` when all its inline tasks are `[x]` and review passes.

Manual override is always allowed — an item can be marked `done` explicitly when aggregate state doesn't apply.

## Stage semantics

**Stages are advisory.** The stage field records what's happening right now, not a mandatory progression. Skip stages that don't apply — a documentation typo fix may go `implementing → done`; a trivial story may skip review when implementation is self-verifying. The matrix above lists all stages a kind *can* occupy; the item records the path it actually took.

**`review` means sign-off by a qualified reviewer.** Today that's the user for work they can meaningfully test (most platform feature work, agent-convention changes where the user has context). For items the user can't meaningfully review (security fixes, deep technical convention shifts), skip `review` and move directly to `done` with a note in the matter explaining the skip. Future specialized review agents (adversarial testing, pen-testing) may fill `review` for classes of work the user can't cover — the stage persists, the reviewer changes.

## What each kind signals

Kind is the signal that tells a fresh agent at the next stage what context to load and which class of ambiguity to surface. The split exists so ambiguities get caught at the stage that has the right context, rather than emerging at review.

| Kind | What it signals | Downstream stage |
|---|---|---|
| **Epic** | Multi-feature coordination, architectural framing, children that can't fit a single design doc. Signs: work spanning multiple features or stories, sequencing across children that itself needs recording. | Children pulled individually via `/scope --parent=<epic-slug>`. |
| **Feature** | Warrants `/design`. Benefits from codebase grounding, interface pinning, library/API research. Signs (any): nested dependencies, research/spike gap, library or API uncertainty, multiple integration points, types that need pinning before code, design-level trade-offs requiring judgment. | `/design` loads project-specific CLAUDE.md, pattern skills, reference skills, source structure. |
| **Story** | Skips `/design`. Contained delivery with a clear path from the scoping conversation. Implementable by a focused conversation or a single agent spawn. No fresh design-level grounding required. | Direct implementation, inline or by single agent spawn. |
| **Task** | Inline or checklist. Accomplishable in-conversation at the containing item's current stage, or as a single checklist line. No additional ambiguity to surface. | Inline work, no new stage. |

When sizing between adjacent kinds is ambiguous, prefer the larger kind — collapsing scope is cheaper than expanding after frontmatter is written.

## What each stage loads

Each pipeline stage has a fresh-context scope, defining the class of ambiguities it expects to answer. Skills at that stage load accordingly.

| Stage | Loads | Surfaces ambiguities in | Does not load |
|---|---|---|---|
| **`/scope`** | Epic, rules, existing active + backlog items, `.memory/decisions/`, `.research/` | Scope, decomposition, dependencies between items, sizing | Project-specific CLAUDE.md, design/implementation principles, source code structure |
| **`/design`** | Target feature.md, project-specific CLAUDE.md, pattern skills, reference skills, source structure, project principles (`*-design-principles`) | Interfaces, types, library APIs, integration points, test shape | Execution principles (delegated to implementers) |
| **`/implement`** | Design doc, project CLAUDE.md, implementation principles (`*-implementation-principles`), Agent Commands | Execution specifics, verification, pattern-matching to concrete code | Design-level trade-offs (those should be settled by `/design`) |
| **`/review`** | Modified files, design doc, user-visible behavior, test coverage | Acceptance, gap-finding, route to downstream work | Reimplementation decisions |

Stages respect each other's boundaries — a later stage doesn't re-decide a question resolved earlier; an earlier stage doesn't pre-empt a question reserved for later. When a stage surfaces an ambiguity belonging to another stage, it notes the ambiguity in the kind-file and hands off.

## Batch-shape conventions

When a scan or triage surfaces N related findings, the resulting item takes one of three shapes based on homogeneity:

**(A) Feature with N inline tasks** — heterogeneous batch where each site needs distinct attention. One task per site in the feature's checklist. Example: "Normalize error-handling in 12 route files" where each route has a different error surface.

**(B) Feature with story children per variant** — batch splits into 2-3 clear sub-patterns. Each variant gets a `story.md` under the feature folder. Example: "Retire deprecated API calls — synchronous and streaming call-sites each get a story."

**(C) Feature whose design is a pattern statement, no enumerated task list** — truly homogeneous batch. Agent executing the feature detects target sites via tool (lint rule, grep, type error) and sweeps. Example: "Add missing `await` keywords flagged by `@typescript-eslint/no-floating-promises`."

**Default is (C).** (A) is the fallback for heterogeneity. (B) is a middle ground for small, clear variant counts.

**Shape is picked at `stage: implementing`, not necessarily at scan time.** Three decision points:

- **High confidence at scan** — scan skill lands the item directly at `stage: implementing` with shape committed.
- **Medium confidence at scan** — scan skill creates a feature at `stage: drafting`; shape emerges during design.
- **Low confidence / exploration needed** — scan skill creates a backlog item; shape decided at `/scope` promotion (or deferred indefinitely as standing work).

## Quality gates live on releases; `release_binding` is orthogonal to tier

A release's `quality_gates_passed:` list tracks which gates have succeeded on the bundle as a whole. Gates are a property of the bundle, not per-item. Items bind to a release via `release_binding: <version>`; the set of all items with that binding is the bundle.

Two ways an item becomes bound:

- **Features and stories** — `release_binding` is set when the item passes `review` (happy-path flow).
- **Gate-blocking findings** — `release_binding` is set at creation by the release-gate scan that surfaced the finding. The binding communicates "this must be resolved before that version ships," independent of whether the finding has been scoped yet.

Tier placement (backlog vs. active) and release binding are orthogonal:

| Tier | `release_binding` | Meaning |
|---|---|---|
| backlog | null | Standing quality work or unscoped feature idea. |
| backlog | `0.2.1` | Gate-blocking finding not yet scoped. Blocks 0.2.1. |
| active | null | Scoped work in flight, not yet committed to a version. |
| active | `0.2.1` | Scoped work committed to 0.2.1 (reviewed feature awaiting bundle close, or gate-blocking finding being worked). |

A release is ready to ship when all items with its `release_binding` value are `done` (or tasks `[x]`) and all gates in `quality_gates_passed:` are ticked.

### Release binding lifecycle

How `release_binding` gets written, removed, and queried:

- **Features/stories bind at review-pass.** When the user approves a review, they pick the target release and `release_binding: <version>` is set as the item moves to `stage: done`, via `/review`.
- **Gate findings bind at creation.** Scan skills running in a release-gate context set `release_binding: <version>` on each finding inline. The binding communicates "must be resolved before that version ships" even before the finding has been scoped.
- **Manual edit is always available.** Anyone can add, change, or clear `release_binding` by editing frontmatter directly. Escape hatch for rebinding, declining with rationale, or fixing mis-bound findings.
- **No dedicated `/bind` skill.** The above three paths cover common and edge cases. Adding a skill later is cheap if friction emerges.
- **Single-binding.** An item binds to one release at a time; rebinding overwrites. Multi-release scenarios (backports, parallel trains) trigger a schema revisit.
- **Items bind to releases.** Platform ships versioned releases (0.2.1, 0.3.0, etc.), so its features, stories, and gate-blocking findings bind. Pure `workflow`/agent-convention meta-work that doesn't ship as part of a release bundle may stay unbound (`release_binding: null`).
- **Epics bind to their release.** Epics don't span releases — every child of an epic binds to the same release, and the epic itself binds there when it reaches `done`. If a body of work would naturally span releases, split it into separate epics rather than folding it into a long-running container. `/release-deploy` then archives the whole subtree as a unit via root-of-tree semantics (see `item-convention.md §Archive lifecycle`).
- **Release-gate binding-consistency guard.** Before quality gates run, `/release-deploy` walks every item bound to the target release and verifies: (1) all children of a bound epic are bound to the same release, (2) an epic at `done` whose children are bound is itself bound, (3) no `done` parent is missing a binding while its children are bound (orphan risk). Any inconsistency halts the release and surfaces the mismatch for the user to resolve — no implicit rebinding. This catches drift where a child's review-pass bound it but a parent was forgotten.

### Release bundles

Release bundle files at `.work/releases/<version>.md` have a `related_items:` frontmatter field. The canonical truth is per-item `release_binding`; the bundle's list is the computed snapshot of items where `release_binding: <version>`. A future script queries this set on demand and can write the snapshot into the release file. Hand-maintaining the `related_items:` list is not required.

Release files are created manually when a release is planned. The empty frontmatter + `related_items:` list grow as items bind.

## Scan and triage pipelines — confidence to item shape

Scan skills (`/refactor-scan`, `/security-scan`) and triage skills (`/e2e-triage`, `/docs-triage`) create items rather than placing entries into board lanes. Sizing maps to kind and tier:

| Confidence / triage outcome | Kind / tier | Notes |
|---|---|---|
| Trivial inline fix | No item created | Fix in conversation. |
| High confidence, clear fix | Story in `.work/active/<slug>/` at `stage: implementing`, tagged `refactor`/`security`/etc. | Directly implementable. |
| Medium confidence, needs thought | Feature or story at `stage: drafting`, same tag | Design step before implement. |
| Low confidence, needs discussion | Backlog item, same tag | Must be scoped before active. |
| Batch pattern (N similar sites) | Feature or story with N inline tasks, or with story children if sub-variants differ | One item, not N. |

When a scan runs as part of a release gate, findings the scan judges gate-blocking carry `release_binding: <version>` at creation.

## Skill dispatch

Skills auto-detect against item frontmatter: `kind`, `stage`, `tags`, and path location under `.work/active/` or `.work/backlog/`.
