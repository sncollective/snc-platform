# Rule: Structured Data

> Routes rendering entities that map to schema.org types should include JSON-LD structured data via the `script:ld+json` MetaDescriptor.

## Motivation

JSON-LD structured data helps search engines understand page content semantically,
enabling rich results (knowledge panels, recipe cards, event listings, breadcrumbs).
TanStack Start has first-class support via the `{ "script:ld+json": { ... } }`
MetaDescriptor variant in `head()` — no raw script tags needed.

## Prerequisites

Like OG tags, JSON-LD `image` and `url` properties require absolute URLs.
See the open-graph reference for the `SITE_URL` prerequisite.

## Entity Mapping

| Platform entity | schema.org type | Key properties |
|----------------|----------------|----------------|
| Content (article) | `Article` | headline, description, image, datePublished, author |
| Content (audio) | `MusicRecording` or `AudioObject` | name, description, duration, datePublished |
| Content (video) | `VideoObject` | name, description, thumbnailUrl, uploadDate |
| Creator profile | `Person` or `MusicGroup` | name, description, image, url |
| Merch product | `Product` | name, description, image, offers |
| Booking event type | `Service` | name, description, provider |

## Before / After

### Synthetic example: content detail route

**Before:**
```tsx
// Route fetches FeedItem with title, description, thumbnailUrl, publishedAt, creator
// but provides no structured data — search engines treat it as generic HTML
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
      {
        "script:ld+json": {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: item.title,
          description: item.description ?? undefined,
          ...(item.thumbnailUrl && { image: `${siteUrl}${item.thumbnailUrl}` }),
          datePublished: item.publishedAt,
          author: {
            "@type": "Person",
            name: item.creatorName,
            url: `${siteUrl}/creators/${item.creatorSlug}`,
          },
        },
      },
    ],
  };
},
```

### Synthetic example: creator profile

```tsx
{
  "script:ld+json": {
    "@context": "https://schema.org",
    "@type": "Person",
    name: loaderData.displayName,
    description: loaderData.bio ?? undefined,
    url: `${siteUrl}/creators/${loaderData.handle ?? loaderData.id}`,
    ...(loaderData.avatarUrl && { image: `${siteUrl}${loaderData.avatarUrl}` }),
  },
}
```

## Exceptions

- Pages where the entity type doesn't have a clear schema.org mapping — don't force-fit
- Content behind access gates (subscribers-only) — structured data should describe what's publicly visible, not gated content
- Admin and settings pages — no public semantic meaning
- Listing pages — structured data on individual items is more valuable than on the list itself

## Scope

- Applies to: entity detail routes in `apps/web/src/routes/` (content, creators, merch)
- Does NOT apply to: listing pages, admin routes, auth routes, static pages, test files
- Confidence: **medium** — the fix is straightforward but choosing the right schema.org type and properties requires judgment per entity
