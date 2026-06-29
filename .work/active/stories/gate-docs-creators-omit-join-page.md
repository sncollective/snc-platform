---
id: gate-docs-creators-omit-join-page
kind: story
stage: done
tags: [documentation]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: docs
created: 2026-06-29
updated: 2026-06-29
---

# Creator docs omit the shipped join-page/email-capture capability

## Severity
High

## Drift type
foundation-doc

## Location
`docs/creators.md:70,88,115`; contradicting: `apps/api/src/app.ts:158,160`, `apps/api/src/db/schema/creator.schema.ts:64`, `apps/api/src/services/join.ts:101`, `apps/web/src/routes/creators/$creatorId/manage/join.tsx:21`

## Evidence
The creator doc's route/schema sections list creator programming and only `creator_profiles` / `creator_members`. The implementation now mounts creator join-config routes under `/api/creators`, public join routes under `/api/join`, stores `creator_join_configs`, records consent in `consent_log`, and exposes a creator manage QR/link surface at `/join/<creator>`.

## Remediation direction
Add the join-page capability to creator docs: route table entries, `creator_join_configs`, QR/manage flow, public join flow, follower/consent effects, and permission model.

## Implementation (2026-06-29)
- Files changed: `docs/creators.md`
- Tests added: none (foundation-doc rewrite only)
- Verification: checked the rewritten claims against `apps/api/src/app.ts`, `apps/api/src/routes/join.routes.ts`, `apps/api/src/db/schema/creator.schema.ts`, `apps/api/src/db/schema/consent.schema.ts`, `apps/api/src/services/join.ts`, `apps/web/src/routes/creators/$creatorId/manage/join.tsx`, `apps/web/src/routes/join/$handle.tsx`, and `packages/shared/src/join.ts`.
- Discrepancies from design: the route descriptions say join-config editing uses `editProfile`, because the shipped `join.routes.ts` gates both read and patch with `requireCreatorPermission(..., "editProfile", roles)`.
- Adjacent issues parked: none.

## Review (2026-06-29)

**Verdict**: Approve

**Notes**: Fast-lane (story with green verification). Implementation verified in the implement wave: full suite green (shared 682, api 1890, web 1807, web build). No blockers or important findings above nit.
