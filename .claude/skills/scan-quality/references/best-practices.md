# Quality: Best Practices

> Surface library best practices and OSS alternatives as advisory findings.

## What to Flag

- **Library misuse**: Using a library feature in a way its docs recommend against
- **Outdated patterns**: Using an older API when the library has a better alternative
- **Hand-rolled code**: Significant custom code that a well-maintained package handles

## How to Research

When hand-rolled code is found in scope, search for well-maintained packages. For each candidate, note:
- Package name and weekly downloads
- Whether it integrates with the existing stack
- Bundle size impact (especially for web packages)
- Maintenance status (last publish date, open issues)

These are **suggestions for evaluation, not recommendations to adopt.** Note trade-offs.

## What NOT to Flag

- Library usage that follows the project's documented conventions (even if a newer API exists)
- Micro-optimizations that don't affect real performance
- Package alternatives with <1000 weekly downloads or unmaintained status

## From This Codebase

**Advisory**: React Compiler could replace manual `useMemo`/`useCallback` — low effort to adopt, medium benefit.

**Advisory**: `clsx/lite` could replace template string conditional class construction.

**Not worth flagging**: Hand-rolled cursor pagination — the implementation is well-tested, documented as a pattern, and adding a library would increase coupling.

## Confidence

All best practice findings are **low** confidence → **Backlog** lane. They're advisory — human
decides whether to pursue. Never place in Fix or Analyze.
