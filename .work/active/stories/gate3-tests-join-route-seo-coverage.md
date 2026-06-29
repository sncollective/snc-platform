---
id: gate3-tests-join-route-seo-coverage
kind: story
stage: implementing
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
