---
id: calendar-event-patch-drops-visibility
kind: story
stage: review
tags: [calendar]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-04-24
updated: 2026-06-18
parent: null
---

# Calendar event PATCH drops visibility

Prod triage 2026-04-24 (0.3.0 live). Creating a `show`-type calendar event for Animal Future and saving with `visibility: public` silently reverted to `internal` on reload.

Root cause: the PATCH handler at `apps/api/src/routes/creator-events.routes.ts` built its `updates` object field-by-field and was missing the `visibility` check. Zod accepts the field, the form submits it, but the handler dropped it before the DB write. On re-fetch, the column's `notNull().default("internal")` backfilled — looking like a "flip to internal."

Paired with the 0.3.0 client-side fix for the same form ("event-form no longer overwrites `visibility` to `public` for existing show-type events on edit" — per 0.3.0 changelog). That fix made the form send the right value; this one makes the server persist it.

## Scope

- [x] Add `if (data.visibility !== undefined) updates.visibility = data.visibility;` at `creator-events.routes.ts:290`.
- [x] Regression test asserts `.set()` receives `visibility: "public"` on PATCH (`tests/routes/creator-events.routes.test.ts`).
- [x] Fixture `makeMockCalendarEvent` aligned with schema (now includes `visibility`).
- [x] Unit tests pass (16/16 green locally).
- [ ] User acceptance: re-save the Animal Future show event as public in prod; visibility persists across reload.

## Risks

- Any events already saved with visibility mis-persisted to `internal` will stay that way until re-saved — no backfill is included. Count in prod likely small (only show-type events created/edited between 0.3.0 ship and this fix).

## Revisit if

- Additional calendar fields surface the same pattern (field accepted by Zod, missing from PATCH's per-field assignment). If a third instance appears, consider refactoring the PATCH handler to iterate the schema rather than hand-listing each field.

## Review (2026-06-12)

**Verdict**: Approve

**Blockers**: none
**Important**: none
**Nits**: none

**Notes**: Fast lane. Verification recorded green (16/16); spot-checked at review: the
visibility assignment is present at `creator-events.routes.ts:290`; full API unit suite
1501/1501 green in this review cycle.

**Hold — fix-verify loopback pending.** User acceptance unchecked: re-save the Animal
Future show event as public in prod and confirm visibility persists across reload. Story
stays at `stage: review` until confirmed.

## Review findings — BOUNCE (user fix-verify failed 2026-06-13)
**Repro (user)**: first save of a new show-type event with visibility=public reverts
to internal on reload; opening it again and re-saving public then sticks.

**Root cause (confirmed in code)**: the original fix patched only the PATCH handler
(`creator-events.routes.ts:290` — `if (data.visibility !== undefined) updates.visibility = ...`).
The **POST create path** at `creator-events.routes.ts:222-235` (`.insert().values({...})`)
**omits `visibility` entirely**, so a newly-created event falls to the column default
`internal` regardless of what the form sent. The second save works because it's a PATCH
(the path that was fixed). The story scoped PATCH-only and missed create.

**To fix**: add `visibility: data.visibility ?? "internal"` (or thread the submitted
value) into the POST `.values()` block; add a create-path regression test asserting the
insert receives `visibility: "public"` when submitted — mirror of the existing PATCH
regression test. Keep the PATCH fix.

## Fix (2026-06-18) — create path

Added `visibility: data.visibility` to the POST `.values()` block
(`creator-events.routes.ts`, in the `.insert(calendarEvents).values({...})`). No `?? "internal"`
fallback is needed: `CreateCalendarEventSchema.visibility` already carries `.default("internal")`
(`packages/shared/src/calendar.ts:68`), so `data.visibility` is always a defined enum value on the
create path — threading it straight through mirrors how the handler already passes the other
defaulted fields (`allDay`, `description`, `location`). The PATCH fix is unchanged.

**Regression test** (`creator-events.routes.test.ts`, POST describe block): "persists submitted
visibility on create (not the column default)" — submits `visibility: "public"` on POST and
asserts `mockInsertValues` was called with `expect.objectContaining({ visibility: "public" })`.
Mirror of the existing PATCH `persists visibility change` test.

**Verification**:
- New test **proven to catch the bug**: stashed the fix → the test fails (insert called without
  `visibility`); restored → passes.
- Full API unit suite green: **1763 passed** (was 1762; +1 new test).
- `tsc --noEmit` on `@snc/api` clean (exit 0).

- [x] POST create path persists submitted `visibility` (was the bounce root cause).
- [x] Create-path regression test added + proven to fail without the fix.
- [x] Full API unit suite + typecheck green.
- [ ] **User acceptance (fix-verify loopback)**: create a *new* show-type event for Animal Future
  with visibility=public, save, reload — confirm it stays public on first save (no second-save
  workaround needed).

## Review (2026-06-18) — post-bounce

**Verdict**: Approve

**Blockers**: none
**Important**: none
**Nits**: none

**Notes**: Fast lane. The 2026-06-13 bounce root cause (POST create path omitted `visibility`)
is fixed and re-verified: code change at the `.insert().values()` block, create-path regression
test proven to fail without the fix and pass with it, full API suite green (1763), `tsc` clean.
The PATCH fix from the original pass is intact. Both create and update paths now persist
submitted visibility.

**Hold — fix-verify loopback pending.** Per platform's stronger-than-default loopback, this
user-verifiable fix re-confirms in the running app before close: create a *new* public show-type
event for Animal Future and confirm it stays public on **first** save + reload (the bounce repro
was first-save-reverts). Story stays at `stage: review` until the user confirms.
