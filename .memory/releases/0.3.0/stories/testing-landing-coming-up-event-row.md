---
id: story-testing-landing-coming-up-event-row
kind: story
stage: done
tags: [testing, content]
release_binding: 0.3.0
created: 2026-04-24
updated: 2026-04-24
related_decisions: []
related_designs: []
parent: null
---

Surfaced by the 0.3.0 testing-gate triage. The landing page's **"Coming Up"** section — which renders the Animal Future 2026-04-24 event row for every visitor — has zero e2e coverage. [landing.spec.ts](../../apps/e2e/tests/landing.spec.ts) asserts hero + featured creators + nav, but never checks the ComingUp section renders.

Given the entire point of 0.3.0 is the Animal Future livestream, a silent regression in the `/api/events/upcoming` fetch or the `ComingUp` component would hide the event from the public landing page with no test signal.

## What changes

Extend `landing.spec.ts` with one additional test in the existing `describe("Landing page")` block:

- Navigate to `/`.
- Assert `getByRole('heading', { name: 'Coming Up' })` is visible (ComingUp section renders).
- Assert either (a) at least one event card is rendered, or (b) the empty-state copy appears — and we prefer (a) is satisfied given the 0.3.0 seed includes Animal Future.

Keep it render-level only. Don't assert on specific event titles — seed data evolves and we don't want to brittle-couple the test.

## Tasks

- [ ] Add `test("ComingUp section renders with upcoming events", ...)` to landing.spec.ts.
- [ ] Verify by running `bun run --filter @snc/e2e test -- landing.spec.ts` against staging (`:3082`).

## Verification

- New test passes against staging with seeded data (Animal Future event present).

## Risks

None. Pure additive test.
