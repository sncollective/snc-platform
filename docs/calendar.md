# Cooperative Calendar

The calendar provides Stakeholders with a shared scheduling surface for cooperative activities -- recording sessions, shows, meetings, and tasks. Events can be personal (platform-level), scoped to a creator, or scoped to a project. Two views are available: a month grid showing events in day cells with multi-day span bars, and a chronological timeline with cursor-based pagination. An iCal feed lets Stakeholders sync events to external calendar apps via a token-authenticated `.ics` endpoint.

## How It Works

### Views

**Month grid** (`CalendarGrid`) renders a standard 7-column calendar. Single-day events appear as pills inside day cells (max 3 visible, adjusted downward when multi-day span bars occupy lanes). An overflow button expands to show all events for that day. Multi-day events render as horizontal span bars across day cells, with lane assignment to avoid vertical overlap when events share a week row. Clicking an event pill or span bar triggers the edit flow.

**Timeline** (`TimelineView`) fetches events from today forward using `useCursorPagination` with a limit of 50 per page. Events are grouped by date via `groupEventsByDate` and rendered through `EventList` / `EventCard`. Load-more pagination fetches the next cursor page.

A `ViewToggle` component switches between `"month"` and `"timeline"` modes. The `useCalendarState` hook manages all shared state: events, filters, month navigation, view mode, and form visibility. When the view is `"month"`, events are fetched for the visible month range. When `"timeline"`, the hook defers fetching to `TimelineView`'s own pagination.

### Event Types

Five default types are defined in `DEFAULT_EVENT_TYPE_LABELS` (`@snc/shared`):

| Slug | Label |
|------|-------|
| `recording-session` | Recording Session |
| `show` | Show |
| `meeting` | Meeting |
| `task` | Task |
| `other` | Other |

Custom event types can be created via `POST /api/calendar/event-types`. Custom slugs are derived from the label (lowercased, hyphenated, stripped of non-alphanumeric characters). The `GET /event-types` endpoint merges defaults with custom types, filtering out defaults whose slug has been overridden by a custom type. The "Other" type always sorts last.

In the event form, selecting "Other" reveals a free-text input for a custom label. If the entered label does not match an existing type slug, a "Save as default type" checkbox appears, which persists the custom type via the API.

### Event Scoping

Events support three scopes:

- **Personal** -- `creatorId` and `projectId` are both null. Created through the main calendar page via `POST /api/calendar/events`.
- **Creator-scoped** -- `creatorId` is set. Created through creator-specific endpoints (`POST /api/creators/:creatorId/events`). The `useCalendarState` hook accepts a `creatorId` option that routes all fetches and mutations through creator-scoped API paths. See [creators.md](creators.md) for the creator entity model.
- **Project-scoped** -- `projectId` is set (optional on any event). The form loads available projects filtered by the effective creator (if any), excluding completed projects. Project names are resolved via a left join at query time and included in responses as `projectName`.

### Filters

The `useCalendarState` hook exposes three filter dimensions, each producing a query parameter on the events endpoint:

- **Event type** (`eventType`) -- dropdown populated from `GET /api/calendar/event-types`; falls back to `DEFAULT_EVENT_TYPE_LABELS` on error.
- **Creator** (`creatorId`) -- dropdown populated from `GET /api/creators`; only shown when `includeCreatorFilter` is true (main calendar page). Changing the creator filter resets the project filter.
- **Project** (`projectId`) -- dropdown populated from `GET /api/projects`, re-fetched when creator filter changes to show only that creator's projects.

All filters are optional. The API applies them as additive `WHERE` conditions.

### Task Completion

Events with `eventType === "task"` support a completion toggle. The `PATCH /events/:id/complete` endpoint flips `completedAt` between null and the current timestamp. It rejects non-task events with a 400 error (`INVALID_EVENT_TYPE`). The `EventCard` component renders a checkbox for task events, with an aria-label reflecting the current state. Completed tasks receive a visual `taskCompleted` CSS class.

### iCal Feed

Stakeholders can generate a personal feed token via `POST /api/calendar/feed-token`. This replaces any existing token for the user (one token per user). The token is a UUID stored in `calendar_feed_tokens`.

