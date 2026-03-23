---
name: stylistic-refactor
description: >
  Platform stylistic refactoring rules for TypeScript/React/Hono. Scans for refactoring
  opportunities and produces a prioritized backlog. Defines the team's preferred coding style.
allowed-tools: Read, Glob, Grep, Bash, Agent, Write
---

# Stylistic Refactor

Scan the codebase for opportunities to apply these stylistic preferences.
Each style has a reference file with rationale, examples, and exceptions.

## Styles

| Style | Rule (one line) | Reference |
|-------|-----------------|-----------|
| early-returns | Use guard clauses and early returns instead of nested if/else | [details](references/early-returns.md) |
| readonly-boundaries | `readonly` on React props, shared types, and object/array function params | [details](references/readonly-boundaries.md) |
| annotate-boundaries | Type-annotate return types and exports; let inference handle locals | [details](references/annotate-boundaries.md) |
| concurrent-awaits | Use `Promise.all` for independent async operations | [details](references/concurrent-awaits.md) |
| no-floating-promises | Every promise must be awaited, returned, or explicitly voided | [details](references/no-floating-promises.md) |
| exhaustive-unions | Exhaustive switch (`never`-default) or `Record<Union, T>` for discriminated unions | [details](references/exhaustive-unions.md) |

## Output

Write the refactoring backlog to `docs/stylistic-refactor-backlog.md`.

The document should be a **prioritized refactoring backlog** with three tiers:

### High Value
Refactors that significantly improve readability, consistency, or maintainability
with low risk. Each entry:
- **File**: path:line
- **Style**: which style rule applies
- **Current**: actual code showing the pattern
- **Target**: refactored version
- **Acceptance Criteria**: `[ ]` testable assertions

### Worth Considering
Valid refactors with moderate impact or moderate effort. Include rationale.

### Not Worth It
Code that technically violates a style but should NOT be refactored. Include WHY:
too destructive, obscures domain logic, breaks API contracts, or forces unnatural patterns.

Focus on code that benefits from the change — skip trivial or cosmetic-only improvements.
