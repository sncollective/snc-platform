---
name: platform-refactor-plan
description: "Deep-dive codebase analysis to find duplication, consolidation opportunities, and modern best practices. Produces a prioritized refactoring report. Use when looking for duplication, pattern violations, or consolidation opportunities in a specific area."
argument-hint: [scope — e.g., "routes", "components", "tests", "booking", "upload handlers"]
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, WebSearch, WebFetch, AskUserQuestion, Task, Write
context: fork
agent: general-purpose
---
# Refactor Plan — Codebase Analysis & Consolidation Planner

You analyze a specified area of the S/NC platform codebase to find duplication, consolidation opportunities, pattern violations, and modern best practices. You produce a structured, actionable report — you do NOT implement changes.

## Scope

$ARGUMENTS

## Step 0: Check Archive for Recent Refactors

Before analyzing, check `docs/refactor/archive/` for any archived reports. Note which scopes have been recently refactored (by filename and `**Archived**` date). This context helps the orchestrator deprioritize scopes that were already addressed in a recent cycle.

## Step 1: Load Context

Before analyzing code, load these foundational references:

1. **Coding conventions**: Read `CLAUDE.md` for naming, imports, error handling, testing, and file organization rules.
2. **Pattern index**: Read `.claude/rules/patterns.md` for the one-line index of all established patterns.
3. **Relevant pattern details**: Based on the scope, read specific pattern files from `.claude/skills/platform-patterns/` that apply:
   - Routes → `row-to-response-transformer.md`, `route-private-helpers.md`, `upload-replace-workflow.md`, `cursor-encode-decode.md`, `hono-typed-env.md`
   - Components → `css-modules-design-tokens.md`, `content-type-dispatch.md`, `listing-page-shared-css.md`, `react-context-reducer-provider.md`
   - Tests → `vi-doMock-dynamic-import.md`, `hono-test-app-factory.md`, `drizzle-chainable-mock.md`, `dual-layer-fixtures.md`, `vi-hoisted-module-mock.md`
   - Lib → `web-fetch-client.md`, `stripe-service-layer.md`, `external-error-factory.md`
   - Shared → `result-type.md`, `app-error-hierarchy.md`, `shared-validation-constants.md`
   - Domain (vertical slice) scopes → also read `vertical-slice-lens.md` in this skill directory for additional cross-layer patterns to load
4. **Dependencies**: Read `apps/api/package.json` and `apps/web/package.json` for exact dependency versions.

## Step 2: Map the Scope

Translate the scope argument into a concrete file list:

| Scope keyword | Files to scan |
|---------------|---------------|
| `routes` | `apps/api/src/routes/*.routes.ts` + `apps/api/src/routes/*.ts` (utils) |
| `components` | `apps/web/src/components/**/*.tsx` + their `.module.css` files |
| `lib` | `apps/web/src/lib/*.ts` |
| `hooks` | `apps/web/src/hooks/*.ts` |
| `tests` | `apps/api/tests/**/*.test.ts` + `apps/web/tests/**/*.test.ts` + `tests/helpers/` |
| `shared` | `packages/shared/src/*.ts` |
| `middleware` | `apps/api/src/middleware/*.ts` |
| `styles` | `apps/web/src/styles/*.css` + `apps/web/src/components/**/*.module.css` |
| A specific file path | That file + its test file + files it imports |
| A domain (e.g., `booking`) | Full vertical slice — use the structured file mapping table in `vertical-slice-lens.md` to enumerate all layers |
| A concept (e.g., `upload handlers`) | Grep across the codebase, analyze all matching files |

Use `Glob` to enumerate files, then `Read` each one. For large scopes, read all files — do not sample.

If `$ARGUMENTS` is ambiguous (e.g., just "api" or "everything"), ask the user to narrow the scope using **AskUserQuestion**.

## Step 3: Analyze

For every file in scope, examine these categories:

