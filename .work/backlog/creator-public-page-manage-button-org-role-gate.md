---
id: creator-public-page-manage-button-org-role-gate
tags: [creators, identity, bug]
release_binding: null
created: 2026-06-20
---

# Creator public-page "Manage" button uses org-role gate instead of membership

Found 2026-06-20 during the fix-verify of `calendar-task-checkbox-bug`. A creator-team member
(role `editor`) with **no** org-level role (not `stakeholder`/`admin`) does not see the "Manage"
button on the creator's public page `/creators/<handle>`, even though they CAN reach and use the
manage area by navigating directly or via the creators list. Only the public-page button is
missing.

This is another instance of the same half-finished migration described in
`.research/analysis/positions/authorization-model.md`: a surface still gating on org roles where
it should gate on per-creator membership.

## Root cause (verified in code)

The public page sets `canManage` from **org roles only**:

```
apps/web/src/routes/creators/$creatorId/index.tsx:93
setCanManage(roles.includes("stakeholder") || roles.includes("admin"));
```

A creator member with `roles: []` therefore gets `canManage = false`.

The manage route itself does it correctly — admin OR membership of this specific creator:

```
apps/web/src/routes/creators/$creatorId/manage.tsx:44-58
if (!roles.includes("admin")) {
  const [membershipsRes, creatorRes] = await Promise.all([
    fetchApiServer({ data: "/api/me/creators" }),
    fetchApiServer({ data: `/api/creators/${...}` }),
  ]);
  const isMember = membershipsRes.creators.some((m) => m.id === creatorRes.id);
  if (!isMember) throw new AccessDeniedError();
}
```

So the public page and the manage gate have **diverged**: the public page never fetches creator
memberships, so it can't know the viewer is a member.

## Fix direction

Bring the public page's `canManage` in line with the manage gate: in addition to the existing
`fetchAuthState()` call in its supplementary-data effect (`index.tsx:50-102`), fetch
`/api/me/creators` and set `canManage = roles.includes("admin") || memberships.some(m => m.id === thisCreatorId)`.
`/api/me/creators` is already consumed client-side elsewhere (`creator-switcher.tsx:35`), so no
API change is needed. Match the membership-id comparison the manage route uses (compare against
the resolved creator id, not the handle param).

## Verification

- [ ] As a creator editor with no org role, the "Manage" button appears on `/creators/<handle>`.
- [ ] As a non-member non-admin, it does NOT appear.
- [ ] As an org admin, it still appears (admin bypass preserved).
- [ ] Web unit test covering the membership-vs-org-role branch.

## Fix-verify loopback

In the running app, log in as a creator editor with no org role and confirm the Manage button
shows on that creator's public page.
