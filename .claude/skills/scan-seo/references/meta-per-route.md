# Rule: Meta Per Route

> Every route with a `loader` function must define a `head()` function that sets a dynamic title and description from loader data.

## Motivation

Search engines use `<title>` and `<meta name="description">` as the primary signals
for result snippets. TanStack Start's `head()` function receives `ctx.loaderData` and
merges child route meta over the root — the deepest title wins. Routes that fetch
entity data but skip `head()` inherit only the generic root title ("S/NC"), making
every page look identical in search results.

## Before / After

### From this codebase: content detail route

**Before:** (`apps/web/src/routes/content/$creatorSlug/$contentSlug.tsx`)
```tsx
export const Route = createFileRoute("/content/$creatorSlug/$contentSlug")({
  errorComponent: RouteErrorBoundary,
  loader: async ({ params }): Promise<SlugContentDetailLoaderData> => {
    // ... fetches item with title, description, etc.
    return { item, plans, canManage };
  },
  // No head() — inherits root "S/NC" title for all content pages
  component: SlugContentDetailPage,
});
```

**After:**
```tsx
export const Route = createFileRoute("/content/$creatorSlug/$contentSlug")({
  errorComponent: RouteErrorBoundary,
  loader: async ({ params }): Promise<SlugContentDetailLoaderData> => {
    // ... fetches item with title, description, etc.
    return { item, plans, canManage };
  },
  head: ({ loaderData }) => {
    if (!loaderData?.item) return {};
    const { item } = loaderData;
    return {
      meta: [
        { title: `${item.title} — S/NC` },
        { name: "description", content: item.description ?? "" },
      ],
    };
  },
  component: SlugContentDetailPage,
});
```

### From this codebase: creator profile route

**Before:** (`apps/web/src/routes/creators/$creatorId.tsx`)
```tsx
export const Route = createFileRoute("/creators/$creatorId")({
  errorComponent: RouteErrorBoundary,
  loader: async ({ params }): Promise<CreatorProfileResponse | null> => {
    // ... fetches creator profile with displayName, bio, etc.
  },
  // No head() — all creator pages show "S/NC"
  component: CreatorLayout,
});
```

**After:**
```tsx
export const Route = createFileRoute("/creators/$creatorId")({
  errorComponent: RouteErrorBoundary,
  loader: async ({ params }): Promise<CreatorProfileResponse | null> => {
    // ... fetches creator profile with displayName, bio, etc.
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    return {
      meta: [
        { title: `${loaderData.displayName} — S/NC` },
        { name: "description", content: loaderData.bio ?? "" },
      ],
    };
  },
  component: CreatorLayout,
});
```

## Exceptions

- Routes that serve as layout wrappers only (render `<Outlet />` with no visible content) — head should be set by the leaf child route instead
- Routes behind a feature flag that return `null` when disabled — the `head()` function should guard with `if (!loaderData) return {}`
- Static pages without loader data (e.g., pricing, about) — a static `head()` with hardcoded title/description is fine

## Scope

- Applies to: route files in `apps/web/src/routes/` that define a `loader`
- Does NOT apply to: test files, root route (already has head), layout-only routes with no entity data
