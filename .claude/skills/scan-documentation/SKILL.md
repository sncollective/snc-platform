---
name: scan-documentation
description: >
  Documentation coverage scan for the SNC platform. Checks that exported functions,
  service-layer contracts, and shared package types have meaningful JSDoc comments.
  Loaded by refactor-scan as a rule library.
allowed-tools: Read, Glob, Grep, Bash, Agent, Write
---

# Documentation Scan

Scan the codebase for missing or inadequate inline documentation. Each rule has a
reference file with rationale, examples from the codebase, and exceptions.

The convention is defined at `platform/.claude/rules/inline-documentation.md` — read
it before scanning to understand the three-tier model (Always / Recommended / Skip).

## Rules

| Rule | Slug | What to check | Reference |
|------|------|---------------|-----------|
| Exported function undocumented | `exported-fn` | Exported function or const-arrow in Always-tier scope without `/** */` | [details](references/exported-functions.md) |
| Service contract undocumented | `service-contract` | Function returning `Result<T>` or discriminated union without contract doc | [details](references/service-contracts.md) |
| Shared package export undocumented | `shared-export` | Export from `packages/shared/src/*.ts` without `/** */` | [details](references/shared-package-exports.md) |
| Component missing purpose doc | `component-doc` | Exported React component with 3+ props and no `/** */` | [details](references/component-documentation.md) |

## Board Routing

All findings land on the **refactor board** (Fix lane, high confidence), tagged `(documentation)`.
Adding JSDoc comments is always a specific, low-risk change — nothing needs the Analyze lane.

## Finding Format

```
- [ ] **(documentation)** **{slug}**: {one-line description} — {file}:{line} — Fix: add `/** */` with {what to document}
```

## Output

Write findings to the refactor board's Fix lane. Group by file for readability.

## Anti-Patterns

- **Don't flag Skip-tier code** — schema declarations, `index.ts` re-exports, test files, self-documenting constants, and trivial helpers under 10 lines don't need docs
- **Don't flag existing docs as "insufficient"** — if a `/** */` comment exists, it's not a finding. Content quality is a judgment call, not a scan finding
- **Don't require `@param`/`@returns` when types are sufficient** — only flag truly undocumented exports
- **Don't flag route handlers that have `describeRoute`** — OpenAPI metadata serves as documentation for those
