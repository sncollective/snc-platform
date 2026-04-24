---
id: feature-landing-page-redesign-implementation
kind: feature
stage: done
tags: [content, community, calendar]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-20
related_decisions: []
related_designs: []
parent: landing-page-redesign
---

# Landing Page Redesign — Implementation

## Tasks

- [x] **Shared types** — Unit 1: `EventVisibility`, `UpcomingEvent` schemas
- [x] **DB migration** — Unit 2: `visibility` column on `calendar_events`
- [x] **API endpoint** — Unit 3: `GET /api/events/upcoming` (public, no auth)
- [x] **Event form visibility** — Unit 4: visibility select field
- [x] **Channel card** — Unit 5: `channel-card.tsx` + CSS
- [x] **What's On section** — Unit 6: `whats-on.tsx` + CSS
- [x] **Event card** — Unit 7: `event-card.tsx` + CSS
- [x] **Coming Up section** — Unit 8: `coming-up.tsx` + CSS
- [x] **Fresh Drops layout** — Unit 9: `recent-content.tsx` hero slot + grid
- [x] **ContentCard CQ** — Unit 10: `@container (min-width: 500px)` horizontal variant
- [x] **Landing page wiring** — Unit 11: loader + section order
- [x] **Section voice pass** — Unit 12: "Fresh Drops", "Creators"

## Review outcome (2026-04-20)

Signed off against the live dev environment — all 12 top-level tasks verified: migration applied (`0020_far_bulldozer.sql`), API endpoint responding, all four landing components mounted and rendering, ContentCard container query active, section voice applied, 8 unit test files under `tests/unit/components/landing/`.

