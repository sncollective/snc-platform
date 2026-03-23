# Quality: Complexity

> Flag functions, components, or modules that are harder to understand than they need to be.

## What to Flag

- **Long functions** (>40 lines) that handle multiple concerns and could decompose
- **Deep nesting** (>3 levels of indentation from conditionals, loops, or callbacks)
- **Type assertions** (`as T`) that could be replaced with type narrowing or guards
- **Magic numbers/strings** — literal values without named constants
- **Speculative code** — unused abstractions, over-engineered flexibility, YAGNI violations
- **State explosion** — components with 10+ useState calls that should be a reducer

## What NOT to Flag

- Long functions that are **linear and readable** (step 1, step 2, step 3 — no branching)
- Switch statements on discriminated unions (depth comes from exhaustive matching, not complexity)
- Type assertions in test fixtures (convenience over strictness is acceptable in tests)
- Named constants already in use (don't flag the constants themselves as complexity)

## From This Codebase

**Flaggable**: `settings.tsx` has 15 useState calls mixing profile editing, uploads, and social links — candidate for useReducer or component splitting.

**Flaggable**: `event-form.tsx` uses `setTimeout` anti-pattern instead of useEffect dependency tracking.

**Not flaggable**: Route handlers at 30-60 lines that follow the parse→validate→delegate→respond pattern — they're linear, not complex.

## Confidence

- Deep nesting (>3 levels) → **high** (Fix lane — usually a guard clause extraction)
- Magic number/string → **high** (Fix lane — extract constant)
- State explosion (10+ useState) → **medium** (Analyze lane — needs reducer design)
- Long function (>40 lines, multiple concerns) → **medium** (Analyze lane — decomposition needs thought)
- Speculative/unused code → **medium** (Analyze lane — confirm it's truly unused)
