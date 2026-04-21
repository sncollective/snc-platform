---
id: feature-refactor-pattern-compliance-sweep
kind: feature
stage: implementing
tags: [refactor, quality]
release_binding: null
created: 2026-04-20
updated: 2026-04-20
related_decisions: []
related_designs: []
parent: null
---

A cluster of pattern-drift sites across the API and web app each deviate from an established project convention in an isolated, well-understood way. None warrants a standalone story, but together they represent accumulated drift that makes the codebase harder to read consistently. Fixing them as a batch clears the drift without the overhead of tracking each independently.

## Scope

Heterogeneous one-off pattern violations across `apps/api/` and `apps/web/`. Each task is a distinct file and fix.

## Tasks

- [ ] `apps/api/src/routes/simulcast.routes.ts:40,63,88,110` — 4 manual error JSON responses using `as 500`/`as 404` casts instead of `throw result.error`; every other route uses the `errorHandler` middleware — replace all 4 with `if (!result.ok) throw result.error`
- [ ] `apps/api/src/services/playout.ts:60` — `listPlayoutItems` returns `Promise<PlayoutItem[]>` instead of `Result`; inconsistent with sibling services — convert to `Result` return type
- [ ] `apps/api/src/scripts/seed-admin.ts:1` — uses `console.error`/`console.log` instead of `rootLogger`; inconsistent with `seed-channels.ts` — replace with `rootLogger`
- [ ] `apps/api/src/routes/federation.routes.ts` — uses `createRequire` to read `package.json` version; unconventional in an ESM codebase — replace with JSON import using `with { type: "json" }`
- [ ] `apps/api/src/routes/calendar.routes.ts:318` (or `creator-events.routes.ts:318`) — PATCH handler builds a `Record<string, unknown>` update object field-by-field instead of a typed spread — use `Partial<typeof calendarEvents.$inferInsert>` or spread the validated body directly
- [ ] `apps/api/src/routes/content-loader.ts:40-44,51` — `as` casts on `fetchApiServer` response plus a `role as "owner" | "editor" | "viewer"` assertion; relates to the loader return-type casts backlog item — remove or tighten the casts
- [ ] `apps/web/src/routes/admin/simulcast.tsx:159,182` — error divs use `errorStyles.errorAlert` instead of `errorStyles.error` and are missing `role="alert"`; align with the pattern used in other routes

## Notes

The `simulcast.routes.ts` pattern-compliance fix was marked done on the board (`[x]`) for `admin/simulcast.tsx:159,182` as well — verify current state of both files before treating those tasks as open. The `content-loader.ts` casts task explicitly relates to a broader backlog item on loader return-type casts; fix the immediate `as` casts here and note the broader pattern as still open. The calendar PATCH route may live in `creator-events.routes.ts` rather than `calendar.routes.ts` — verify the file name before editing.
