# Rule: Open Graph

> Entity detail routes must include og:title, og:description, og:image, and og:type meta tags for social sharing previews.

## Motivation

When a URL is shared on social media, messaging apps, or aggregators, the platform
fetches Open Graph meta tags to build a rich preview card. Without them, shares show
a bare URL or the generic site title. TanStack Start's `head()` supports OG tags via
the `{ property: "og:...", content: "..." }` MetaDescriptor variant. Child route OG
tags override the parent by `property` key.

## Prerequisites

OG tags require **absolute URLs** for `og:image` and `og:url`. The platform currently
serves images via relative paths (`/api/creators/{id}/avatar`). To produce absolute
URLs, add a `SITE_URL` environment variable (e.g., `https://s-nc.tv`) and use it to
prefix relative paths in `head()`.

## Before / After

### From this codebase: content detail route

**Before:** (`apps/web/src/routes/content/$creatorSlug/$contentSlug.tsx`)
```tsx
// No head() — social shares show bare URL with no preview card
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
      { name: "description", content: item.description ?? "" },
      { property: "og:title", content: item.title },
      { property: "og:description", content: item.description ?? "" },
      { property: "og:type", content: "article" },
      { property: "og:url", content: `${siteUrl}/content/${item.creatorHandle}/${item.slug}` },
      ...(item.thumbnailUrl
        ? [{ property: "og:image", content: `${siteUrl}${item.thumbnailUrl}` }]
        : []),
    ],
  };
},
```

### Synthetic example: creator profile

```tsx
head: ({ loaderData }) => {
  if (!loaderData) return {};
  const siteUrl = import.meta.env.VITE_SITE_URL ?? "";
  return {
    meta: [
      { title: `${loaderData.displayName} — S/NC` },
      { property: "og:title", content: loaderData.displayName },
      { property: "og:description", content: loaderData.bio ?? "" },
      { property: "og:type", content: "profile" },
      { property: "og:url", content: `${siteUrl}/creators/${loaderData.handle ?? loaderData.id}` },
      ...(loaderData.avatarUrl
        ? [{ property: "og:image", content: `${siteUrl}${loaderData.avatarUrl}` }]
        : []),
    ],
  };
},
```

## og:type Reference

| Page type | og:type |
|-----------|---------|
| Content detail (article, audio, video) | `article` |
| Creator profile | `profile` |
| Landing page | `website` |
| Product/merch | `product` |

## Exceptions

- Pages behind disabled feature flags — guard with `if (!loaderData) return {}`
- Admin-only pages — no public sharing expected
- Auth pages (login, register) — generic site OG is sufficient from root
- Pages with no meaningful image — omit `og:image` rather than using a placeholder

## Scope

- Applies to: entity detail routes in `apps/web/src/routes/` (content, creators, merch, projects)
- Does NOT apply to: listing pages (index routes), admin routes, auth routes, test files
