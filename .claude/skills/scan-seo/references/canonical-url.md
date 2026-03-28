# Rule: Canonical URL

> Parameterized routes must include a `<link rel="canonical">` tag to declare the preferred URL for the page.

## Motivation

Pages accessible via multiple URL patterns (e.g., by ID and by slug, with or without
query parameters) can fragment search engine indexing. A canonical link tells crawlers
which URL to index. TanStack Start's `head()` supports this via the `links` array:
`{ rel: "canonical", href: "https://..." }`.

## Prerequisites

Canonical URLs must be **absolute**. The platform needs a `SITE_URL` environment
variable (e.g., `https://s-nc.tv`) to construct them. See the open-graph reference
for the same prerequisite.

## Before / After

### From this codebase: content accessible by slug

**Before:** (`apps/web/src/routes/content/$creatorSlug/$contentSlug.tsx`)
```tsx
// Content is accessible at /content/{creatorSlug}/{contentSlug}
// No canonical URL declared — search engines may index duplicate URLs
// if the same content is linkable via different paths
```

**After:**
```tsx
head: ({ loaderData }) => {
  if (!loaderData?.item) return {};
  const { item } = loaderData;
  const siteUrl = import.meta.env.VITE_SITE_URL ?? "";
  return {
    meta: [
      { title: `${item.title} — S/NC` },
    ],
    links: [
      { rel: "canonical", href: `${siteUrl}/content/${item.creatorHandle}/${item.slug}` },
    ],
  };
},
```

### From this codebase: creator profile with handle fallback

**Before:** (`apps/web/src/routes/creators/$creatorId.tsx`)
```tsx
// Creator pages accept both handle and UUID in the $creatorId param
// (human-readable-url-slug pattern: handle ?? id)
// No canonical — both /creators/cool-band and /creators/uuid-123 index separately
```

**After:**
```tsx
head: ({ loaderData }) => {
  if (!loaderData) return {};
  const siteUrl = import.meta.env.VITE_SITE_URL ?? "";
  const canonicalSlug = loaderData.handle ?? loaderData.id;
  return {
    links: [
      { rel: "canonical", href: `${siteUrl}/creators/${canonicalSlug}` },
    ],
  };
},
```

## Exceptions

- Listing pages with pagination — canonical should point to the first page (no cursor param); this is a content-level decision
- Pages that are truly unique (single URL, no params) — canonical is optional but harmless
- Admin and auth routes — not indexed, no canonical needed

## Scope

- Applies to: routes in `apps/web/src/routes/` with dynamic `$param` segments
- Priority: routes where the same entity is accessible via multiple URL patterns (slug + ID)
- Does NOT apply to: static routes, admin routes, auth routes, test files
