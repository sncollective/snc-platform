# Quality: Duplication

> Flag duplicated logic only when the same business concept is expressed in multiple places and a requirements change would need to update all instances.

## What to Flag

- **Cross-file duplication**: Near-identical code blocks across 2+ files (query patterns, transformers, validation sequences, fetch wrappers, mock setup)
- **Intra-file duplication**: Repeated logic within a single file that could be a helper
- **Boilerplate**: Structural patterns that differ only in types or field names
- **Fixture inconsistencies**: Naming variations or overlapping factories across test helpers

## What NOT to Flag

- Similar structure but **different domain concepts** (a user transformer and a content transformer may look alike but evolve independently)
- **Independent evolution expected** (two endpoints that happen to do similar things today but serve different use cases)
- **Coupling would create fragile shared state** (shared helper that needs 5 parameters to handle all cases)
- Patterns documented as intentionally separate in the project's pattern library

## From This Codebase

**Flaggable**: `creator.routes.ts` has 4x identical member-list query blocks at lines 530, 614, 691, 781 — same columns, same joins, same formatting. Extract `fetchAndFormatMembers()`.

**Not flaggable**: `api/tests/helpers/` and `web/tests/helpers/` have similar fixture factories (`makeMockUser`). These are intentionally duplicated per the `dual-layer-fixtures` pattern — API uses Date objects, web uses ISO strings.

## Confidence

- Exact duplicate across 3+ sites, same business concept → **high** (Fix lane)
- Near-duplicate across 2 sites, same intent → **medium** (Analyze lane)
- Structural similarity across domains → **skip** (intentional)