The feed URL follows the pattern: `{baseUrl}/api/calendar/feed.ics?token={uuid}`

`GET /feed.ics` is **unauthenticated** -- it validates the token directly against the database. The feed returns events from 1 month ago to 6 months ahead, formatted as iCal using the `ical-generator` library. Task events use `TENTATIVE` status when incomplete and `CONFIRMED` when completed. Creator names are appended to event summaries in parentheses when present.

The `FeedUrlCard` component manages token generation and displays the URL with a copy-to-clipboard button. Regenerating the token invalidates the previous URL.

## Routes

All calendar routes require authentication and the Stakeholder role, except `GET /feed.ics` which uses token-based authentication.

### Calendar Events (`calendar.routes.ts`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/calendar/events` | List events with optional `from`, `to`, `eventType`, `projectId`, `creatorId` filters. Cursor-paginated (default 50, max 100). |
| `GET` | `/api/calendar/events/:id` | Get a single event by ID. |
| `POST` | `/api/calendar/events` | Create an event. Sets `createdBy` from session; `creatorId` is always null (use creator-scoped routes for creator events). |
| `PATCH` | `/api/calendar/events/:id` | Partial update. Only provided fields are changed. |
| `DELETE` | `/api/calendar/events/:id` | Soft-delete (sets `deletedAt`). |
| `PATCH` | `/api/calendar/events/:id/complete` | Toggle task completion. Returns 400 if `eventType !== "task"`. |

### Event Types (`calendar-event-types.routes.ts`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/calendar/event-types` | List all event types (defaults merged with custom). Custom types override defaults with the same slug. |
| `POST` | `/api/calendar/event-types` | Create a custom event type. Slug is auto-derived from label. Returns 409 if slug conflicts with a default or existing custom type. |

### iCal Feed (`calendar-feed.routes.ts`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/calendar/feed-token` | Generate a new feed token (deletes existing). Returns `{ token, url }`. |
| `GET` | `/api/calendar/feed-token` | Get the current user's feed token and URL. Returns 404 if none exists. |
| `GET` | `/api/calendar/feed.ics` | Public iCal feed. Requires `?token=` query param. Returns `text/calendar` with 1-month-back to 6-month-forward window. |

### Creator-Scoped Events (client-side routing)

The client library (`apps/web/src/lib/calendar.ts`) provides creator-scoped wrappers that hit `/api/creators/:creatorId/events` and `/api/creators/:creatorId/events/:eventId`. These are defined in the creator routes, not the calendar routes. See [creators.md](creators.md).

## Schema

Source: `apps/api/src/db/schema/calendar.schema.ts`

### `calendar_events`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `text` | PK |
| `title` | `text` | NOT NULL |
| `description` | `text` | NOT NULL, default `""` |
| `start_at` | `timestamptz` | NOT NULL |
| `end_at` | `timestamptz` | nullable |
| `all_day` | `boolean` | NOT NULL, default `false` |
| `event_type` | `text` | NOT NULL |
| `location` | `text` | NOT NULL, default `""` |
| `created_by` | `text` | NOT NULL, FK `users.id` CASCADE |
| `creator_id` | `text` | nullable, FK `creator_profiles.id` CASCADE |
| `project_id` | `text` | nullable, FK `projects.id` SET NULL |
| `deleted_at` | `timestamptz` | nullable (soft delete) |
| `completed_at` | `timestamptz` | nullable (task completion) |
| `created_at` | `timestamptz` | NOT NULL, default now |
| `updated_at` | `timestamptz` | NOT NULL, default now |

**Indexes:** `(start_at, deleted_at)`, `(event_type, deleted_at)`, `(created_by)`, `(creator_id, deleted_at)`, `(project_id, deleted_at)`. All listing queries filter on `deleted_at IS NULL`, so composite indexes with `deleted_at` support the primary access patterns.

### `calendar_feed_tokens`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `text` | PK |
| `user_id` | `text` | NOT NULL, FK `users.id` CASCADE |
| `token` | `text` | NOT NULL |
| `created_at` | `timestamptz` | NOT NULL, default now |

