# Rule: Resource Hints

> Third-party origins referenced in the application should have `preconnect` or `dns-prefetch` hints in the root route's `head()`.

## Motivation

DNS lookup + TCP handshake + TLS negotiation add 100-300ms per new origin. A
`<link rel="preconnect">` in the document head starts this process early, before
the browser discovers the resource naturally. This directly impacts Time to First
Byte for third-party resources and can improve LCP when images or fonts come from
external origins.

## Before / After

### From this codebase: Google Fonts (positive example)

**Already correct:** (`apps/web/src/routes/__root.tsx` lines 43-48)
```tsx
links: [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
],
```
Google Fonts origins are properly preconnected.

### Flaggable pattern: third-party origins without hints

The platform integrates with several external services (configured via env vars):
- **Owncast** streaming server (`OWNCAST_URL`, `OWNCAST_HLS_URL`) — HLS video segments loaded in-browser
- **Shopify** storefront (`SHOPIFY_STORE_DOMAIN`) — merch product data
- **Stripe** checkout — redirect-based, less benefit from preconnect

When these features are enabled and their origins are known at build time, they
should be preconnected.

**Before:**
```tsx
// Root head() has no preconnect for Owncast HLS origin
// When a user visits a live stream page, the browser discovers the HLS origin
// only when the video player requests the first segment — 200ms+ penalty
```

**After:**
```tsx
links: [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  // Add when streaming feature is enabled and origin is known
  ...(import.meta.env.VITE_OWNCAST_HLS_URL
    ? [{ rel: "dns-prefetch", href: new URL(import.meta.env.VITE_OWNCAST_HLS_URL).origin }]
    : []),
],
```

Note: use `dns-prefetch` (lighter) for origins that may not be needed on every page.
Use `preconnect` (heavier, full connection setup) only for origins needed on most pages.

## Exceptions

- Same-origin resources (`/api/*`) — no hint needed, connection is already established
- Origins used only via server-side API calls (never fetched by the browser) — preconnect is for browser-initiated requests only
- Stripe — checkout uses a redirect, not in-page resource loading; preconnect adds no value
- Origins that vary per user or per page — can't be preconnected globally in root head

## Scope

- Applies to: `apps/web/src/routes/__root.tsx` (root head) and any third-party origin usage in client-side components
- Detection: search for external URLs in component/hook/lib files, cross-reference with root head preconnect list
- Does NOT apply to: API server code, test files, build config
- Confidence: **medium** — requires judgment about which origins are browser-fetched vs server-fetched
