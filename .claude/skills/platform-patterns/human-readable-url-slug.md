# Pattern: Human-Readable URL Slug

Prefer human-readable identifiers (handle, slug) over GUIDs in user-facing URLs, with fallback to ID.

## Rationale
URLs are visible to users in the browser address bar, shared in links, and indexed by search engines. A URL like `/creators/some-band` is more readable, memorable, and SEO-friendly than `/creators/a1b2c3d4-e5f6-...`. Since handles are optional, a GUID fallback ensures every entity is always addressable.

## Examples

### Example 1: Computing a URL slug from an entity
**File**: `apps/web/src/components/creator/creator-card.tsx:20`
```typescript
const creatorSlug = creator.handle ?? creator.id;
```

### Example 2: Using the slug in a TanStack Router Link
**File**: `apps/web/src/components/creator/creator-card.tsx:25`
```tsx
<Link
  to="/creators/$creatorId"
  params={{ creatorId: creatorSlug }}
>
```

### Example 3: Using the slug in programmatic navigation
**File**: `apps/web/src/routes/creators/index.tsx:96`
```typescript
void navigate({
  to: "/creators/$creatorId/manage",
  params: { creatorId: profile.handle ?? profile.id },
});
```

### Example 4: Backend dual-mode resolver (enables slug URLs)
**File**: `apps/api/src/routes/creator.routes.ts:69`
```typescript
const findCreatorProfile = async (
  identifier: string,
): Promise<CreatorProfileRow | undefined> => {
  const rows = await db
    .select()
    .from(creatorProfiles)
    .where(
      or(
        eq(creatorProfiles.id, identifier),
        eq(creatorProfiles.handle, identifier),
      ),
    );
  return rows[0];
};
```

## When to Use
- Any user-facing URL that currently uses a GUID as a path parameter
- When the entity has an optional human-readable field (`handle`, `slug`, `username`)
- Both Link components and programmatic `navigate()` calls

## When NOT to Use
- **API data fetches** — query parameters like `fetchPlans({ creatorId: creator.id })` need the canonical UUID for reliable server-side lookups; don't substitute the handle here
- **React keys** — `key={creator.id}` should stay as the stable UUID
- **Internal state / context** — anywhere the ID is used for logic rather than display

## Common Violations
- **Using `.id` in Link params** when a human-readable alternative exists — produces ugly GUID URLs
- **Forgetting the fallback** — `handle` may be `null`; always use `handle ?? id`
- **Substituting handle in API calls** — API fetch params should use the UUID to avoid ambiguity; this pattern is only for URL construction
