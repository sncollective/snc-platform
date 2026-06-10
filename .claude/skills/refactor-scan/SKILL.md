---
name: refactor-scan
description: "Scan a codebase scope against all discovered scan rule libraries and create tagged findings as items. Writes high-confidence findings as active stories at stage: implementing (shape-committed per batch-shape conventions), medium-confidence as active features/stories at drafting, low-confidence as backlog items. Use when starting a refactor cycle, checking code quality in an area, or running as part of a release's refactor gate."
argument-hint: "[scope — e.g. 'routes', 'components', 'services'] [--release=<version>] or omit for scope discovery"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent, AskUserQuestion
model: opus
---

# refactor-scan — Pipeline Entry Point

Scan the code against all discovered scan rule libraries. Findings become tagged items (stories at `stage: implementing` for high confidence, features/stories at `drafting` for medium, backlog items for low) per `item-pipelines.md §Scan and triage pipelines`. Agents dispatched per logical group (directory/module), checking all rules in one pass per file.

See:
- `.work/CONVENTIONS.md` — `§Scan and triage pipelines` (confidence-to-item mapping), `§Batch-shape conventions` (A/B/C shapes), `§Release binding lifecycle` (gate-finding binding).
- `.work/CONVENTIONS.md` — `§Scope resolution`.
- `.work/CONVENTIONS.md` — item structure + frontmatter.

## Step 0: Parse Arguments

`$ARGUMENTS` may contain:
- **Scope** (path/directory/name) — the code area to scan.
- **`--release=<version>`** — release-gate context. Findings get `release_binding: <version>` set at creation.
- **No args** — scope discovery mode (present options, user picks).

## Step 1: Load Rule Libraries

Discover scan rule libraries:

```
Glob: .claude/skills/scan-*/SKILL.md
```

For each discovered library:
1. Read its `SKILL.md` and all files in `references/`.
2. Derive the **tag** from the directory name by stripping `scan-` (e.g., `scan-stylistic` → `stylistic`).

Present to user: *"Found N scan libraries: stylistic, structural, quality, performance, accessibility, seo, documentation. Scan all, or select specific types?"*

If no libraries exist, suggest authoring a `scan-*` library and stop.

## Step 2: Resolve Scope to File Set

Three resolution modes, tried in order:

**Mode 1: Path match** — if argument contains `/` or `*`, treat as a path relative to the project root.

**Mode 2: Name search** — if argument doesn't look like a path:
1. Try directory match: `Glob: **/src/{argument}/` and `**/src/*/{argument}/`.
2. If no directory match, try name search: `Glob: **/*{argument}*.{ts,tsx}` for vertical-slice domain matches.

**Mode 3: Auto-discover (no argument)** — check `AGENTS.md §Scan Scopes` for an explicit mapping, or walk the source tree listing directories with 3+ source files. Present via AskUserQuestion; recommend 1-3 per session.

**Global exclusions** (always):
- `node_modules/`, `dist/`, `build/`, `.next/`, `coverage/`, `.turbo/`
- `*.gen.ts`, `*.gen.tsx` (generated files)

Individual scan rules handle their own exclusions via `## Scope` sections in their reference files.

## Step 3: Logical Split

Group the resolved file set by natural boundary (directory, module, feature slice). **Not LOC-based** — prefer logical splits that cluster related files.

Example: scope resolves to 40 files across `content/`, `creators/`, and `shared/`. Split:
- Group A: content-related files
- Group B: creators-related files
- Group C: shared utilities

Each group gets one Sonnet agent. Agent flags back if a group is too large to handle in one pass.

## Step 4: Dedup Against Existing Items

Before dispatching, check existing items to avoid duplicates:
- Glob `.work/active/**/{epic,feature,story}.md` and `.work/backlog/*.md`.
- Filter by tag `refactor` and rule-library tags selected in Step 1.
- Build a set of (tag, rule-slug, file:line) triples already tracked.

Agents receive this set in their prompt and skip matching findings.

## Step 5: Dispatch Scan Agents

For each scope group, launch a Sonnet agent with:

