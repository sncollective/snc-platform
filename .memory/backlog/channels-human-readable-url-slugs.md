---
tags: [streaming, ux-polish, schema]
created: 2026-04-23
---

Channels are currently identified in URLs by their GUID `id`. The platform `human-readable-url-slug` pattern — used for creators (prefer `handle ?? id`; backend dual-mode resolver accepts both) — has not been adopted for channels. The `channels` table has no `slug` or `handle` column.

Surfaced 2026-04-23 during scope of `mini-player-go-to-content-loses-channel`, where GUID URLs were acceptable for a transient expand flow but clearly wrong for any future sharable channel URL (deep-link, SEO, admin, embed).

## Scope to size at /scope time

- Add `slug` (or `handle`) column to `channels` table — uniqueness constraint, nullable initially for backfill?
- Backfill strategy — slugify `name`, collision-resolve with suffix, admin-editable after?
- `srsStreamName` is already unique and human-readable — consider whether it IS the slug rather than a separate column, or whether the two concerns should stay separated (SRS-internal vs user-facing).
- Backend dual-mode resolver (accept slug OR id) on channel lookup routes.
- Frontend URL generation updated to prefer slug (`/live?channel=<slug>` over `/live?channel=<uuid>`).
- Admin UI for editing channel slug post-creation.

## Why parked

Schema change with backfill, user-facing URL change — not a quick-win. Fits better in a post-0.3.0 release when it can be sized and designed properly against all channel URL surfaces (mini-player expand, direct channel page, admin console, embed code if any).
