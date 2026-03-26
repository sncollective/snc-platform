---
name: scan-seo
description: >
  SEO scan rules for the SNC platform. Checks that routes with loader data
  provide proper meta tags, Open Graph, canonical URLs, structured data, and
  resource hints. Loaded by refactor-scan as a rule library.
---

# SEO Scan Rules

Scan the codebase for search engine optimization gaps detectable via static
analysis. Each rule has a reference file with rationale, examples, and exceptions.

## Rules

| Rule | Summary | Reference |
|------|---------|-----------|
| meta-per-route | Routes with loaders must define `head()` with dynamic title and description | [details](references/meta-per-route.md) |
| open-graph | Entity detail routes must include og:title, og:description, og:image, og:type | [details](references/open-graph.md) |
| canonical-url | Parameterized routes must include `<link rel="canonical">` | [details](references/canonical-url.md) |
| structured-data | Routes rendering schema.org-mappable entities should include `script:ld+json` | [details](references/structured-data.md) |
| image-decoding | `<img>` elements should include `decoding="async"` | [details](references/image-decoding.md) |
| resource-hints | Third-party origins used in components need `preconnect` or `dns-prefetch` in root head | [details](references/resource-hints.md) |

## Confidence Mapping

| Finding type | Typical confidence | Lane |
|-------------|-------------------|------|
| Route with loader but no `head()` | high | Fix |
| Entity detail route missing OG tags | high | Fix |
| Parameterized route missing canonical URL | high | Fix |
| `<img>` missing `decoding="async"` | high | Fix |
| Entity route missing JSON-LD structured data | medium | Analyze |
| Third-party origin missing resource hint | medium | Analyze |

## Scope Boundaries

- **Heading hierarchy** is covered by `scan-accessibility` (heading-hierarchy rule) — not duplicated here
- **Responsive images** (srcSet/sizes) deferred — no image resize infrastructure exists yet
- **Sitemap and robots.txt** are one-time implementation tasks, not recurring scan findings
- **Content quality** (meta description length, keyword density) is a content concern, not code

## Prerequisite: Absolute URLs

Several rules (open-graph, canonical-url) require absolute URLs. The platform
currently uses relative image URLs (`/api/content/{id}/thumbnail`). A `SITE_URL`
environment variable and a small URL helper are prerequisites. Reference files
document this as part of the fix pattern.
