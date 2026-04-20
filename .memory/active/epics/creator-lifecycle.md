---
id: epic-creator-lifecycle
kind: epic
stage: done
tags: [creators]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# Creator Lifecycle — Scoping Brief

## Status Model

Single `status` enum column on `creator_profiles`: `active | inactive | archived`.

- **active** — publicly visible, listed in feeds and search
- **inactive** — unlisted, completely invisible to public (pre-launch or temporarily hidden)
- **archived** — retired, invisible to public, with side effects on content pools

Default `active` for backward compatibility with existing rows.

### Why one field, not two

Considered `isActive` boolean + `archivedAt` timestamp, but rejected: introduces an impossible state (`isActive = true` with `archivedAt` set) requiring defensive guards. Single enum avoids this and matches existing patterns (`playoutQueue.status`, `userSubscriptions.status`).

### Semantic distinction: inactive vs archived

Both are hidden from public. The difference is operational:
- **inactive** — no side effects. Toggle freely. Used for creators not yet launched or temporarily unlisted.
- **archived** — triggers content pool cleanup. Heavier action. Used when a creator's run is done.

## Creator Creation

Move to admin-only. Currently `POST /api/creators` requires `stakeholder` or `admin` role. Change to `admin` only. Admin creates new creators as `inactive` by default.

## Archive Side Effects

When a creator is archived:
- Remove their items from `channel_content` (content pool associations)
- Content rows themselves are preserved (not deleted)
- Items can be manually re-added to pools if the creator is restored

## Public Query Filtering

All public-facing queries must filter to `status = 'active'`:
- `GET /api/creators` (creator listing with KPIs)
- `GET /api/creators/:creatorId` (creator detail by ID or handle)
- `findCreatorProfile()` helper
- Batch KPI helpers: `batchGetContentCounts()`, `batchGetSubscriberCounts()`, `batchGetLastPublished()`
- Content feeds that join on creator

## Admin CRUD

Extend admin routes with creator management:
- **List creators** — all statuses, filterable, cursor-paginated (existing pattern from `GET /api/admin/users`)
- **Create creator** — as `inactive`, generates handle from display name
- **Edit creator** — update display name, bio, avatar, banner, social links
- **Change status** — `inactive <-> active`, `active -> archived`, `archived -> active` (with re-activation)
- **No hard deletes** — archive is the most destructive action available

### Existing admin patterns to follow
- `requireAuth` + `requireRole("admin")` middleware
- Cursor-based pagination via `buildCursorCondition()` / `buildPaginatedResponse()`
- `resolveAndAudit()` for audit logging
- Structured logging with event type, actor ID, target ID
- Row-to-response transformer functions

## Key Files

| Area | File |
|------|------|
| Schema | `apps/api/src/db/schema/creator.schema.ts` |
| Admin API | `apps/api/src/routes/admin.routes.ts` |
| Creator API | `apps/api/src/routes/creator.routes.ts` |
| Creator list service | `apps/api/src/services/creator-list.ts` |
| Creator helpers | `apps/api/src/lib/creator-helpers.ts` |
| Shared types | `packages/shared/src/creator.ts` |
| Admin UI (creators) | `apps/web/src/routes/admin/creators.tsx` |
| Playout orchestrator | `apps/api/src/services/playout-orchestrator.ts` |
| Channel content schema | `apps/api/src/db/schema/playout.schema.ts` |

## Child

Implementation: [creator-lifecycle-status-and-admin-crud](../features/creator-lifecycle-status-and-admin-crud.md) — landed 2026-04-02.