**Indexes:** unique index on `(token)`, index on `(user_id)`.

### `custom_event_types`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `text` | PK |
| `label` | `text` | NOT NULL |
| `slug` | `text` | NOT NULL |
| `created_by` | `text` | NOT NULL, FK `users.id` CASCADE |
| `created_at` | `timestamptz` | NOT NULL, default now |

**Indexes:** unique index on `(slug)`.

## Configuration

### Shared Constants (`packages/shared/src/calendar.ts`)

- `DEFAULT_EVENT_TYPES` -- readonly tuple of the 5 built-in event type slugs.
- `DEFAULT_EVENT_TYPE_LABELS` -- slug-to-label mapping for display.
- `MAX_EVENT_TITLE_LENGTH` -- 200 characters.
- `MAX_EVENT_DESCRIPTION_LENGTH` -- 5000 characters.
- `MAX_EVENT_LOCATION_LENGTH` -- 500 characters.

### Pagination

The `CalendarEventsQuerySchema` uses `createPaginationQuery({ max: 100, default: 50 })` for cursor-based pagination, sorted by `startAt` ascending.

### Access Control

All calendar and event-type endpoints require authentication (`requireAuth`) and the Stakeholder role (`requireRole("stakeholder")`). The iCal feed endpoint (`GET /feed.ics`) bypasses session auth and validates a per-user token instead. See [auth.md](auth.md) for the role hierarchy and middleware details.

## Key Decisions

- **Soft delete over hard delete.** Events set `deletedAt` rather than being removed, preserving audit history. All queries filter `deleted_at IS NULL`.
- **One feed token per user.** Generating a new token deletes the old one. This keeps the token table small and gives users a single revocation point.
- **Task completion is a toggle, not a status machine.** `completedAt` flips between null and a timestamp. Only events with `eventType === "task"` can be toggled; the API enforces this with a type check.
- **Custom event types are global, not per-user.** Any Stakeholder can create a custom type, and it appears for all Stakeholders. Slug uniqueness is enforced at the database level.
- **Creator association set at creation time via route choice.** The main calendar `POST /events` always sets `creatorId` to null. Creator-scoped events must be created through the creator routes. The form UI handles this by routing mutations through the appropriate client function based on whether a `creatorId` is present.
- **Month grid fetches on the hook; timeline fetches on its own.** The `useCalendarState` hook skips event fetching when `viewMode === "timeline"`, because `TimelineView` uses `useCursorPagination` independently with its own `from` date anchor.
- **Event type resolution uses slug matching.** When editing an event whose type is no longer in the known types list, the form falls back to "Other" and populates the custom label field from the slug.

## Gotchas

- **Date range overlap logic.** The `GET /events` query uses `startAt <= to AND (endAt >= from OR (endAt IS NULL AND startAt >= from))` to catch events that overlap the requested range. This means events without an `endAt` are only visible if their `startAt` falls within range.
- **Month grid event limit depends on span bars.** The `MAX_VISIBLE_EVENTS` constant (3) is reduced by the number of multi-day span bar lanes in each week row. A week with 2 span bar lanes only shows 1 single-day event pill before overflow.
- **Time picker snaps to 15-minute increments.** The `TimePickerSelect` component offers 00/15/30/45 minute options. When parsing an existing time, it rounds to the nearest 15-minute mark.
- **Feed window is fixed.** The `.ics` feed always returns events from 1 month back to 6 months ahead, regardless of the requesting user. There is no per-user or per-filter customization of the feed content.
- **SSR loader data is used once.** The `useCalendarState` hook tracks whether initial events came from the SSR loader via a ref. It skips the first client-side fetch only when `monthOffset === 0` and no filters are active, then clears the flag. Navigating away and back triggers a fresh client fetch.
- **Custom type slug collisions.** If a custom type label produces a slug matching a default type, the API returns a 409 conflict. The slug derivation strips non-alphanumeric characters, so labels like "Recording Session!" would collide with the built-in `recording-session`.
- **`project_id` FK uses SET NULL on delete.** If a project is deleted, events retain their data but lose the project association. This differs from `creator_id` which cascades (deleting a creator deletes their events).
