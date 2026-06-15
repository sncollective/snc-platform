---
id: refactor-pattern-compliance-sweep
kind: feature
stage: review
tags: [refactor, quality]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-04-20
updated: 2026-06-15
parent: null
---

A cluster of pattern-drift sites across the API and web app each deviate from an established project convention in an isolated, well-understood way. None warrants a standalone story, but together they represent accumulated drift that makes the codebase harder to read consistently. Fixing them as a batch clears the drift without the overhead of tracking each independently.

## Scope

Heterogeneous one-off pattern violations across `apps/api/` and `apps/web/`. Each task is a distinct file and fix.

## Tasks

- [x] `apps/api/src/routes/simulcast.routes.ts` — DROPPED (already done): all four handlers already use `if (!result.ok) throw result.error`; no `as 500`/`as 404` casts remain.
- [x] `apps/api/src/services/playout.ts` — `listPlayoutItems` converted to `Promise<Result<PlayoutItem[], AppError>>`; sole caller `playout.routes.ts:55` + tests updated.
- [x] `apps/api/src/scripts/seed-admin.ts` — `console.*` replaced with `rootLogger`, matching `seed-channels.ts`.
- [x] `apps/api/src/routes/federation.routes.ts` — `createRequire` replaced with `import pkg from "../../package.json" with { type: "json" }`.
- [x] `apps/api/src/routes/calendar.routes.ts:318` AND `creator-events.routes.ts:280` — PATCH `updates` retyped `Record<string, unknown>` → `Partial<typeof calendarEvents.$inferInsert>` (field-by-field copy KEPT — the `string → Date` coercion is load-bearing).
- [x] `apps/web/src/lib/content-loader.ts` (moved from `apps/api`) — two `fetchApiServer` casts tightened to declared annotations; role assertion narrowed to canonical `CreatorMemberRole`. Broader loader-cast backlog item stays open.
- [x] `apps/web/src/routes/admin/simulcast.tsx` — DROPPED (already done): error rendering moved to `<SimulcastDestinationManager>` which uses `errorStyles.error` + `role="alert"`; zero `errorAlert` refs remain.

## Notes

The `simulcast.routes.ts` pattern-compliance fix was marked done on the board (`[x]`) for `admin/simulcast.tsx:159,182` as well — verify current state of both files before treating those tasks as open. The `content-loader.ts` casts task explicitly relates to a broader backlog item on loader return-type casts; fix the immediate `as` casts here and note the broader pattern as still open. The calendar PATCH route may live in `creator-events.routes.ts` rather than `calendar.routes.ts` — verify the file name before editing.

## Implementation (2026-06-15)

Behavior-preserving sweep. Re-grounded every file/line reference against current code first; the 2026-04-20 line numbers had drifted and two file paths were wrong (corrected below).

### Done (5 tasks)

1. **`apps/api/src/scripts/seed-admin.ts` — logger swap.** Added `import { rootLogger } from "../logging/logger.js";` and replaced all 7 `console.error`/`console.log` calls (lines had drifted from the item's `:1` to 10,11,18,33,34,45,47) with `rootLogger.error(...)` / `rootLogger.info(...)`, matching sibling `seed-channels.ts`. All `process.exit(1)` exit-code contracts kept; logger is module-level (no side-effect reordering vs the bare argv check). Observable-text-only change to a CLI `[script]` — no API surface.

2. **`apps/api/src/routes/federation.routes.ts` — createRequire → JSON import.** Removed `import { createRequire } from "node:module"` and the `const require = createRequire(...); const { version: VERSION } = require("../../package.json")` pair; replaced with `import pkg from "../../package.json" with { type: "json" }` + `const VERSION = pkg.version`. Same `0.2.0` value flows to the same NodeInfo `version` field — black-box identical. Verified the import attribute resolves both under vitest (federation route test 7/7) and native node24 (`import ... with { type: "json" }` returns `version = 0.2.0`).

3. **Calendar PATCH update object — type tightening (BOTH sites).** The item's `(or creator-events.routes.ts:318)` was an OR; in current code these are two distinct PATCH handlers with the same pattern. Both in scope (same fix, same convention): `apps/api/src/routes/calendar.routes.ts:318` and `apps/api/src/routes/creator-events.routes.ts:280`. Retyped `const updates: Record<string, unknown>` → `Partial<typeof calendarEvents.$inferInsert>`. KEPT the field-by-field conditional copy — the `startAt`/`endAt` `string → Date` coercion (and the `endAt` null branch) is load-bearing; a blind body-spread would be behavior-CHANGING. Pure type-annotation change, zero runtime delta.

4. **`apps/web/src/lib/content-loader.ts` — cast tightening (immediate casts only).** File had MOVED (item said `apps/api`; it is `apps/web/src/lib/`). Tightened all three: (a) `fetchLockedContentPlans` plans response now annotated `const data: { plans: SubscriptionPlan[] } = await fetchApiServer(...)` instead of a trailing `as`; (b) the members response now flows into the declared `membersRes` annotation rather than a trailing `as`; (c) the role assertion narrowed from the duplicated inline literal union to the canonical exported `CreatorMemberRole` type (no validation introduced — staying strictly behavior-preserving; a `.parse()` would change the unexpected-role error path). All three are compile-time-only. Per item Notes, the broader loader-return-type-casts backlog item stays open.

5. **`apps/api/src/services/playout.ts` — `listPlayoutItems` → Result.** Converted return type to `Promise<Result<PlayoutItem[], AppError>>` (`return ok(...)`). Sole production caller `apps/api/src/routes/playout.routes.ts:55` updated to unwrap (`if (!result.ok) throw result.error; return c.json({ items: result.value })`). Updated 3 service-test sites in `tests/services/playout.test.ts` and the route mock in `tests/routes/playout.routes.test.ts`. Behavior-preserving at the HTTP surface: the function has no domain-error branch (a db rejection still bubbles to `errorHandler` → 500 either way), and no caller depended on throw-vs-Result, so it passes the black-box test. This is the weakest of the five (consistency churn with no error semantics modeled) — flagged for the reviewer.

### Dropped (2 tasks — already done in current code)

- **`simulcast.routes.ts` 4 manual error responses** — already uses `if (!result.ok) throw result.error` in all four handlers; no `as 500`/`as 404` casts remain. (Item's own Notes flagged this as marked-done; confirmed against current code.)
- **`admin/simulcast.tsx:159,182` error divs** — error rendering moved out of `admin/simulcast.tsx` (now delegates to `<SimulcastDestinationManager>`), which already uses `className={errorStyles.error}` with `role="alert"`. Zero `errorAlert` references remain in `apps/web/src`.

### Verification

- `bun run --filter @snc/api test:unit` — **1610 passed** (baseline 1610, unchanged). `(cd apps/api && bunx tsc --noEmit)` — clean (exit 0).
- `bun run --filter @snc/web test` — **1737 passed** (baseline 1737, unchanged). `(cd apps/web && bunx tsc --noEmit)` — 81 pre-existing errors (all from the un-generated TanStack route tree in the fresh worktree; zero in `content-loader.ts`, zero new vs baseline).
