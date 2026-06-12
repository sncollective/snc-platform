---
id: calendar-event-patch-drops-visibility
kind: story
stage: review
tags: [calendar]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-04-24
updated: 2026-06-12
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
