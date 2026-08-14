---
id: brand-voice-route-scoping-verification
kind: story
stage: done
tags: [design-system, testing]
parent: brand-voice-route-scoping
depends_on: [brand-voice-route-scoping-portal-attributes]
release_binding: null
gate_origin: null
created: 2026-08-14
updated: 2026-08-15
---

# Brand voice — route scoping runtime verification

## Brief

Build the runtime test suite for the route boundary and portal propagation after both
implementation checkpoints land. Verify the placement and identity contract described in
the parent feature without duplicating child-1 CSS alias or raw `--voice-*` assertions.

## Acceptance

- **Resolver table:** cover `/studio` → `studio`, `/live` → `tv`, the press-kit index and
  release one-sheet → `records`, trailing-slash normalization, a near-prefix negative,
  creator manage press/library, and representative root/admin/playout paths → `parent`.
- **SSR boundary:** render representative paths with the server renderer and assert the
  expected `data-route` is already in returned HTML; the test demonstrates no effect,
  `window` branch, or post-mount mutation is needed.
- **Shell containment:** render an outlet fixture with markers for `GlobalPlayer`, footer,
  and chat target. Assert only the transparent outlet boundary carries the route attribute
  and persistent-shell markers do not.
- **Nested-route fixtures:** cover both public press leaves, creator manage descendants,
  and the feature-disabled/Coming Soon studio render at the root outlet boundary.
- **Portal fixtures:** from TV, assert Ark-style positioned portal roots and the live chat
  panel carry `data-route="tv"` while the chat target does not; assert a shell-originated
  portal remains Parent and nested portal roots retain the identity.
- **Navigation update:** change pathname from Studio to Parent and Records and assert the
  boundary updates atomically without a stale prior route attribute.

## Constraints

Tests must prove attribute placement and route identity inputs only. The
`brand-token-architecture-route-scoping-contract` story owns CSS selector, alias, and
computed-style assertions; do not assert raw `--voice-*` declarations here. No new UI
surface is introduced, so no mockup is required.

## Implementation notes

- Completed the pure resolver matrix for exact Studio/TV routes, both public press leaves,
  trailing slashes, segment-boundary negatives, manage descendants, and Parent shell routes.
- Added server-rendered outlet fixtures proving route attributes exist before hydration, plus a
  navigation fixture that replaces Studio → Parent → Records identity without retaining stale
  attributes.
- Added root-shell containment coverage around the real `RootLayout` composition and retained
  the feature-disabled Studio Coming Soon leaf beneath a Studio boundary.
- Completed portal coverage across every Ark primitive, nested portals, Parent shell fallback,
  and the real live chat React portal/attribute-free target boundary.
- Focused runtime contract passed (`66` tests); full web suite passed (`2014` tests). Tests assert
  runtime identity and placement only and do not duplicate CSS alias assertions.