**Fix in-flight:** Unit 4's acceptance criterion *"Switching event type to 'show' auto-sets visibility to 'public'"* was not actually met — the `visibility` state was set via a `useState` initializer that only runs once on mount, so changing `eventType` to `"show"` after mount didn't re-derive visibility. A `useEffect` synced to `eventType` now flips visibility to `"public"` whenever event type becomes `"show"` on a new event (edit mode preserves the saved visibility). Surfaced because the acceptance smoke-test event was saved with `visibility: "internal"` despite being a `show` type and so didn't appear on the landing page's Coming Up section. See [event-form.tsx:193-200](../../apps/web/src/components/calendar/event-form.tsx#L193-L200).

**Also parked from acceptance session** (observations beyond this feature's scope):
- [event-location-map-link](../../backlog/event-location-map-link.md) — make event card location tap-to-map
- [live-page-player-hover-controls-escape-at-narrow-width](../../backlog/live-page-player-hover-controls-escape-at-narrow-width.md) — player hover controls break out of container at certain widths (related to the earlier-parked global-player layout item)

---

## Overview

Transforms the S/NC landing page from a static brochure into a living media hub. Adds "What's On" channel strip (streaming status), "Coming Up" public events, "Fresh Drops" hero+grid content layout, ContentCard container query adaptation, and section voice pass. Requires a calendar schema migration (visibility column) and a new public API endpoint.

---

## Implementation Units

### Unit 1: Calendar Event Visibility — Shared Types

**File**: `packages/shared/src/calendar.ts`

Add visibility enum and schema additions:

```typescript
// Add after DEFAULT_EVENT_TYPE_LABELS

export const EVENT_VISIBILITY = ["public", "internal"] as const;
export type EventVisibility = (typeof EVENT_VISIBILITY)[number];
export const EventVisibilitySchema = z.enum(EVENT_VISIBILITY);
```

Add `visibility` field to `CalendarEventSchema`:

```typescript
export const CalendarEventSchema = z.object({
  // ... existing fields ...
  visibility: EventVisibilitySchema,
  // ... rest ...
});
```

Add `visibility` to `CreateCalendarEventSchema` with default:

```typescript
export const CreateCalendarEventSchema = z.object({
  // ... existing fields ...
  visibility: EventVisibilitySchema.default("internal"),
});
```

Add `visibility` to `UpdateCalendarEventSchema` as optional:

```typescript
export const UpdateCalendarEventSchema = z.object({
  // ... existing fields ...
  visibility: EventVisibilitySchema.optional(),
});
```

Add a public-safe upcoming event schema (subset of `CalendarEvent` — excludes `createdBy`, `projectId`, `projectName`, `completedAt`, `deletedAt`):

```typescript
export const UpcomingEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime().nullable(),
  allDay: z.boolean(),
  eventType: z.string(),
  location: z.string(),
  creatorId: z.string().nullable(),
  creatorName: z.string().nullable(),
});

export const UpcomingEventsResponseSchema = z.object({
  items: z.array(UpcomingEventSchema),
});

export type UpcomingEvent = z.infer<typeof UpcomingEventSchema>;
export type UpcomingEventsResponse = z.infer<typeof UpcomingEventsResponseSchema>;
```

**Implementation Notes**:

- `CalendarEventsQuerySchema` does NOT need a `visibility` filter — the internal calendar view shows all events regardless of visibility. Only the public endpoint filters by visibility.
- The `toEventResponse` helper in `apps/api/src/lib/calendar-helpers.ts` needs to include the new `visibility` field in its return object.

**Acceptance Criteria**:

- [x] `EventVisibility` type and `EventVisibilitySchema` exported
- [x] `CalendarEventSchema` includes `visibility`
- [x] `CreateCalendarEventSchema` includes `visibility` with `"internal"` default
- [x] `UpdateCalendarEventSchema` includes optional `visibility`
- [x] `UpcomingEventSchema` and `UpcomingEventsResponseSchema` exported
- [x] `toEventResponse` includes `visibility` in output

---

### Unit 2: Calendar Event Visibility — DB Schema + Migration

**File**: `apps/api/src/db/schema/calendar.schema.ts`

Add `visibility` column to `calendarEvents` table:

```typescript
visibility: text("visibility").notNull().default("internal"),
```

Add after the `location` column.

**Migration**: Run `bun run --filter @snc/api db:generate` to generate a Drizzle migration, then `bun run --filter @snc/api db:migrate` to apply it. All existing events default to `"internal"` — non-breaking.

**Acceptance Criteria**:

- [x] `visibility` column exists on `calendar_events` table
- [x] Existing events default to `"internal"`
- [x] Migration generated and applied

---

### Unit 3: Public Upcoming Events Endpoint

**File**: `apps/api/src/routes/upcoming-events.routes.ts` *(new)*

```typescript
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { and, gt, eq, isNull, asc } from "drizzle-orm";
import { z } from "zod";

import { UpcomingEventsResponseSchema } from "@snc/shared";

import { db } from "../db/connection.js";
import { calendarEvents } from "../db/schema/calendar.schema.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { toISO, toISOOrNull } from "../lib/response-helpers.js";

const UpcomingEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

/** Public upcoming events for the landing page. No auth required. */
const upcomingEventsRoutes = new Hono();

upcomingEventsRoutes.get(
  "/",
  describeRoute({
    description: "List upcoming public events (no auth required)",
    tags: ["events"],
    responses: {
      200: {
        description: "Upcoming public events",
        content: {
          "application/json": { schema: resolver(UpcomingEventsResponseSchema) },
        },
      },
    },
  }),
  validator("query", UpcomingEventsQuerySchema),
  async (c) => {
    const { limit } = c.req.valid("query" as never) as { limit: number };

    const rows = await db
      .select({
        event: calendarEvents,
        creatorName: creatorProfiles.displayName,
      })
      .from(calendarEvents)
      .leftJoin(creatorProfiles, eq(calendarEvents.creatorId, creatorProfiles.id))
      .where(
        and(
          eq(calendarEvents.visibility, "public"),
          gt(calendarEvents.startAt, new Date()),
          isNull(calendarEvents.deletedAt),
        ),
      )
      .orderBy(asc(calendarEvents.startAt))
      .limit(limit);

    const items = rows.map(({ event: row, creatorName }) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      startAt: toISO(row.startAt),
      endAt: toISOOrNull(row.endAt),
      allDay: row.allDay,
      eventType: row.eventType,
      location: row.location,
      creatorId: row.creatorId ?? null,
      creatorName: creatorName ?? null,
    }));

    return c.json({ items });
  },
);

export { upcomingEventsRoutes };
```

**File**: `apps/api/src/app.ts` — mount the new route

```typescript
import { upcomingEventsRoutes } from "./routes/upcoming-events.routes.js";
// ...
app.route("/api/events/upcoming", upcomingEventsRoutes);
```

**Acceptance Criteria**:

- [x] `GET /api/events/upcoming` returns upcoming public events without auth
- [x] Only `visibility: "public"` events returned
- [x] Only future events returned (startAt > now)
- [x] Deleted events excluded
- [x] Ordered by `startAt ASC`
- [x] `limit` query param works (default 5, max 20)
- [x] Mounted in `app.ts`

---

### Unit 4: Event Form — Visibility Field

**File**: `apps/web/src/components/calendar/event-form.tsx`

Add state:

```typescript
const [visibility, setVisibility] = useState<string>(
  event?.visibility ?? (eventType === "show" ? "public" : "internal"),
);
```

Add to form submission payload (both create and update paths):

```typescript
visibility,
```

Add a form field after the event type selector:

```tsx
<div className={formStyles.field}>
  <label className={formStyles.label} htmlFor="visibility">
    Visibility
  </label>
  <select
    id="visibility"
    className={formStyles.select}
    value={visibility}
    onChange={(e) => setVisibility(e.target.value)}
  >
    <option value="internal">Internal</option>
    <option value="public">Public</option>
  </select>
</div>
```

Add an effect to auto-switch visibility when event type changes to "show":

```typescript
useEffect(() => {
  if (eventType === "show") {
    setVisibility("public");
  }
}, [eventType]);
```

**Acceptance Criteria**:

- [x] Visibility select field appears in event form
- [x] Default is `"internal"` for non-show types, `"public"` for shows
- [x] Switching event type to "show" auto-sets visibility to "public"
- [x] Visibility included in create and update API payloads

---

### Unit 5: Channel Card Component

**File**: `apps/web/src/components/landing/channel-card.tsx` *(new)*
**File**: `apps/web/src/components/landing/channel-card.module.css` *(new)*

Channel card renders: channel name, now-playing info for playout, LIVE badge + viewer count for live streams. Cards link to `/live`. `prefers-reduced-motion` disables the pulse animation on the live indicator dot.

Card sizing (200-280px, flex 0 0 auto) matches the existing `featured-creators` scroll item pattern.

**Acceptance Criteria**:

- [x] `ChannelCard` renders channel name, now-playing info, and badges
- [x] Live channels show red border + LIVE badge + pulsing dot + viewer count
- [x] Playout channels show "NOW PLAYING" badge + track title
- [x] Cards link to `/live`
- [x] `prefers-reduced-motion` disables pulse animation *(skip-with-note 2026-04-20: CSS inspection confirms `@media (prefers-reduced-motion: reduce) { animation: none }` is present at [channel-card.module.css:73-75](../../apps/web/src/components/landing/channel-card.module.css#L73-L75); live visual verification deferred — requires an active live channel + DevTools emulation of the media query)*

---

### Unit 6: "What's On" Section

**File**: `apps/web/src/components/landing/whats-on.tsx` *(new)*
**File**: `apps/web/src/components/landing/whats-on.module.css` *(new)*

Horizontal scrollable strip of `ChannelCard` components. The scroll strip pattern matches `featured-creators.module.css` exactly — same scrollbar styles, same snap behavior. `Radio` icon (lucide-react) for the empty state.

Note: the "live hero takeover" (a live channel promoting to hero position) is deferred — the channel strip with red border + LIVE badge provides sufficient visual priority for the initial implementation.

**Acceptance Criteria**:

- [x] Channel strip renders all channels in a horizontal scrollable row
- [x] Empty state shown when no channels active
- [x] Scroll snap behavior matches featured creators pattern
- [x] Keyboard-accessible via `tabIndex={0}` and `role="region"`

---

### Unit 7: Event Card Component

**File**: `apps/web/src/components/landing/event-card.tsx` *(new)*
**File**: `apps/web/src/components/landing/event-card.module.css` *(new)*

Event card renders: date badge (month + day), title, event type tag, location (when present), creator name (when present), disabled "Remind Me" bell button. The disabled button slot exists in the DOM for future notification wiring without component changes.

**Acceptance Criteria**:

- [x] Event card shows date badge (month + day), title, type tag, location, creator
- [x] "Remind Me" button renders disabled with bell icon
- [x] Known event types show human-readable labels, custom types show raw string
- [x] Location only shown when present

---

### Unit 8: "Coming Up" Section

**File**: `apps/web/src/components/landing/coming-up.tsx` *(new)*
**File**: `apps/web/src/components/landing/coming-up.module.css` *(new)*

Vertical list of `EventCard` components. `Calendar` icon (lucide-react) for the empty state.

**Acceptance Criteria**:

- [x] Event list renders vertically
- [x] Empty state when no events

---

### Unit 9: "Fresh Drops" — Hero + Grid Layout

**File**: `apps/web/src/components/landing/recent-content.tsx`

Restructure to show the first item in a hero slot and remaining items in the grid:

```tsx
<section className={sectionStyles.section}>
  <h2 className={sectionStyles.heading}>Fresh Drops</h2>
  {items.length > 0 && (
    <div className={styles.heroSlot}>
      <ContentCard item={items[0]!} />
    </div>
  )}
  {items.length > 1 && (
    <div className="content-grid">
      {items.slice(1).map((item) => (
        <ContentCard key={item.id} item={item} />
      ))}
    </div>
  )}
  <Link to="/feed" className={styles.viewAll}>
    View all content →
  </Link>
</section>
```

**File**: `apps/web/src/components/landing/recent-content.module.css`

```css
/* ── Hero Slot ── */

.heroSlot {
  container-type: inline-size;
  container-name: hero-card;
  margin-bottom: var(--space-lg);
}

/* ── View All Link ── */

.viewAll {
  display: inline-block;
  margin-top: var(--space-lg);
  font-family: var(--font-ui);
  font-size: var(--font-size-sm);
  color: var(--color-accent);
  text-decoration: none;
}

.viewAll:hover {
  color: var(--color-accent-hover);
  text-decoration: underline;
}
```

**Acceptance Criteria**:

- [x] First content item renders in `.heroSlot` (full width)
- [x] Remaining items render in the standard `content-grid`
- [x] Section heading is "Fresh Drops"
- [x] `.heroSlot` has `container-type: inline-size`

---

### Unit 10: ContentCard Container Query

**File**: `apps/web/src/components/content/content-card.module.css`

Add container query rules at the end of the file:

```css
/* ── Container Query: horizontal layout in wide containers ── */

@container (min-width: 500px) {
  .card {
    flex-direction: row;
  }

  .thumbnailWrapper {
    width: 45%;
    flex-shrink: 0;
  }

  .info {
    justify-content: center;
    padding: var(--space-md);
  }

  .title {
    font-size: var(--font-size-lg);
  }
}
```

The `@container` rule is unnamed — it responds to ANY ancestor with `container-type: inline-size`. In practice only `.heroSlot` is wide enough to trigger it; cards inside `.content-grid` cells are narrower than 500px.

**Acceptance Criteria**:

- [x] ContentCard switches to horizontal layout when container is ≥500px wide
- [x] Thumbnail takes 45% width in horizontal mode
- [x] Title font scales up in horizontal mode
- [x] Cards in `content-grid` cells remain vertical (cells are <500px)
- [x] Card in `.heroSlot` goes horizontal on tablets+

---

### Unit 11: Landing Page Composition

**File**: `apps/web/src/routes/index.tsx`

Update the landing data type, loader, and component.

New section order: Hero → What's On → Fresh Drops → Coming Up → Creators → Pricing.

Both new fetches have `.catch()` handlers matching the existing pattern — the landing page never fails because a subsystem is down.

```typescript
// In loader, add to Promise.all:
(
  fetchApiServer({
    data: "/api/streaming/status",
  }) as Promise<ChannelListResponse>
).catch((e: unknown) => {
  ssrLogger.warn({ error: e instanceof Error ? e.message : String(e) }, "Failed to load streaming status");
  return { channels: [], defaultChannelId: null } as ChannelListResponse;
}),
(
  fetchApiServer({
    data: "/api/events/upcoming?limit=5",
  }) as Promise<UpcomingEventsResponse>
)
  .then((r) => r.items)
  .catch((e: unknown) => {
    ssrLogger.warn({ error: e instanceof Error ? e.message : String(e) }, "Failed to load upcoming events");
    return [] as UpcomingEventsResponse["items"];
  }),
```

**Acceptance Criteria**:

- [x] Landing page loader fetches streaming status and upcoming events in parallel
- [x] Both new fetches have error fallbacks (empty data, warn log)
- [x] Section order: Hero → What's On → Fresh Drops → Coming Up → Creators → Pricing
- [x] Page renders without errors even if streaming/calendar APIs fail
- [x] `LandingData` type updated with new fields

---

### Unit 12: Section Voice Pass

| Component | Old heading | New heading |
|-----------|-----------|-----------|
| `recent-content.tsx` | "Recent Content" | "Fresh Drops" |
| `featured-creators.tsx` | "Featured Creators" | "Creators" |
| `whats-on.tsx` (new) | — | "What's On" |
| `coming-up.tsx` (new) | — | "Coming Up" |

The new components (Units 6, 8) already use the new headings. Only two existing components need changes.

**File**: `apps/web/src/components/landing/featured-creators.tsx` — change `<h2>` text and `aria-label`.

**Acceptance Criteria**:

- [x] "Recent Content" → "Fresh Drops"
- [x] "Featured Creators" → "Creators"
- [x] New sections use "What's On" and "Coming Up"
- [x] `aria-label` values match new headings

---

## Implementation Order

1. Unit 1: Shared types — `EventVisibility`, `UpcomingEvent` types (no dependencies)
2. Unit 2: DB migration — `visibility` column (depends on Unit 1 for types)
3. Unit 3: API endpoint — upcoming events route (depends on Units 1-2)
4. Unit 4: Event form — visibility field (depends on Unit 1)
5. Unit 5: Channel card — new component (no dependencies)
6. Unit 7: Event card — new component (depends on Unit 1 for types)
7. Unit 6: What's On section — (depends on Unit 5)
8. Unit 8: Coming Up section — (depends on Unit 7)
9. Unit 9: Fresh Drops — (no dependencies)
10. Unit 10: ContentCard CQ — CSS-only (no dependencies)
11. Unit 11: Landing page composition — (depends on Units 6, 8, 9)
12. Unit 12: Voice pass — (depends on Unit 11)

**Parallelization**: Units 5-10 are independent and can be implemented in parallel. Units 1-3 are sequential. Unit 4 is independent of 5-10.

---

## Testing

### API Tests: `apps/api/tests/routes/upcoming-events.test.ts` *(new)*

Key test cases:
- Returns only public events — insert public + internal events, verify only public returned
- Returns only future events — insert past + future events, verify only future returned
- Excludes deleted events — insert deleted event, verify excluded
- Ordered by startAt ASC — insert events out of order, verify chronological
- Respects limit — insert 10 events, request limit=3, verify 3 returned
- Default limit is 5 — insert 10 events, no limit param, verify 5 returned
- No auth required — request without auth headers, verify 200
- Includes creator name — event with creatorId, verify creatorName resolved
- Empty when no public events — verify `{ items: [] }` response

Follow the `hono-test-app-factory` pattern: build a minimal test app, mount the route, use `app.request()`.

### Component Tests: `apps/web/tests/unit/components/landing/`

- `channel-card.test.tsx`
- `event-card.test.tsx`
- `whats-on.test.tsx`
- `coming-up.test.tsx`
- `recent-content.test.tsx`

Follow the `vi-hoisted-module-mock` pattern for mocking `@tanstack/react-router` Link component.

### Shared Tests: `packages/shared/tests/calendar.test.ts`

Add tests for `UpcomingEventSchema` validation and `EventVisibilitySchema`.

---

## Verification Checklist

```bash
# Build shared (types changed)
bun run --filter @snc/shared build

# Generate + apply migration
bun run --filter @snc/api db:generate
bun run --filter @snc/api db:migrate

# Run all tests
bun run --filter @snc/shared test
bun run --filter @snc/api test:unit
bun run --filter @snc/web test

# Build web (CSS + component changes)
bun run --filter @snc/web build
```
