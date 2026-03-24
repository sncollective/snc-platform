# Rule: Shared Package Export Undocumented

> Every export from `packages/shared/src/` must have a `/** */` comment.

## Motivation

The shared package is the contract between the API and web apps. Types, schemas, constants, and
utilities defined here are consumed by two separate applications and by implementation agents
working in either codebase. IDE tooltips are the primary way consumers understand what a shared
export does — without a doc comment, they see only the type signature.

Because shared exports cross application boundaries, the bar for documentation is higher than for
app-internal code.

## Before / After

### From this codebase: well-documented shared types (gold standard)

**Already correct:** (actual code from `packages/shared/src/result.ts`)
```typescript
/** Success branch of a Result. */
export type Ok<T> = { readonly ok: true; readonly value: T };

/** Failure branch of a Result. */
export type Err<E> = { readonly ok: false; readonly error: E };

/**
 * Discriminated union for service-layer functions that can fail predictably.
 * Defaults to `AppError` as the error type when `E` is not specified.
 */
export type Result<T, E = AppError> = Ok<T> | Err<E>;

/** Create a success Result containing `value`. */
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

/** Create a failure Result containing `error`. */
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

Every type and factory function has a concise doc explaining its role.

### Synthetic example: undocumented shared constants

**Before:**
```typescript
export const CONTENT_TYPES = ["audio", "video", "written"] as const;
export const VISIBILITY = ["public", "subscribers"] as const;
export const MAX_SOCIAL_LINKS = 10;
```

**After:**
```typescript
/** Valid content types for creator uploads. */
export const CONTENT_TYPES = ["audio", "video", "written"] as const;

/** Content visibility levels — controls subscription gating. */
export const VISIBILITY = ["public", "subscribers"] as const;

/** Maximum social links allowed per creator profile. */
export const MAX_SOCIAL_LINKS = 10;
```

Even "obvious" constants benefit from a one-liner when they're consumed across apps — it
confirms intent and prevents misuse.

## Exceptions

- **Zod schemas with self-documenting names** — `export const CreateContentSchema = z.object({...})`
  is clear from the name and structure; a doc comment adds little unless the schema has non-obvious
  validation rules (regex patterns, custom refinements)
- **Inferred types** — `export type CreateContent = z.infer<typeof CreateContentSchema>` is derived
  and self-documenting
- **`index.ts` barrel re-exports** — the source module has the docs

## Scope

- **Scan:** `packages/shared/src/` — all `.ts` files except `index.ts`
- **Focus on:** exported functions, type aliases, interfaces, and constants
- **Skip:** Zod schemas with clear names, inferred types (`z.infer<...>`), barrel re-exports
