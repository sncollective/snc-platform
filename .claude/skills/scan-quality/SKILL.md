---
name: scan-quality
description: >
  Quality scan guidelines for the SNC platform. Covers duplication, complexity,
  and pattern compliance. Loaded by refactor-scan as a rule library.
allowed-tools: Read, Glob, Grep
---

# Quality Scan Guidelines

Guidelines for identifying code quality issues: duplication, complexity, and pattern compliance.
Unlike stylistic and structural rules (which are specific checks), quality scanning requires
contextual judgment about business intent and coupling.

## Categories

| Category | Slug prefix | What to look for | Reference |
|----------|------------|------------------|-----------|
| Duplication | `dedup` | Cross-file and intra-file duplicated logic | [details](references/duplication.md) |
| Complexity | `complexity` | Overly long/nested/tangled code | [details](references/complexity.md) |
| Pattern compliance | `pattern` | Deviations from documented project patterns | [details](references/pattern-compliance.md) |
| Best practices | `practice` | Library usage that could be improved, OSS alternatives | [details](references/best-practices.md) |
| Import correctness | `import` | Wrong-package imports masked by bundler optimization | [details](references/import-correctness.md) |

## Confidence Mapping

Quality findings require more judgment than rule-based scans. Use these guidelines:

| Finding type | Typical confidence | Lane |
|-------------|-------------------|------|
| Exact duplicate (3+ sites, same business concept) | high | Fix |
| Near-duplicate (2 sites, same intent) | medium | Analyze |
| Long function that could decompose | medium | Analyze |
| Deep nesting (>3 levels) | high | Fix |
| Magic number / string literal | high | Fix |
| Pattern drift (code doesn't match documented pattern) | medium | Analyze |
| Unused abstraction / speculative code | medium | Analyze |
| Library best practice suggestion | low | Backlog |
| OSS alternative suggestion | low | Backlog |
| Wrong-package import (masked by bundler) | high | Fix |
