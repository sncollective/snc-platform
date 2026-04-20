---
tags: [content, community, ux-polish]
release_binding: null
created: 2026-04-20
---

# Event location as map-app link

Upcoming event cards and event detail views show location as plain text (`"The Whiskey"` on Maya Chen's show, observed 2026-04-20). On mobile and desktop, making the location a tap/click-to-open-map link would shave a step off the common "where is this?" user path — users could jump straight to directions in their preferred map app.

## Scope when picked up

- Event card (`components/landing/event-card.tsx` + `apps/web/src/components/calendar/event-detail.tsx` or equivalent) wraps the location text in an `<a>` element.
- **Link target:** `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}` works universally — browsers/OS handle redirecting to the user's preferred map app (Apple Maps on iOS, Google Maps on Android, chosen default on desktop). The `geo:` URI is mobile-only and unreliable on desktop; the Google Maps search URL is the standard.
- Accept free-form location strings (no parsing required — the URL encoder handles it).
- Consider `rel="noopener noreferrer"` + `target="_blank"` to open in a new tab/app.
- Style: underline on hover, keep the location icon prefix if present.

No backend change.
