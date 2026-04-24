---
tags: [testing, batch-tracker]
release_binding: null
created: 2026-04-24
---

# E2E CI first-run failures — 2026-04-24

First green end-to-end run of the Platform: Test & Build e2e step after unblocking the three infrastructure gates today (typecheck, Nitro devProxy, Playwright container + upload-artifact bumps). ~20 of 113 tests failed on real content/UI assertions. E2E does not gate demo or prod deploy (neither workflow depends on `test-e2e`), so these were parked rather than fixed pre-event. Demo shipped against green on the dependent gates (`test-shared`, `test-api`, `test-web`, `typecheck`, `build`).

This tracker groups the failures by root-cause shape for post-event `/scope` passes. Failures against the 0.3.0 + main HEAD as of commit `2c17759` (platform) / `a79cd84` (parent).

## Selector brittleness (strict-mode violations)

Quick fixes — add `.first()` or a more specific selector. No product change required.

- `tests/creator-manage.spec.ts:17` — `getByText('Maya Chen')` matches 2 elements: user-menu `_userName_` + nav context-label `_contextLabel_`. Both are valid renders; the test needs `.first()` or a scoped locator.
- `tests/navigation.spec.ts:21` — same `getByText('Maya Chen')` ambiguity, this time matching the creator-card `_displayName_` + user-menu `_userName_`.

## Empty-state / loader-returned-nothing

SSR loaders appear to return empty under CI, collapsing conditional renders. Could be seed-data gap (the demo seed may not populate all content domains that staging has populated through ad-hoc use) or a loader path that behaves differently under the CI server-fn runtime. Needs investigation per area; may be one root cause or three.

- `tests/landing.spec.ts:18` — `getByRole('heading', { name: 'Featured Creators' })` not visible on `/`. Heading is conditional on `featuredCreators.length > 0`.
- `tests/admin-roles.spec.ts:39` — `getByRole('heading', { name: 'Now Playing' })` not visible on `/admin/playout`. Headings are conditional on playout channel presence.
- `tests/live-streaming.spec.ts:8,16` — `getByRole('combobox', { name: 'Select channel' })` not visible on `/live`. Channel selector only renders with ≥1 seeded playout channel.
- `tests/live-streaming.spec.ts:32` — `Theater mode` button not visible (same page, likely same empty-channel root cause cascading).
- `tests/live-streaming.spec.ts:42` — `Chat message` textbox not visible (same cascade).

## Auth-flow register → logout

- `tests/auth-flow.spec.ts:25` — post-registration `Log out` button not visible. Likely email-verification-required branch: registration succeeds but the user isn't fully authed until the verification link is clicked, and Mailpit isn't in the CI service list so the link never arrives. Either: disable email-verification requirement for the e2e CI env, add Mailpit as a service container and click-through the verification email in the test, or split the test into register-only + log-in-with-seeded-user flows.

## Other

- `tests/live-streaming.spec.ts` (mobile project) — prior session note flagged mobile theater-mode as pre-existing flaky; likely folded into the live-streaming set above once the channel-data issue is fixed.
- Client-side error-boundary logs surfaced during the run (`Content not found`, `You don't have access to this page`) on admin/content routes — these are the expected error-boundary paths when a loader 404s; they're not themselves failures, just noise in the output.

## How to consume this

Each group is a scopable unit:

1. Selector brittleness → one `/scope` pass → a `fix: e2e selector strict-mode ambiguity` story with both locator fixes.
2. Empty-state cascade → one investigation feature → figure out whether the CI demo seed is under-populated vs. a server-fn / SSR loader behavior difference. Likely splits into a seed fix + a loader fix once diagnosed.
3. Auth-flow register → one story → add Mailpit to CI services OR set an env var that skips verification in e2e, whichever matches the auth config surface.

Don't fix selectors individually as drive-bys; batch them so the re-run is one green signal.

## Revisit if

- A separate CI run of this suite after any related change shows a different failure set — replace this tracker with the new baseline rather than merging, since drift rate will be high until fixed.
- E2E becomes a gate on deploy (currently neither workflow lists it in `needs:`) — that's the forcing function to actually fix these.
- Seed data surface grows materially (new domains) — revisit whether the "demo seed feeds e2e" pattern scales or whether e2e needs its own fixture seeding.
