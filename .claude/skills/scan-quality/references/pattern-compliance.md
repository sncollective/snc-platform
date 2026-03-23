# Quality: Pattern Compliance

> Flag code that deviates from documented project patterns or uses stale pattern examples.

## What to Flag

- **Pattern drift**: Code that doesn't follow a pattern documented in `{project}/.claude/skills/*-patterns/`
- **Missing patterns**: Repeated code structures that should be documented as a pattern but aren't
- **Stale patterns**: Documented pattern examples that no longer match the actual code (pattern docs need updating)

## How to Check

1. Load the project's pattern index from `{project}/.claude/skills/platform-patterns/SKILL.md`
2. For each file in scope, check if it uses patterns that have documented conventions
3. Compare actual code against the pattern's documented examples
4. Flag deviations unless the code has a clear reason to differ

## What NOT to Flag

- Code in areas where no pattern exists yet (this is a "missing pattern" finding, not a drift finding)
- Test code that intentionally deviates from production patterns (test factories, mock setup)
- One-off code that doesn't warrant a pattern (single-use utility)

## From This Codebase

**Pattern drift**: A route handler that accesses `c.req.json()` directly instead of using `zValidator` (violates `schema-at-boundary` pattern).

**Missing pattern**: Multiple route files use the same cursor pagination query construction but there's no shared helper — the `cursor-encode-decode` pattern documents the utility but several newer routes duplicate the SQL construction.

**Stale pattern**: If a pattern file references a function signature that was renamed or restructured.

## Confidence

- Clear pattern drift (documented pattern exists, code ignores it) → **medium** (Analyze lane — may have a reason)
- Missing pattern (3+ instances of same structure) → **low** (Backlog — needs discussion on whether to document)
- Stale pattern docs → **high** (Fix lane — update the docs, not the code)
