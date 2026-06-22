---
id: authz-finish-creator-permission-migration
kind: feature
stage: drafting
tags: [identity, creators, streaming, refactor]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-20
updated: 2026-06-20
---

# Finish the creator-permission migration + reconcile manageStreaming

Closes the verified gaps in the authorization model. The two-system design (org roles +
per-creator permissions) is sound and kept — see `.research/analysis/positions/authorization-model.md`
for the full current-state map, history, and rejected alternatives. This item is **cleanup
within that model**, not a redesign.

Surfaced 2026-06-20 while reviewing the calendar-checkbox auth fix (`calendar-task-checkbox-bug`),
which removed the last blanket `requireRole("stakeholder")` from `creator-events.routes.ts`. An
audit of the rest of the codebase found the same bug class still live in one more place plus a
half-adopted `manageStreaming` permission.

## Tasks

- [ ] **Remove the remaining live dual-gate on project creation (latent 403 bug).**
  `project.routes.ts:82` applies a router-wide `requireRole("stakeholder")` over a per-handler
  `requireCreatorPermission(user.id, data.creatorId, "manageScheduling", roles)` (`:219`). A
  creator member with `manageScheduling` but no org `stakeholder` role is 403'd at the router
  middleware before their creator permission is ever checked — the exact bug fixed in
  creator-events today. **Caution:** this router may host other handlers that have *no*
  per-creator check and rely solely on the blanket guard (the creator-events GET handler was
  exactly this trap — removing the guard naively would have leaked data). Audit every handler in
  `project.routes.ts` before removing line 82; add an explicit `requireCreatorPermission` to any
  handler that currently relies only on `requireRole`. Add a test with `roles: []` (creator
  member, no org role) proving project creation succeeds.

- [ ] **Fix `streaming-connect` to gate on `manageStreaming`, not `manageMembers`.**
  `streaming-connect.routes.ts:60` (connect-callback) and `:141` (disconnect) call
  `requireCreatorPermission(user.id, creatorId, "manageMembers")` — semantically wrong. OAuth
  stream connect/disconnect is streaming management; it should gate on `manageStreaming` (which
  `stream-keys.ts:41` and `simulcast.ts:61` already use correctly). Switch both to
  `manageStreaming`. Note the behavior change: under the matrix today `manageStreaming` is
  owner-only while `manageMembers` is also owner-only, so the *effective* gate is unchanged for
  current roles — but it stops being a latent mismatch if `manageStreaming` is ever granted to
  editors (see next task). Update/confirm tests assert the `manageStreaming` permission string.

- [ ] **Reconcile the Streaming nav with the permission matrix (client/server divergence).**
  `manage.tsx:114` hard-codes the Streaming nav item as `memberRole !== "owner" && !isAdmin`
  with a stale comment ("Streaming: owner-only (not in permission matrix)"). `manageStreaming`
  **is** in the matrix (`creator.ts:102`). Replace the hard-coded owner check with a matrix
  consult: tag the Streaming `ContextNavItem` with `creatorPermission: "manageStreaming"` so the
  existing `itemFilter` permission path handles it, and delete the special-case line + comment.
  Behavior is identical today (manageStreaming is owner-only), but the nav now tracks the matrix
  — so granting editors `manageStreaming` later is a one-line matrix edit, not a hunt for
  hard-coded checks.

- [ ] **(Decide, then do or defer) Cache the role lookups.** `getUserRoles` runs per request and
  `checkCreatorPermission` per call, both uncached — N+1 in loops (feed pin, bulk ops). This is
  perf, not correctness. Scope a request-scoped memo (cheapest: stash on the Hono context for the
  request lifetime) or a short-TTL cache. **May split to its own item** if it grows; only do it
  here if it stays small.

- [ ] **(Decide, then do or defer) Audit-log the admin bypass.** `checkCreatorPermission:38`
  silently returns `true` for org admins acting on any creator. Denials are logged; the bypass
  is not. Add a `creator_authz_admin_bypass` log line (mirroring the `creator_authz_denial`
  shape) so admin actions on creator resources are traceable. Low-risk; bundle here or defer.

## Out of scope (named so they aren't silently dropped)

- **The third content-access tier** (`content-access.ts:81` free access for stakeholders +
  members) — a watch item in the position doc, not a fix. Reconcile only if a fourth ad-hoc
  authorization surface appears.
- **Role hierarchy / collapsing the two systems / better-auth roles plugin** — explicitly
  rejected in the position doc; revisit conditions tracked there.

## Verification

- API + web unit suites green; `tsc` clean both packages.
- New tests: `roles: []` creator member can create a project; streaming-connect gates on
  `manageStreaming`.
- **Fix-verify loopback:** as a creator owner/editor with no org role, (a) create a project, and
  (b) confirm the Streaming nav item appears iff the role has `manageStreaming`. Confirmed in the
  running app before close.

## New `manageStreaming` consumer (from unified-channel-model-creator-enablement, 2026-06-22)
The creator-editorial-enablement feature shipped a fourth `manageStreaming` consumer beyond the
existing stream-keys / simulcast / streaming-connect surfaces: a creator-scoped editorial API
(`requireCreatorChannelPermission("manageStreaming")` over `/api/creator/playout/*`) and a
"Programming" manage-nav item gated on `creatorPermission: "manageStreaming"`. This is a clean
**consumer** of this migration's permission model — no conflict, and it advances the fine-grained
per-creator goal. But it widens the **nav-reconciliation task's** surface: the Streaming-nav fix
should be verified to also surface the new **Programming** item correctly for a non-owner team
member who holds `manageStreaming` (today `manageStreaming` is owner-only in the matrix, so the
practical set is unchanged — but if the matrix ever grants `manageStreaming` to a non-owner role,
both the Streaming AND Programming nav items must follow the matrix, not a hard-coded owner check).
The creator-editorial routes are integration-tested for cross-tenant isolation with an owner role;
add a non-owner-with-`manageStreaming` case here if/when the matrix changes.
