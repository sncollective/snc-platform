---
id: gate3-tests-join-route-seo-coverage
kind: story
stage: done
tags: [testing]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: tests
created: 2026-06-29
updated: 2026-06-29
---

# Join route SEO head/canonical/avatar additions have no route coverage

## Priority
Critical

## Spec reference
Item: `gate2-refactor-join-route-seo` — head({loaderData}) dynamic title/description; canonical; decoding=async.

## Suggested test
`apps/web/tests/unit/routes/join-flow.test.tsx`: route.head() builds title/description/og/canonical from loaderData (incl. handle-null fallback); avatar img has decoding=async.

## Test location
`apps/web/tests/unit/routes/join-flow.test.tsx`

## Implementation (2026-06-29)
Extended `apps/web/tests/unit/routes/join-flow.test.tsx` to extract the route object and assert `head()` emits dynamic title, description, Open Graph URL metadata, canonical links, handle-null canonical fallback via `creator.id`, and async avatar image decoding.

## Review (2026-06-29)

**Verdict**: Approve. Fast-lane (rerun-2 finding, green — full suite: shared + api 117 + web build/test). No blockers.
