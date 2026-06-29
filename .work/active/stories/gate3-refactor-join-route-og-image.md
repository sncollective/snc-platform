---
id: gate3-refactor-join-route-og-image
kind: story
stage: done
tags: [refactor, seo]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: refactor
created: 2026-06-29
updated: 2026-06-29
---

# Join route Open Graph image omitted while creator avatar is available

## Severity
High

## Location
`apps/web/src/routes/join/$handle.tsx:35-38,208-214`

## Evidence
head() emits og:title/description/type/url but no og:image; the route renders creator.avatar.src in the body.

## Remediation direction
Add conditional og:image metadata when creator.avatar is present, using an absolute URL consistent with VITE_SITE_URL canonical/OG construction.

## Implementation (2026-06-29)
Updated `apps/web/src/routes/join/$handle.tsx` so `head()` derives an absolute `og:image` from `creator.avatar.src` when present, preserving existing canonical/OG URL construction via `VITE_SITE_URL` and leaving metadata unchanged when no avatar exists.

## Review (2026-06-29)

**Verdict**: Approve. Fast-lane (rerun-2 finding, green — full suite: shared + api 117 + web build/test). No blockers.
