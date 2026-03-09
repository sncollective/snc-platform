# Pattern: Shared Validation Constants

Validation predicates (regex patterns) exported from `@snc/shared` and imported by both server-side Zod schemas and client-side `zod/mini` schemas, ensuring the same rules run on both layers without duplication.

## Rationale

When a field must be validated on both the API (security) and the frontend (UX), defining the regex once in `@snc/shared` and importing it in both places prevents drift: the client and server can never disagree about what constitutes a valid value. This extends the existing `@snc/shared` type-sharing approach to also share the validation predicates themselves.

## Examples

### Example 1: PLATFORM_CONFIG in shared schema
**File**: `packages/shared/src/creator.ts:22-68`
```typescript
// Defined once in @snc/shared — per-platform URL patterns co-located with display metadata
export const PLATFORM_CONFIG: Record<
  SocialPlatform,
  { displayName: string; urlPattern?: RegExp }
> = {
  bandcamp: {
    displayName: "Bandcamp",
    urlPattern: /^https?:\/\/[a-zA-Z0-9-]+\.bandcamp\.com(\/.*)?$/,
  },
  spotify: {
    displayName: "Spotify",
    urlPattern: /^https?:\/\/(open\.)?spotify\.com\/.+$/,
  },
  // ... other platforms
  mastodon: { displayName: "Mastodon" }, // no urlPattern — freeform URL
  website: { displayName: "Website" },   // no urlPattern — any URL accepted
};

// Used in the shared Zod schema via .refine()
export const UpdateCreatorProfileSchema = z.object({
  socialLinks: z
    .array(SocialLinkSchema)
    .max(MAX_SOCIAL_LINKS, `Maximum ${MAX_SOCIAL_LINKS} links allowed`)
    .optional()
    .refine(
      (links) => {
        if (!links) return true;
        for (const link of links) {
          const config = PLATFORM_CONFIG[link.platform];
          if (config.urlPattern && !config.urlPattern.test(link.url)) {
            return false;
          }
        }
        return true;
      },
      { message: "One or more URLs do not match their platform's expected format" },
    ),
});
```

### Example 2: PLATFORM_CONFIG imported by frontend zod/mini schema
**File**: `apps/web/src/routes/settings/creator.tsx:7-11,109-116`
```typescript
// Imported from shared — same config object, not a local copy
import {
  SOCIAL_PLATFORMS,
  PLATFORM_CONFIG,
  MAX_SOCIAL_LINKS,
} from "@snc/shared";

// Platform-specific pattern check applied in the add-link handler
const config = PLATFORM_CONFIG[newPlatform];
if (config.urlPattern && !config.urlPattern.test(trimmedUrl)) {
  setLinkError(
    `URL does not match ${config.displayName} format`,
  );
  return;
}
```

### Example 3: SOCIAL_PLATFORMS drives UI options
**File**: `apps/web/src/routes/settings/creator.tsx:204-208`
```typescript
// SOCIAL_PLATFORMS const-tuple from @snc/shared populates the <select>
// PLATFORM_CONFIG provides the human-readable display name for each option
{SOCIAL_PLATFORMS.map((p) => (
  <option key={p} value={p}>
    {PLATFORM_CONFIG[p].displayName}
  </option>
))}
```

## When to Use
- When a field has a non-trivial validation rule (regex, enum, custom constraint) that must run on both client and server
- When validation logic for the same field could drift between layers (client validates one pattern, server validates another)
- When the constant provides documentary value (named config is clearer than inline literal)

## When NOT to Use
- Simple built-in constraints (`min`, `max`, `email`) that Zod/zod-mini share already — use them directly
- Server-only validation that is meaningless on the frontend (e.g., DB uniqueness checks)
- One-off validation used in only one place — export only when reused

## Common Violations
- **Duplicating the regex locally**: Defining the same pattern in both `@snc/shared` and the frontend component creates drift risk — export from shared instead.
- **Accessing `urlPattern` without a null check**: `PLATFORM_CONFIG` entries may omit `urlPattern` (e.g., `mastodon`, `website`), meaning any URL is accepted. Always guard with `if (config.urlPattern && ...)` before calling `.test()`.