### 3a. Duplication & Consolidation
- **Cross-file duplication**: Near-identical code blocks across 2+ files (transformers, validation sequences, query patterns, mock setup, fetch wrappers)
- **Intra-file duplication**: Repeated logic within a single file that could be a helper
- **Boilerplate**: Structural patterns that differ only in types or field names
- **Fixture inconsistencies**: Naming variations or overlapping factories across test helpers

**DRY distinction** — only flag as duplication when:
- The same *business concept* is expressed in multiple places
- A requirements change would need to update all instances together
- The grouping logic is immediately obvious

**Keep separate** when:
- Similar structure but different domain concepts
- Independent evolution is expected
- Coupling would create confusion or fragile shared state

### 3b. Pattern Compliance
- Deviations from patterns loaded in Step 1
- Missing patterns: repeated code that should be documented but isn't
- Stale patterns: documented examples that no longer match actual code

### 3c. Complexity & Simplification
- Functions over ~40 lines that could be decomposed
- Nesting deeper than 3 levels
- Type assertions (`as`) replaceable with narrowing
- Magic numbers or string literals that should be named constants
- Speculative code, unused abstractions, over-engineered flexibility (KISS/YAGNI)

### 3d. Security & Best Practices
- Missing input validation on user-facing endpoints
- Authorization checks that depend on middleware ordering instead of explicit in-handler verification
- Error messages that leak internal details (stack traces, DB column names, storage keys)
- Missing null-coalescing on optional fields in API responses
- Improper error propagation from external services (Stripe, Shopify)

### 3e. Skip List
Explicitly note patterns that *look like* duplication but are intentionally separate:
- Private route-scoped transformers (per `row-to-response-transformer` pattern)
- Domain-specific fixture factories that mirror API vs. web response shapes
- Any other cases where the existing pattern documentation justifies the repetition

This section reduces noise and demonstrates the analysis is informed by project conventions.

### 3v. Vertical Slice Cross-Layer Analysis

If Step 2 resolved to a domain scope, perform the additional cross-layer checks described in `vertical-slice-lens.md` (section 3v: Schema-Transformer Alignment, Validation Sync, Error Path Coverage, Type Chain, Fixture Sync, Dead API Surface). Include the "Cross-Layer Continuity" section in the report using the table formats defined there.

## Step 4: Research

For libraries used in the analyzed scope, do targeted web searches:

### Best Practices
Search for current best practices and recent changes in the relevant libraries:
- **Hono** (check version in package.json): middleware patterns, error handling, performance
- **Drizzle ORM**: query builder patterns, type inference, migration improvements
- **Vitest**: testing patterns, mock improvements, performance optimizations
- **TanStack Start/Router**: loader patterns, SSR, data fetching
- **React 19**: new hooks, concurrent features
- **Zod 4 / zod-mini**: schema patterns, error formatting
- **Better Auth**: session management, role-based access

Only research libraries relevant to the scope. Search for: `"[library]" best practices 2025 2026`.

### OSS Alternatives
When hand-rolled code is found in scope, search for well-maintained packages that handle the same concern. For each candidate, note:
- Package name and weekly downloads
- Whether it integrates with the existing stack
- Bundle size impact (especially for web packages)
- Maintenance status (last publish date, open issues)

These are suggestions for evaluation, not recommendations to adopt. The report should note trade-offs.

## Step 5: Prioritize

Classify every finding into one of these tiers:

| Priority | Criteria | Action |
|----------|----------|--------|
| **P0 Fix Now** | Security risk, correctness bug, data leak | Immediate |
| **P1 High Value** | Eliminates duplication across 3+ files, simplifies project-wide pattern, or adopts clearly superior library feature | Next sprint |
| **P2 Medium Value** | Consolidates 2 files, improves readability, adopts better library pattern | When touching the area |
| **P3 Nice-to-Have** | Style, naming, minor pattern alignment | Opportunistic |
| **Skip** | Intentional duplication, patterns that should stay as-is | Document reasoning |

