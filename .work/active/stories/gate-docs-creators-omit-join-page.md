---
id: gate-docs-creators-omit-join-page
kind: story
stage: implementing
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
