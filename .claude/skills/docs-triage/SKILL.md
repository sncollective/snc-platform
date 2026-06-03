---
name: docs-triage
description: "Triage human-facing documentation coverage gaps. Primary mode: release-gate operation — inspect all items bound to a release and produce gate findings for doc gaps. Secondary mode: ad-hoc processing of backlog items tagged `documentation`. Outcomes: delete (already covered), inline implement (simple update/new guide), or write active feature (complex). Use at release-gate time (docs gate after testing), or on parked `documentation` backlog items. Trigger on 'docs triage', 'documentation gate', 'process doc items'."
argument-hint: "[--release=<version>] [item-path-or-slug] or omit for ad-hoc listing"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion
model: opus
---

# docs-triage — Documentation Coverage Gate + Ad-Hoc Triage

Two modes:

- **Release-gate mode** (primary): inspect all items bound to `<version>`, investigate collective documentation coverage, produce gate findings for real gaps. Invoked by the release gate sequence (runs after testing gate, before release-plan).
- **Ad-hoc mode** (secondary): process a single `documentation`-tagged backlog item.

Audience for human-facing docs: **developers reviewing agent work or contributing manually.**

See:
- `.claude/rules/item-pipelines.md` — `§Quality gates live on releases`, `§Release binding lifecycle`.
- `.claude/rules/item-convention.md` — item structure.
- `.claude/rules/tag-taxonomy.md` — `documentation` tag charter.

## Step 0: Parse Arguments

`$ARGUMENTS` may contain:
- **`--release=<version>`** — release-gate mode.
- **Item path or slug** — ad-hoc mode for a single `documentation`-tagged backlog item.
- **No args** — ad-hoc listing mode: glob `documentation`-tagged backlog items, present for user to pick.

## Step 1: Resolve Mode

**Release-gate mode:** read `.work/releases/<version>.md` + all items with `release_binding: <version>`.

**Ad-hoc mode:** read the target backlog item.

Load `AGENTS.md` for project context.

## Step 2: Collect Inspection Surface

**Gate mode:** for each item bound to the release, collect:
- Changed files + what domain they belong to (auth, calendar, creators, content, admin, etc.).
- User-visible behavior changes (routes, API responses, schema, configuration keys, feature flags).
- Cross-item overlaps — multiple items may touch the same domain guide.

Build a bundle-wide change set grouped by domain.

**Ad-hoc mode:** read the backlog item's matter to understand what was flagged.

## Step 3: Investigate Coverage

Domain-specific logic:

1. **Read existing guides** — glob `docs/*.md`. Build a map: which domain each guide covers, what sections exist.
2. **Cross-reference changes** — for each domain touched by Step 2's surface, check the existing guide's coverage.
3. **Identify gaps** — domain guides missing entirely, or missing sections for the changed behavior.

## Step 4: Classify Each Gap

| Status | Meaning |
|---|---|
| **COVERED** | Guide exists and already describes this behavior. |
| **NEEDS UPDATE** | Guide exists but content is stale or missing this change's behavior. |
| **NEEDS NEW (simple)** | No guide exists; single domain, straightforward, fits the guide template. |
| **NEEDS NEW (complex)** | No guide exists; spans multiple domains or requires structural decisions about organization. |
| **NOT DOCUMENTABLE** | Internal change with no user-facing impact (refactor, internal helper, etc.). |

## Step 5: Route Outcomes

**Gate mode:**

- **COVERED / NOT DOCUMENTABLE** → no gate finding.
- **NEEDS UPDATE / NEEDS NEW (simple)** → create a gate finding as a story at `stage: implementing`, tagged `documentation` + domain co-tag, with `release_binding: <version>`. Matter describes what guide to update/create and which sections.
- **NEEDS NEW (complex)** → create a feature at `stage: drafting`, tagged `documentation`, with `release_binding: <version>`. Matter names domains needing coverage, structural decisions to make. `/design` extends.

**Ad-hoc mode:**

- **COVERED / NOT DOCUMENTABLE** → delete the backlog item. Report rationale inline.
- **NEEDS UPDATE / NEEDS NEW (simple)** → implement inline (read existing guide patterns, write the update or new guide from the template). Run `check-doc-links.py`. Delete backlog item after verification.
- **NEEDS NEW (complex)** → write a feature at `.work/active/<slug>/feature.md` at `stage: drafting`, tagged `documentation`. Delete backlog item.

## Step 6: Guide Content Discipline

When writing guides (simple path) or feature matter for complex:

- **Write from the code** — every claim traceable to actual code. No speculation.
- **Skip sections that don't apply** — template sections are optional.
- **Audience is developers**, not end users.

## Domain Guide Template

```markdown
# {Domain Name}

{One paragraph: what this domain does, its role in the platform}

## How It Works

Architecture overview — key files, layers, data flow. Not a code walkthrough, just enough to orient a developer.

## Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/... | required | ... |

## Schema

Key database tables and relationships for this domain.

## Configuration

Feature flags, env vars, config keys that control this domain.

## Key Decisions

Why it works this way. Links to `.memory/decisions/` records where they exist.

## Gotchas

Non-obvious behavior, edge cases, things to watch for during review.
```

## Step 7: Report

**Gate mode:**
> *"Docs gate for release `{version}`: {N} items inspected, {G} gaps surfaced. {C} COVERED, {U} NEEDS UPDATE, {N1} NEEDS NEW (simple), {N2} NEEDS NEW (complex), {ND} NOT DOCUMENTABLE. Created {S} stories at `stage: implementing` and {F} features at `stage: drafting`, all bound to {version}. Release blocked until gate findings resolve."*

**Ad-hoc mode:**
> *"Triaged `{item}`. Outcome: {status}. {action taken}. {M} `documentation`-tagged backlog items remaining."*

## Anti-Patterns

- **Don't write speculative docs.** Only document what the code actually does; no invented behavior.
- **Don't skip reading existing docs.** Coverage understanding is the whole point.
- **Don't create a feature.md for single-domain guide updates.** Template handles simple cases directly.
- **Don't create agent-facing docs (`.claude/rules/`) inline.** Those are `workflow`-tagged work, different audience and expertise. If a gap surfaces, park to `.work/backlog/` with tag `workflow`.
- **Don't modify docs outside `docs/` without asking.**
- **Don't create gate findings for covered changes.**
- **Don't process gate items one at a time.** Inspect the bundle collectively — multiple items often touch the same domain; triage once.
- **Don't forward from `/review`.** `/review` doesn't create `documentation` backlog items. Gate mode inspects the release bundle directly; ad-hoc mode processes user-parked items only.
