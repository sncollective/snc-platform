---
id: epic-landing-page-redesign
kind: epic
stage: done
tags: [content, community]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-20
related_decisions: []
related_designs: []
parent: null
---

# Landing Page Redesign

Transforms the S/NC landing page from a static brochure into a living media hub. Adds "What's On" channel strip (streaming status), "Coming Up" public events, "Fresh Drops" hero+grid content layout, ContentCard container query adaptation, and section voice pass. Requires a calendar schema migration (visibility column) and a new public API endpoint.

---

## Vision

The landing page becomes a living media hub — not a brochure. "Something is happening here and it's exciting." The content speaks for itself and has a curated feel. No algorithmic personalization — editorial surface that shows what's on, what's new, and what's coming.

Key metaphor: **TV channels.** The live section feels like flipping through channels — S/NC Music = MTV (music videos), S/NC Classics = movies, live streams = Twitch. There's always something on because playout runs 24/7.

---

## Current State

**Landing page:** `apps/web/src/routes/index.tsx`
- Loader fetches creators (8), recent content (6), and subscription plans in parallel
- Components: `HeroSection` → `FeaturedCreators` → `RecentContent` → `LandingPricing`
- Hero adapts to auth/subscription state (subscribe CTA vs explore vs coming-soon)

**Current sections:**
- `HeroSection` — static branding hero with auth-aware CTA (`components/landing/hero-section.tsx`)
- `FeaturedCreators` — horizontal scroll strip of `CreatorCard` components (`components/landing/featured-creators.tsx`)
- `RecentContent` — 6 `ContentCard` items in `content-grid` + "View all content" link (`components/landing/recent-content.tsx`)
- `LandingPricing` — subscription plans grid, feature-flagged (`components/landing/landing-pricing.tsx`)

**Shared styles:** `styles/landing-section.module.css` provides `.section`, `.heading`, `.empty` for all landing sections.

**Feed/content card:** `components/content/content-card.tsx` — uniform vertical card with 16:9 thumbnail, type badge, lock indicator, title, creator, date. Already has a `cardNoThumbnail` variant (left accent border, inline badge). Reused in feed, landing, creator detail, my-content-list.

**Streaming status API:** `GET /api/streaming/status` (exists, no auth required via `optionalAuth`)
- Returns: `{ channels: [{ id, name, type, thumbnailUrl, hlsUrl, viewerCount, creator, startedAt, nowPlaying }], defaultChannelId }`
- Channel types include playout (always-on) and live (creator streams)
- `nowPlaying` has track/show info for playout channels

**Calendar events API:** `GET /api/calendar/events` (requires auth + stakeholder role)
- Schema: `apps/api/src/db/schema/calendar.schema.ts`
- No `visibility` column — all events are internal
- Event types: `recording-session`, `show`, `meeting`, `task`, `other` (plus custom types)
- Shared types: `packages/shared/src/calendar.ts`

---

## Architectural Decisions

### 1. "What's On" channel strip — streaming status drives the hero

The streaming `/status` endpoint already returns everything needed. No new API work.

**Layout behavior:**
- Default: horizontal strip of channel cards below the brand hero. Each card is a mini "TV screen" — channel name, now-playing info, viewer count for live channels.
- When a creator is live: their channel card auto-promotes to the hero position — full-width card with live embed or large thumbnail + "Watch Live" CTA. Remaining channels stay in the strip below.
- When nobody's live and playout is running: brand hero stays, channel strip shows "Now Playing" for each playout channel.

**Implementation approach:**
- New component: `components/landing/whats-on.tsx` — fetches streaming status via loader (already SSR-friendly, no auth required)
- New component: `components/landing/channel-card.tsx` — individual channel card (type badge: LIVE/NOW PLAYING, channel name, current track/show, viewer count)
- The live-hero-takeover is a conditional in the landing page: if any channel has `type === "live"` and viewers, render it as hero; otherwise render brand hero + channel strip.

**Channel card visual:**
- Playout channel: channel name, "NOW PLAYING" label, track/show title, subtle animated equalizer or waveform icon
- Live channel: creator avatar/name, LIVE badge (red, pulsing), viewer count, channel name — pulsing accent border to draw attention

### 2. "Coming Up" — public events endpoint

**Schema change:** Add `visibility` column to `calendar_events` table.

```
visibility: text("visibility").notNull().default("internal")
```

Values: `"public"` | `"internal"`. Default `"internal"` — non-breaking migration, all existing events stay internal.

**New public endpoint:** `GET /api/events/upcoming`

```
Query: { limit?: number }  (default 5, max 20)
Response: { items: UpcomingEvent[] }
```

