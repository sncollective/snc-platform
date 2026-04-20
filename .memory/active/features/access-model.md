---
id: feature-access-model
kind: feature
stage: done
tags: [identity, creators]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# Access Model — Manage Area by Membership

> Admin bypass verified; needs non-admin team member verification in prod.

## Sub-units (all done)

- [x] Manage area access by membership *(admin bypass verified; needs non-admin team member verification in prod)*

## Overview

Change the creator manage area (`/creators/$creatorId/manage`) from requiring platform `stakeholder`/`admin` roles to requiring **creator team membership** OR `admin`. This makes `stakeholder` a co-op governance role (create creators, financials, voting) rather than a page management gate.

---

## Implementation Units

### Unit 1: Update Manage Route `beforeLoad`

**File**: `apps/web/src/routes/creators/$creatorId/manage.tsx`

Replace the current `stakeholder`/`admin` gate with a membership check:

```typescript
beforeLoad: async ({ location, params }) => {
  const { user, roles } = await fetchAuthStateServer();
  if (!user) throw redirect(buildLoginRedirect(location.pathname));

  const isAdmin = roles.includes("admin");

  if (!isAdmin) {
    const [memberships, creator] = await Promise.all([
      fetchApiServer({ data: "/api/me/creators" }) as Promise<
        Array<{ creatorId: string; role: CreatorMemberRole }>
      >,
      fetchApiServer({
        data: `/api/creators/${encodeURIComponent(params.creatorId)}`,
      }) as Promise<{ id: string }>,
    ]);

    const isMember = memberships.some((m) => m.creatorId === creator.id);
    if (!isMember) throw new AccessDeniedError();
  }

  return { userId: user.id, platformRoles: roles };
},
```

**Implementation Notes**:

- `/api/me/creators` already exists and returns the user's creator memberships with roles.
- Parallel fetch of memberships + creator profile in `beforeLoad` resolves handle-vs-UUID correctly. The creator fetch is potentially duplicated with the loader — pass resolved creator through `beforeLoad` context to avoid double-fetch.

**Acceptance Criteria**:

- [ ] Non-admin users who are creator team members (any role) can access the manage area
- [ ] Non-admin users who are NOT team members get `AccessDeniedError`
- [ ] Admin users can still access any creator's manage area
- [ ] Stakeholders who are NOT team members of a specific creator can no longer access that creator's manage area (unless they are also admin)
- [ ] Handle-based URLs resolve correctly for membership checks

---

### Unit 2: Update `canManage` Logic in Creator Listing / Public Pages

**File**: `apps/api/src/routes/creator.routes.ts`

Replace `stakeholder`/`admin` role check for `canManage` with admin-or-member check:

```typescript
// New logic:
canManage: roles.includes("admin") || memberCreatorIds.includes(creator.id)
```

`memberCreatorIds` fetched once per request via `getCreatorMemberships(userId)` from `services/creator-team.ts`.

**Acceptance Criteria**:

- [ ] `canManage` is `true` for team members of that creator
- [ ] `canManage` is `true` for admin users
- [ ] `canManage` is `false` for users with no membership and no admin role
- [ ] Stakeholder role alone no longer sets `canManage` to `true`

---

### Unit 3: Update Creator Header Manage Link

**File**: `apps/web/src/components/creator/creator-header.tsx`

The "Manage" link visibility is gated on `canManage` prop computed server-side. No change to component itself — verify it renders correctly with new `canManage` semantics.

**Acceptance Criteria**:

- [ ] "Manage" link appears for team members viewing the creator's public page
- [ ] "Manage" link does not appear for non-members (even stakeholders)

---

## Implementation Order

1. **Unit 1** — manage route `beforeLoad` (core access gate change)
2. **Unit 2** — `canManage` in API responses (enables correct UI behavior)
3. **Unit 3** — verify creator header (should work with no code changes)

## Testing

### Unit Tests: `apps/web/tests/routes/manage.test.ts`

Test the `beforeLoad` access logic:

- Admin user → allowed (no membership check)
- Team member (owner/editor/viewer) → allowed
- Non-member, non-admin → `AccessDeniedError`
- Stakeholder without membership → `AccessDeniedError`
- Unauthenticated → redirect to login

### Unit Tests: `apps/api/tests/routes/creator.routes.test.ts`

Test `canManage` in responses:

- Admin user → `canManage: true` for all creators
- Team member → `canManage: true` for their creator
- Stakeholder only → `canManage: false` (unless also team member)
- Unauthenticated → `canManage` absent

## Verification Checklist

```bash
bun run --filter @snc/web test
bun run --filter @snc/api test:unit
```
