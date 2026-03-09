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
