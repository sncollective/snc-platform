---
id: integration-channel-lifecycle-fk-fixture
kind: story
stage: backlog
tags: [testing, streaming, developer-experience]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-08
updated: 2026-08-08
---

# Integration suite: channel-lifecycle + test-control-gating baseline failures

Two integration test files fail against the dev DB with what look like
test-isolation / env-state issues, NOT product bugs:

- `apps/api/tests/integration/streaming/channel-lifecycle.test.ts` (3 tests) —
  `ensureCreatorChannel` inserts into `channels` with `creator_id =
  test-creator-<uuid>` that has no matching `creator_profiles` row → FK violation
  `channels_creator_id_creator_profiles_id_fk`. The tests assume a creator
  profile exists (seeded by setup / a sibling test) that isn't present in a
  standalone run.
- `apps/api/tests/integration/test-control-gating.test.ts` (1 test) — "rejects
  mounted test-control routes when the shared secret is missing" fails; likely a
  `TEST_CONTROL_PROFILE` mismatch between the PM2 dev API profile (`e2e`) and the
  integration-run profile.

## Surfaced

W1 of the press-page-v2 + content-library build (2026-08-08). Both implementing
workers independently reported these as pre-existing baseline failures.
Confirmed unrelated to the wave: neither `content-library-core` (adds a new
`content_assets` table only) nor `creator-press-page-v2-content-model` (evolves a
JSONB contract) touches `channels`, `creator_profiles`, or test-control gating.
The FK constraint is pre-existing; the wave cannot causally produce it.

## Likely fix direction

- Make the channel-lifecycle integration tests hermetic: seed the
  `creator_profiles` row each test needs in its own setup (or via the test-control
  reset) rather than relying on sibling-test/ordering state.
- Reconcile the `TEST_CONTROL_PROFILE` used by the integration run vs the PM2 dev
  API, or adjust the gating test's expectation to the integration profile.

## Why parked, not fixed inline

Out of scope for the press/content-library work; diagnosing integration-test
isolation is its own thread. The wave's own feature integration tests are green.
