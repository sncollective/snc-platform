---
id: email-capture-at-shows-join-api
kind: story
stage: review
tags: [community, commerce]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-13
updated: 2026-06-16
parent: email-capture-at-shows
---

# Join API — schema, service, routes

Units 1–2 of the parent feature design (read `## Implementation Units` in
`email-capture-at-shows` for full signatures and notes).

## Scope

- **Schema**: `creatorJoinConfigs` (in `apps/api/src/db/schema/creator.schema.ts`) +
  `consentLog` (new `apps/api/src/db/schema/consent.schema.ts`). Migration via drizzle-kit.
  `PRIVACY_POLICY_VERSION` constant in `packages/shared/src/`.
- **Service**: `apps/api/src/services/join.ts` — `getJoinPagePayload` (creator public info via
  `resolveCreatorUrls`, config-or-defaults, follower count, creator + S/NC public plans),
  `completeJoin` (existing `followCreator` + consent-log insert, idempotent), `getJoinConfig`,
  `updateJoinConfig` (upsert).
- **Routes**: `apps/api/src/routes/join.routes.ts`, mounted in `app.ts`:
  - `GET /api/join/:handleOrId` — public, behind existing `rateLimiter`, dual-mode
    handle/id resolution (`human-readable-url-slug`)
  - `POST /api/join/:creatorId/complete` — `requireAuth`, body `{ consent: true, policyVersion }`
    (zod literal `true`)
  - `GET/PATCH /api/creators/:creatorId/join-config` — creator-member ownership per
    `creator-members.routes.ts` pattern

## Acceptance criteria

- [ ] Migration generated (never hand-written) and applies cleanly
- [ ] Absent config row behaves as defaults (explainer + CTA on, no incentive)
- [ ] Happy-path + auth-failure tests per route; service tests with `drizzle-chainable-mock`
- [ ] `complete` without `consent: true` → 422 and writes nothing
- [ ] Join payload 404s on unknown creator; returns defaults when unconfigured
- [ ] `PATCH join-config` rejected for non-members

## Implementation (2026-06-16)
Unit 1 (schema) + Unit 2 (service+routes). consentLog table + PRIVACY_POLICY_VERSION
were already landed (via notify-me); this story added creatorJoinConfigs (migration 0028),
shared join types (packages/shared/src/join.ts), services/join.ts (getJoinPagePayload,
completeJoin [reuses followCreator + consentLog, idempotent], getJoinConfig,
updateJoinConfig [upsert]), and routes/join.routes.ts: GET /api/join/:handleOrId (public,
rateLimiter, dual-mode handle/id via findCreatorProfile), POST /:creatorId/complete
(requireAuth, consent:literal-true), GET/PATCH /api/creators/:creatorId/join-config
(editProfile permission). Mounted in app.ts.

Verified: 9 route tests; api 1635/1635, tsc clean. Live stack: GET /api/join/maya-chen
→ 200 (real payload, config defaults when no row), POST /complete unauth → 401.
join-api → review.