**Agent prompt includes:**
- The group's file list (post-exclusion).
- All rule references from selected libraries (full content of each reference file).
- Project conventions from `AGENTS.md` and `CLAUDE.md`.
- The dedup set (existing tracked findings — skip these).
- Instructions to check all rules in one pass per file.

**Agent instructions:**
1. Read every file in the group.
2. For each file, check against all loaded rules from all selected libraries.
3. For each finding, record:
   - **Tag**: library tag (e.g. `stylistic`).
   - **Rule slug**: which rule was violated.
   - **File:line**: exact location.
   - **Issue**: one-sentence description.
   - **Fix**: specific proposed change (or "needs analysis" for complex findings).
   - **Confidence**: `high` / `medium` / `low` per rule's guidance.
   - **Batch-shape hint (for high-confidence batches only)**: if N related findings cluster as pattern-sweep candidates (shape C), flag.
4. Apply documented exceptions.
5. Skip findings in the dedup set.
6. Return findings as structured list.

## Step 6: Classify Findings into Items

Per `item-pipelines.md §Scan and triage pipelines`:

| Confidence | Item shape | Tier |
|---|---|---|
| **Trivial (inline fix, single line)** | No item — fix in the scan report as a note; user may apply inline | — |
| **High confidence** | Story at `stage: implementing`, tagged `refactor` + library tag (e.g. `[refactor, stylistic]`) | `.work/active/<slug>/story.md` |
| **High confidence + N related sites (pattern sweep)** | Feature at `stage: implementing` with **shape C** (pattern statement, no enumerated task list); `/implement` sweeps via tool | `.work/active/<slug>/feature.md` |
| **High confidence + heterogeneous batch** | Feature at `stage: implementing` with **shape A** (N inline tasks) or **shape B** (story children) | `.work/active/<slug>/feature.md` |
| **Medium confidence** | Feature or story at `stage: drafting`, tagged `refactor` + library tag | `.work/active/<slug>/{feature,story}.md` |
| **Low confidence** | Backlog item | `.work/backlog/<slug>.md` |

Slug derived from rule-slug + representative file / directory (e.g. `refactor-content-api-early-returns`).

## Step 7: Apply Scope Resolution + Write Items

Per `tag-taxonomy.md §Scope resolution`:
- Items tagged `refactor` + a domain co-tag (via scope path) land in `.work/`.

Write each item:
- **Frontmatter** per `item-convention.md §Frontmatter — active tier` (or `§Frontmatter — backlog tier` for low confidence).
- **Matter**: finding details — file:line, issue, proposed fix, pattern references if applicable. For shape C features, the matter is the pattern statement + detector (grep/lint rule/type-error) the `/implement` orchestrator uses to sweep.
- **`release_binding`**: `<version>` if Step 0 saw `--release=<version>`; null otherwise.
- **`related_decisions: []`, `related_designs: []`, `parent: null`** unless otherwise determined.

## Step 8: Report

> *"Scan complete. {scope}: {N} groups scanned, {M} findings.*
> - *{H} high-confidence items ({FS} stories, {FF} features — {SC} shape-C pattern sweeps).*
> - *{Me} medium-confidence items at `drafting`.*
> - *{L} backlog items.*
> - *{D} duplicates skipped.*
> - *{RB} findings bound to release {version}." (if `--release`)*

Suggest next steps:
- Items at `stage: implementing` → `/implement` to execute.
- Items at `stage: drafting` → `/design` to resolve approach.
- Backlog items → `/scope` to promote when ready.

## Anti-Patterns

- **Don't implement fixes.** Scan writes items; `/implement` executes them.
- **Don't skip dedup.** Findings already tracked stay in their existing item.
- **Don't flag documented exceptions.** Rule references document what's NOT a finding.
- **Don't write items without file:line.** Every finding needs exact location.
- **Don't use LOC-based splits.** Group by directory/module boundary; agents flag if too large.
- **Don't auto-set release binding without `--release`.** Binding is deliberate per `item-pipelines.md §Release binding lifecycle`.