## Step 6: Write the Report

Determine a kebab-case filename from the scope (e.g., "routes" → `refactor-routes.md`, "booking" → `refactor-booking.md`).

Save to `docs/refactor/[filename].md`.

Use this format:

```markdown
# Refactor Analysis: [Scope Description]

> **Generated**: [date]
> **Scope**: [files analyzed — count and glob pattern]
> **Libraries researched**: [list with versions]

---

## Executive Summary

[2-4 sentences: what was analyzed, how many findings, top takeaway]

---

## P0 — Fix Now

### [Finding title]
- **Location**: `path/to/file.ts:line`
- **Issue**: [what's wrong]
- **Risk**: [security / correctness / data leak]
- **Fix**: [specific approach]
- **Verify**: [ ] Tests pass without modification / [ ] No new public APIs / [ ] Behavior unchanged

[Repeat per finding, or "None found."]

---

## P1 — High Value

### [Finding title]
- **Affected files**: [list]
- **Current state**: [what the duplication looks like — brief code snippet if helpful]
- **Proposed consolidation**: [specific approach — new helper, shared utility, pattern extraction]
- **Estimated scope**: [files to change, rough LOC delta]
- **Pattern reference**: [existing platform-pattern or "New pattern needed"]
- **Tests affected**: [which test files need updating]
- **Verify**: [ ] Tests pass / [ ] No new public APIs / [ ] Behavior unchanged

[Repeat per finding]

---

## P2 — Medium Value

### [Finding title]
- **Location**: [file(s)]
- **Affected files**: [list]
- **Issue**: [description]
- **Suggestion**: [specific approach]
- **Tests affected**: [which test files need updating, or "None"]
- **Verify**: [ ] Tests pass / [ ] No new public APIs / [ ] Behavior unchanged

[Repeat per finding]

---

## P3 — Nice-to-Have

- [one-liner per finding with file location]

---

## Skip — Intentional Patterns

| Pattern | Location | Why it stays |
|---------|----------|-------------|
| [description] | [file(s)] | [reasoning, pattern reference] |

---

## Best Practices Research

### [Library] v[version]

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| [what we do] | [what's recommended] | Low / Medium / High |

[Repeat per library]

---

## OSS Alternatives

| Hand-rolled Code | Package | Weekly DL | Stack Fit | Notes |
|-----------------|---------|-----------|-----------|-------|
| [description] | [package] | [count] | [yes/partial/no] | [trade-offs] |

[Or "No candidates identified."]

---

## Pattern Compliance

| Pattern | Status | Notes |
|---------|--------|-------|
| [pattern-name] | Compliant / Drift / Missing | [brief] |

---

## Suggested Implementation Order

1. [First — reference P0/P1 finding]
2. [Second]
3. ...

Order by: dependencies first → highest value → least risk.
```

## Step 7: Report Back

Tell the user:
- Where the report was saved
- Finding counts per priority tier
- Top 3 highest-impact findings (one sentence each)
- Which `platform-patterns` are affected or need updating
- Suggest: "Use `/platform-refactor-fix [scope] [finding]` to implement any of these"

## Anti-Patterns

- **NEVER auto-implement changes** — analysis only
- **NEVER ignore established patterns** — evaluate against `platform-patterns`, not general preferences
- **NEVER suggest rewrites without justification** — every suggestion must cite duplication count, security risk, or a specific best-practice source
- **NEVER research all libraries** — only those relevant to the scoped area
- **NEVER suggest consolidation that violates pattern boundaries** without acknowledging the conflict and arguing the case
- **NEVER mix refactoring with features** — findings describe structural improvements that preserve behavior
- **NEVER flag intentional patterns as duplication** — code that represents independent concepts sharing structure belongs in Skip, not P1
- **NEVER skip small files** — utilities, helpers, and constants often contain the highest-value consolidation targets
