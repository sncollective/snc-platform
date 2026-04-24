---
id: story-fix-event-form-visibility-clobber-on-edit
kind: story
stage: done
tags: [calendar, content]
release_binding: 0.3.0
created: 2026-04-24
updated: 2026-04-24
related_decisions: []
related_designs: []
parent: null
---

Surfaced by the 0.3.0 refactor-gate scan (web/components). [`event-form.tsx`](../../apps/web/src/components/calendar/event-form.tsx) has two `useEffect` blocks reacting to `eventType` that both call `setVisibility('public')` when `eventType === 'show'`:

- Lines 196–200 — guarded by `!event`, so only fires on the **new-event** path. Intentional.
- Lines 219–223 — **unconditional**. Fires on every render where `eventType === 'show'`, including when editing an existing event.

Net effect: if a user edits an existing `"show"`-type event that was set to `subscribers`-only visibility, every render path that touches `eventType` silently overwrites their chosen visibility back to `public`. Data loss disguised as a helpful default. Live-stream-show UX — which is core 0.3.0 surface — gets its gating quietly stripped.

## What changes

Remove the unconditional effect (lines 219–223); keep the `!event`-guarded one (lines 196–200). The guarded version is the intended behavior: auto-default to public on new-show creation, don't touch existing edits.

## Tasks

- [ ] Delete the unconditional `useEffect` at [event-form.tsx:219-223](../../apps/web/src/components/calendar/event-form.tsx#L219-L223).
- [ ] Keep the `!event`-guarded effect at lines 196–200 intact.
- [ ] Unit test: render `EventForm` in edit mode with an existing `{ type: 'show', visibility: 'subscribers' }` event; confirm `visibility` state stays `'subscribers'` after mount and after any `eventType` change.
- [ ] Unit test: render `EventForm` in new-event mode with `eventType === 'show'`; confirm `visibility` defaults to `'public'`.

## Verification

- Edit an existing show-type event in dev that's set to subscribers-only; confirm the visibility field stays at subscribers when the form mounts, and doesn't flip on any unrelated field edit.
- Create a new show event; confirm the public default still applies.

## Risks

Low. The fix is a deletion; the kept effect handles the new-event default correctly. Existing event-form tests should pass unchanged; the new tests pin the behavior going forward.
