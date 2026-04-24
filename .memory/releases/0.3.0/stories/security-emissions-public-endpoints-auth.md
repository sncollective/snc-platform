---
id: story-security-emissions-public-endpoints-auth
kind: story
stage: done
tags: [security, content]
release_binding: 0.3.0
created: 2026-04-24
updated: 2026-04-24
related_decisions: []
related_designs: []
parent: null
---

Surfaced by the 0.3.0 security-gate scan (api/routes+middleware). **S1** — unauth'd data exposure.

`GET /emissions/summary` and `GET /emissions/breakdown` in [emissions.routes.ts](../../apps/api/src/routes/emissions.routes.ts) have **no authentication or authorization** — not even `optionalAuth`. They return the organization's full CO2 emissions accounting including per-category / per-scope breakdowns.

The `POST /entries` and `POST /offsets` mutation routes correctly gate on admin. The read endpoints appear to have been inadvertently left open when the feature was scoped.

## What changes

Add `requireAuth` + `requireRole('stakeholder')` to both read endpoints, matching the access pattern of the cooperative dashboard and calendar/projects endpoints (these are all internal stakeholder data, not public-website data).

## Tasks

- [ ] Add `requireAuth` middleware to both routes.
- [ ] Add `requireRole('stakeholder')` (or `requireAnyRole('stakeholder', 'admin')` per existing conventions).
- [ ] Update/add route tests: unauth'd → 401; authed non-stakeholder → 403; stakeholder → 200 with data.

## Verification

- Logged out: `curl http://localhost:3000/api/emissions/summary` → 401.
- Logged in as regular user (no stakeholder role): same → 403.
- Logged in as admin/stakeholder: 200 with payload.

## Risks

None. This is a tightening — no external surface depends on the data being public (the dashboard page already assumes stakeholder auth).
