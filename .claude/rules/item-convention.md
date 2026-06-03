---
paths:
  - ".work/active/**"
  - ".work/backlog/**"
  - ".work/releases/**"
  - ".work/archive/**"
---

# Item Convention

Items are the unit of persistent work. They live in three tiers inside `.work/` at each project root:

- `.work/active/` — scoped, in-flight
- `.work/backlog/` — unscoped, parked
- `.work/releases/` — bundled, shipped

Items carry their own structured state via frontmatter. Release-binding is a per-item property, not a board property.

See `item-pipelines.md` for the stage flow and `tag-taxonomy.md` for the tag rubric.

## Active-tier structure

Active items are flat files grouped by kind in three directories:

```
.work/active/
  epics/
    <epic-slug>.md
  features/
    <feature-slug>.md
  stories/
    <story-slug>.md
```

Every item is a single `.md` file named for its slug. No per-item folders, no kind-named filenames. Opening `.work/active/` shows three directories — `epics/`, `features/`, `stories/` — each listing its items at a glance.

**Slugs are globally unique across the project's active tier.** Child items qualify their slug with the parent's slug (e.g. `playout-channel-architecture-phase1`, not `phase1`). This keeps slugs self-describing and collision-proof when references cross kinds.

**Parentage lives in frontmatter.** Hierarchy is encoded via the `parent:` field, not filesystem nesting. Walking children of an epic is a frontmatter query (via `scripts/tag-view.py` or `grep -l "parent: <epic-slug>"`).

**The file is the matter.** An epic's architectural brief, a feature's design brief, a story's scope live *in* the kind-file. No parallel design-brief directory for active items. When `/scope` sizes an epic, the scoping brief becomes the epic file. When `/design` runs on a feature, the design becomes the feature file.

## Containment rules

