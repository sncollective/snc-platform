---
id: platform-0005
title: JSDoc + agent scan for inline documentation
status: active
created: 2026-03-24
updated: 2026-04-16
supersedes: []
superseded_by: null
revisit_if:
  - "Agent scanning proves unreliable at catching missing or drift-prone docs, and ESLint enforcement becomes the lesser evil"
  - "We publish packages externally (at which point TSDoc + API Extractor earns its weight over JSDoc)"
  - "The three-tier Always / Recommended / Skip convention keeps producing false positives on edge cases"
---

## Context

The platform needed an inline documentation convention that balanced rigor (so agents and humans can trust intent-focused comments) against overhead (so docs don't become busywork on every file). TypeScript already carries type signatures; the question was what role prose comments play on top of that, and how to enforce consistency without heavy tooling.

## Alternatives considered

### TSDoc + API Extractor

**Why considered.** Stricter spec than JSDoc; produces machine-readable output suitable for published API docs.

**Why rejected.** Overkill for an application (vs. a published library). The platform is not a library we publish; API surface is internal. TSDoc's stricter validation and API Extractor tooling add maintenance burden without matching payoff at our scale.

**Would change our mind if.** We publish packages externally — at that point TSDoc + API Extractor earns its weight.

### ESLint enforcement of JSDoc

**Why considered.** Makes missing docs a lint error; integrates with existing CI.

**Why rejected (for now).** Rule tuning is finicky, false-positive-prone, and adds a dependency for something the refactor pipeline can address with existing scan infrastructure. Agent-driven enforcement via `scan-documentation` fits the stack we already use.

**Would change our mind if.** Agent scanning proves unreliable at catching drift-prone docs.

## Decision

Inline docs use **JSDoc syntax** with an intent-focused, **three-tier convention** (Always / Recommended / Skip). Enforcement lives in the `scan-documentation` rule library in the refactor pipeline — findings land on the refactor board tagged `(documentation)` in the Fix lane. No ESLint for now.

The three-tier convention:
- **Always:** exported functions / service-layer contracts / shared package types — these need meaningful JSDoc with intent, contracts, and edge cases
- **Recommended:** non-trivial internal functions where the "why" isn't obvious from the name + types
- **Skip:** trivial helpers, type annotations that already self-document, one-liners

Convention documented at `platform/.claude/rules/inline-documentation.md` (auto-loaded by Claude Code).

## Consequences

**Enforcement pattern.** The `scan-documentation` rule library is part of the refactor pipeline's scan suite. `/refactor-scan` finds missing/drift-prone JSDoc, places findings on the refactor board tagged `(documentation)` in the Fix lane. `/refactor-fix` then handles them like any other refactor finding.

**TypeScript carries type signatures.** Doc comments add intent, contracts, and edge cases — they don't restate the types. A good JSDoc block answers "why does this exist and what surprises a reader?" not "what types does this accept?"

**IDE support is universal.** JSDoc works everywhere — hover tooltips in VS Code, Theia, IntelliJ, browser devtools.

**Migration path to TSDoc remains clean.** If the project ever publishes packages externally, TSDoc is JSDoc-compatible — we can tighten into TSDoc without rewriting existing comments.

## Related

- `platform/research/inline-documentation-conventions.md` — full evaluation (JSDoc vs TSDoc vs alternatives)
- `platform/.claude/rules/inline-documentation.md` — the three-tier convention, auto-loaded
- `platform/.claude/skills/scan-documentation/` — the scan rule library that enforces it
