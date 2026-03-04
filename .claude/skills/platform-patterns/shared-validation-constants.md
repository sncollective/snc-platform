# Pattern: Shared Validation Constants

Validation predicates (regex patterns) exported from `@snc/shared` and imported by both server-side Zod schemas and client-side `zod/mini` schemas, ensuring the same rules run on both layers without duplication.

## Rationale

When a field must be validated on both the API (security) and the frontend (UX), defining the regex once in `@snc/shared` and importing it in both places prevents drift: the client and server can never disagree about what constitutes a valid value. This extends the existing `@snc/shared` type-sharing approach to also share the validation predicates themselves.

## Examples

### Example 1: BANDCAMP_URL_REGEX in shared schema
**File**: `packages/shared/src/creator.ts:5-21`
```typescript
// Defined once in @snc/shared
export const BANDCAMP_URL_REGEX =
  /^https?:\/\/[a-zA-Z0-9-]+\.bandcamp\.com(\/.*)?$/;

// Used directly in the shared Zod schema
export const UpdateCreatorProfileSchema = z.object({
  bandcampUrl: z
    .union([
      z.string().regex(BANDCAMP_URL_REGEX, "Must be a valid bandcamp.com URL"),
      z.literal(""),
    ])
    .optional(),
  // ...
});
```

### Example 2: BANDCAMP_URL_REGEX imported by frontend zod/mini schema
**File**: `apps/web/src/routes/settings/creator.tsx:7-29`
```typescript
// Imported from shared — same regex, not a local copy
import { BANDCAMP_URL_REGEX, BANDCAMP_EMBED_REGEX } from "@snc/shared";

// Wrapped to also allow empty string (clearing)
const BANDCAMP_URL_SCHEMA = z.object({
  bandcampUrl: z.string().check(
    regex(
      new RegExp(`^(?:${BANDCAMP_URL_REGEX.source})?$`),
      "Must be a valid bandcamp.com URL",
    ),
  ),
});
```

### Example 3: BANDCAMP_EMBED_REGEX in shared schema and frontend
**File**: `packages/shared/src/creator.ts:8,22-28`
```typescript
export const BANDCAMP_EMBED_REGEX =
  /^https:\/\/bandcamp\.com\/EmbeddedPlayer\/.+$/;

// Used in shared Zod schema
bandcampEmbeds: z
  .array(z.string().regex(BANDCAMP_EMBED_REGEX, "Must be a valid Bandcamp embed URL"))
  .max(10, "Maximum 10 embeds allowed")
  .optional(),
```

**File**: `apps/web/src/routes/settings/creator.tsx:31-35`
```typescript
// Same constant used in zod/mini schema for frontend validation
const EMBED_URL_SCHEMA = z.object({
  embedUrl: z.string().check(
    regex(BANDCAMP_EMBED_REGEX, "Must be a valid Bandcamp embed URL"),
  ),
});
```

## When to Use
- When a field has a non-trivial validation rule (regex, enum, custom constraint) that must run on both client and server
- When validation logic for the same field could drift between layers (client validates one pattern, server validates another)
- When the constant provides documentary value (named regex is clearer than inline literal)

## When NOT to Use
- Simple built-in constraints (`min`, `max`, `email`) that Zod/zod-mini share already — use them directly
- Server-only validation that is meaningless on the frontend (e.g., DB uniqueness checks)
- One-off validation used in only one place — export only when reused

## Common Violations
- **Duplicating the regex locally**: Defining the same pattern in both `@snc/shared` and the frontend component creates drift risk — export from shared instead.
- **Embedding the source string inline**: Using `BANDCAMP_URL_REGEX.source` directly in a `new RegExp()` at runtime works but loses the original regex flags — prefer using the exported `RegExp` object directly where possible.
