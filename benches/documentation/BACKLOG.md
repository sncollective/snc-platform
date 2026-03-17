# Platform Documentation — Backlog

> Gap analysis performed 2026-03-17. Ranked by impact.

## Priority 1: Zero Documentation

| # | Area | Code locations | What's needed |
|---|------|---------------|---------------|
| 1 | **Getting Started** | (cross-cutting) | Step-by-step onboarding guide: clone, setup, first run, first change. README covers structure but not a walkthrough. |
| 2 | **Federation (ActivityPub)** | `api: federation.routes.ts`, `shared: federation.ts`, `web: fediverse-address.tsx, follow-fediverse-dialog.tsx` | Federation model, supported ActivityPub activities, how creators federate, follow flow. |
| 3 | **Calendar System** | `api: calendar.routes.ts, calendar.schema.ts`, `shared: calendar.ts`, `web: event-card/form/list.tsx, feed-url-card.tsx` | Event model, iCal feed, CRUD operations, creator usage. |
| 4 | **Emissions Tracking** | `api: emissions.routes.ts, emission.schema.ts`, `shared: emissions.ts`, `web: emissions-chart.tsx, category-breakdown.tsx, scope-breakdown.tsx, co2-equivalencies.tsx, offset-impact.tsx` | How emissions are calculated, data sources (Claude + studio scripts), dashboard display, integration with root `scripts/track-*-carbon.py`. |
| 5 | **Admin System** | `api: admin.routes.ts`, `shared: admin.ts`, `web: user-role-manager.tsx, admin.tsx` | Available admin operations, role assignment workflow, who has access. |
| 6 | **OIDC / Auth Architecture** | `api: auth/auth.ts, auth/seed-oidc-clients.ts, db/schema/oidc.schema.ts` | Auth architecture overview, Better Auth setup, OIDC provider config, session model, role system. |
| 7 | **Feature Flags** | `shared: features.ts` | Available flags, how to add new ones, how they gate routes/UI. |
| 8 | **Email Service** | `api: email/send.ts` | Email templates, triggers (password reset, verification), transport configuration. |
| 9 | **Creator Teams** | `api: services/creator-team.ts`, `web: team-section.tsx` | Team model, permissions, invitation flow, management UI. |
| 10 | **Rate Limiting** | `api: middleware/rate-limit.ts` | Limits per route, configuration, behavior when exceeded. |

## Priority 2: Partial / Consolidation Needed

| # | Area | What exists | What's missing |
|---|------|------------|----------------|
| 11 | **Database Schema Reference** | 8 schema files across `db/schema/`, CLAUDE.md lists tables | Consolidated reference with relationships, indexes, constraints, migration history. |
| 12 | **Seeding Scripts** | `api: scripts/seed-admin.ts, seed-demo.ts` | How to seed demo data, what gets created, when to use each script. |

## Completed

*(Move items here as they're documented.)*

## Notes

- API endpoints have OpenAPI 3.1 auto-generated docs (served at `/api/docs`). These don't need manual documentation.
- Pattern docs in `.claude/skills/platform-patterns/` cover coding conventions well — 31 pattern files.
- Refactoring docs in `docs/refactor/` are archived analysis, not user-facing docs.