`UpcomingEvent` is a subset of `CalendarEvent` — public-safe fields only:
- `id`, `title`, `description`, `startAt`, `endAt`, `allDay`, `eventType`, `location`, `creatorName`
- Excludes: `createdBy`, `projectId`, `projectName`, `completedAt`, `deletedAt`

Filters: `visibility = "public"` AND `startAt > now()` AND `deletedAt IS NULL`. Ordered by `startAt ASC`.

No auth required. New route file: `apps/api/src/routes/upcoming-events.routes.ts`.

**UX hint in event creation:** When `eventType` is `"show"`, default `visibility` to `"public"` in the create form. Not enforced — user can override.

### 3. "Fresh Drops" — hero + grid layout

Replace the uniform `content-grid` in `RecentContent` with a two-part layout:

1. **Hero card** — first item (or first video if available) rendered in a wider container. `ContentCard` in horizontal layout via container query (thumbnail left, info right). Larger thumbnail, more breathing room.
2. **Supporting grid** — remaining items in the existing 2-3 column `content-grid`.

No API change — same 6 items from `/api/content?limit=6`. The layout change is pure CSS + minor JSX restructuring in `recent-content.tsx`.

The `.heroSlot` container has `container-type: inline-size` — the ContentCard inside adapts via `@container`.

### 4. ContentCard container query

Add a container-query-driven horizontal variant to `components/content/content-card.module.css`:

```css
/* When placed in a wide container (hero slot), switch to horizontal layout */
@container (min-width: 500px) {
  .card {
    flex-direction: row;
  }

  .thumbnailWrapper {
    width: 45%;
    flex-shrink: 0;
    aspect-ratio: 16 / 9;
  }

  .info {
    justify-content: center;
  }
}
```

The card's parent must declare `container-type: inline-size`. Existing consumers (feed grid, creator detail) don't declare container-type — cards remain vertical. No unintended layout changes.

### 5. Section voice pass

| Current | New |
|---------|-----|
| (brand hero) | (dynamic — live hero or brand hero) |
| "Featured Creators" | "Creators" |
| "Recent Content" | "Fresh Drops" |
| (none) | "What's On" |
| (none) | "Coming Up" |

### 6. Page section order

Top to bottom:
1. **Live hero** (conditional — only when a creator is live) OR **Brand hero** (default)
2. **"What's On"** channel strip (always present when streaming feature is enabled)
3. **"Fresh Drops"** — hero card + supporting grid
4. **"Coming Up"** — upcoming public events (always present when calendar feature is enabled)
5. **"Creators"** — horizontal scroll strip (existing)
6. **Pricing** — subscription plans (feature-flagged, existing)

---

## Implementation Pitfalls

- **Streaming status in SSR:** The `/streaming/status` endpoint is `optionalAuth` — works without auth. Safe to call from the loader. But if SRS is down, it returns 502/503. The loader must catch errors gracefully (show brand hero, hide channel strip) like the existing creator/content loaders do.
- **Calendar visibility migration:** Default to `"internal"` so existing events don't suddenly appear on the public landing page. Migration is non-breaking.
- **ContentCard CQ and existing consumers:** The `@container` rule only activates when a parent has `container-type: inline-size`. Existing consumers (feed grid, creator detail) don't declare container-type on the grid, so cards remain vertical.
- **Live hero takeover + reduced motion:** The pulsing LIVE badge border should respect `prefers-reduced-motion` — use the existing `--duration-*` token reset from `motion.css`.
- **Event card "Remind Me" slot:** Render a button element (not a link) with `disabled` state and a tooltip "Coming soon" or similar. The button slot exists in the DOM for future notification wiring without component changes.

---

## Key File References

| File | Role |
|------|------|
| `apps/web/src/routes/index.tsx` | Landing page route + loader |
| `apps/web/src/components/landing/hero-section.tsx` | Brand hero (evolves to conditional) |
| `apps/web/src/components/landing/featured-creators.tsx` | Creator scroll strip |
| `apps/web/src/components/landing/recent-content.tsx` | Content grid (→ Fresh Drops) |
| `apps/web/src/components/content/content-card.tsx` | Shared content card |
| `apps/web/src/components/content/content-card.module.css` | Card styles (CQ target) |
| `apps/web/src/styles/landing-section.module.css` | Shared section styles |
| `apps/api/src/routes/streaming.routes.ts` | Streaming status endpoint |
| `apps/api/src/routes/calendar.routes.ts` | Calendar events (auth-gated) |
| `apps/api/src/db/schema/calendar.schema.ts` | Calendar DB schema |
| `packages/shared/src/calendar.ts` | Calendar shared types |