| Kind | Can parent (via child's `parent:`) |
|---|---|
| **epic** | features, stories, inline tasks. Never another epic. |
| **feature** | stories, inline tasks. Never epics or features. |
| **story** | inline tasks only. No child kind-files. |
| **task** | Not a file. A `- [ ]` checklist line in a parent's kind-file. |

**Standalone units.** Features and stories can exist without a parent. A feature at `.work/active/features/<slug>.md` with `parent: null` is valid. Tasks never stand alone — if work is small enough to have no sensible parent, implement it inline in conversation without tracking.

## Frontmatter — active tier

```yaml
---
id: <kind>-<slug>                         # e.g. feature-content-uploads-retry
kind: feature                             # epic | feature | story
stage: drafting                           # see item-pipelines.md for the stage matrix
tags: [content, creators]                 # domain/pipeline tags; multiple if cross-cutting
release_binding: null                     # null until bound — see item-pipelines.md
created: 2026-04-17
updated: 2026-04-17
related_decisions: []                     # decision record IDs
parent: null                              # parent epic/feature slug if nested; child slugs qualify with parent prefix
---
```

## Frontmatter — backlog tier

Backlog items are flat files (`.work/backlog/<slug>.md`, no folder) with minimal frontmatter:

```yaml
---
tags: [content]                           # optional — captured at park time if clear
release_binding: null                     # optional — set at creation for gate-blocking findings
created: 2026-04-17
---
```

Kind and stage are unknown until `/scope` runs. `release_binding` is optional and orthogonal to tier — set when a release-gate scan produces a gate-blocking finding.

## Frontmatter — release tier

Release bundles are late-binding: items flow through stages independently of any release; a bundle is created when enough quality-gated items warrant a version bump, not upfront as a catch-all.

**Location.** `.work/releases/<version>.md` (the filename is the semver string, e.g. `0.3.1.md`). Platform ships versioned releases, so release binding applies in full.

```yaml
---
version: 0.3.1                            # semver string; matches filename
status: planned                           # planned | quality-gate | released
created: 2026-04-20
updated: 2026-04-24                       # bump on meaningful revision
quality_gates_passed: []                  # subset of [refactor, security, testing, documentation]
related_items: []                         # computed snapshot — not hand-maintained
---
```

The canonical bind is per-item `release_binding: <version>`; the bundle's `related_items:` list is the computed snapshot of items where `release_binding` matches. See `item-pipelines.md §Release bundles` for the lifecycle, `§Quality gates live on releases` for the gate semantics, and `§Release binding lifecycle` for how bindings get written and queried.

Body sections seeded by `/release-create` and filled in over the release lifecycle: an overview paragraph, `## Bundle summary` (auto-computed from bound items), `## Prod verification` (residual prod-only checks lifted by `/review` as items pass), `## Changelog` (written during `/release-deploy`), `## Known issues` (written during `/release-deploy`).

Old releases are never deleted — they're the permanent version history.

## Where matter lives

Item-scoped matter (scoping context, design decisions, open questions, pattern references) lives in three complementary places. The tier signals the authority of the content — a section-heading convention isn't needed.

- **Kind-file prose** (`epic.md` / `feature.md` / `story.md`) — primary working surface. Scoping conversation context, framing, sketches, open questions, decisions inline. Kind-files are **live throughout their lifecycle**, not frozen at each stage handoff. Skills at later stages read and extend in place; when grounded discovery (backlog intake surfacing scope clash, codebase discovery surfacing design clash, implementation surfacing design gap) forces revision, the later skill revises the existing matter, **surfacing the clash to the user**. Not silent rewrites, not gratuitous rewrites — grounded refinement.
- **Parent kind-file** — authoritatively upstream for children as the default posture. An epic's architectural brief in `epic.md` authoritatively informs every child feature's design. A feature's design in `feature.md` authoritatively informs every child story's implementation. Children reference the parent; they don't duplicate. When a child's own work surfaces that the parent needs refining (e.g., scoping a child story surfaces that the parent feature's design needs a carve-out), the parent IS editable — with the clash surfaced, per the grounded-revision rule above.
- **`.memory/decisions/platform-NNNN-<slug>.md`** — for scope or design decisions load-bearing beyond the item's lifecycle. Structured records with `status`, `revisit_if`, rejected alternatives per `document-evolution.md`. Linked from the item's `related_decisions:` frontmatter.

Authority signal is the tier. Inline in a kind-file = working matter (refinable); parent kind-file referenced by a child = authoritative upstream; `.memory/decisions/` entries = structural position across the project.

Default: write matter inline in the kind-file. When a decision surfaces that feels cross-cutting or likely to outlive the item (e.g., a convention other work will follow, or a trade-off with explicit revisit conditions), promote it to `.memory/decisions/` and link from `related_decisions:`. When scoping a child, reference the parent's kind-file rather than duplicating.

## Archive lifecycle

Two archival paths depending on binding. Archive tiers mirror the active tier's kind-grouped layout (`epics/`, `features/`, `stories/`):

**Bound to a release** — items move from `.work/active/<kind>s/<slug>.md` to `.work/releases/<version>/<kind>s/<slug>.md` when `/release-deploy` ships the release. Items retain frontmatter (`stage: done`, `release_binding: <version>`); only the path changes. The release bundle file at `.work/releases/<version>.md` stays in place and holds the canonical `related_items:` snapshot.

**Passed review without a binding** — items move from `.work/active/<kind>s/<slug>.md` to `.work/archive/<kind>s/<slug>.md` when `/review` flips them to `done`. Applies to:
- Skip-with-note items (done with `review-skip` note; no binding set).
- Items that legitimately pass review without binding to a release (rare — most items bind).

Archive items gain `archived: <date>` frontmatter at move time; original `stage: done`, slug, and `parent:` are preserved. Tag-view + grep find historical items by tag or text.

**Subtree archival.** An epic's subtree — epic + all descendants linked via `parent:` — archives together. Since parentage is frontmatter-only, this is a multi-file move driven by a parent-graph walk, not a single `git mv`. `/release-deploy` and `/review` run the walk when a root-of-tree item flips to `done`: resolve the set of descendant items (recursively by `parent:`), move each to the archive tier. Intermediate children that are already `done` but have a still-active parent stay in place until the parent flips.

Both archival paths are **path + frontmatter only** — content unchanged. Git preserves history through the move. Agents querying historical items read the archive tier directly; no git archaeology needed.
