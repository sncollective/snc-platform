# Inline Documentation Convention

JSDoc (`/** */`) comments for inline code documentation. Focus on intent and contracts — never restate type information.

## Tiers

| Tier | Scope | Requirement |
|------|-------|-------------|
| **Always** | Exported functions from `packages/shared/`, service-layer functions (`services/`), middleware factories, `Result`-returning functions, hook exports, context providers | Must have `/** */` |
| **Recommended** | Route handlers (beyond `describeRoute`), complex internal helpers (>20 lines or non-obvious logic), exported React components with 3+ props, `lib/` utilities | Should have `/** */` |
| **Skip** | Drizzle schema declarations, `index.ts` re-exports, CSS modules, test files, self-documenting constants, trivial private helpers (<10 lines) | No doc needed |

## What to Write

- **One-line summary** in imperative mood: "Check content access.", "Create a checkout session.", "Build cursor pagination condition."
- **Contract notes** when non-obvious: pre-conditions, side effects, error behavior, concurrency, dependencies on middleware
- **`@param`** only when name + type is insufficient (e.g., `options` objects, flags with non-obvious meaning)
- **`@returns`** only for `Result<T>` or discriminated unions where the shape isn't obvious from the type
- **`@throws`** always when a function throws (as opposed to returning `Result`)
- **`@example`** for shared utilities with non-obvious usage patterns

## What NOT to Write

- Redundant type restatement: `@param id - the user ID` when the type is `string` and the name is `userId`
- Implementation details that change with refactoring
- Obvious descriptions: `/** The user schema. */` on `export const UserSchema = ...`
- `@param` / `@returns` with type annotations (`@param {string}`) — TypeScript handles types

## Format

```typescript
/** One-line summary in imperative mood. */
export function doThing(): void { ... }

/**
 * One-line summary.
 *
 * Additional context — contracts, edge cases, side effects.
 *
 * @param options - Description when name+type is insufficient
 * @returns Description when return shape is non-obvious
 * @throws {NotFoundError} When the item doesn't exist
 */
export async function complexThing(options: Options): Promise<Result<T>> { ... }
```

## Gold Standards in the Codebase

- `apps/api/src/services/content-access.ts` — services with full contract docs, priority rules, side effects
- `apps/web/src/lib/fetch-utils.ts` — every export has a concise one-liner
- `apps/api/src/middleware/require-role.ts` — middleware with usage example and dependency chain
- `packages/shared/src/result.ts` — type-level documentation on discriminated union + factories
- `apps/api/src/lib/cursor.ts` — utilities with behavior docs (DESC vs ASC, error cases)

## Enforcement

Enforced via `scan-documentation` rule library in the refactor pipeline. Findings land on the refactor board tagged `(documentation)` in the Fix lane.
