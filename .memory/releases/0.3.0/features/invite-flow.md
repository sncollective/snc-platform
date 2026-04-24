---
id: feature-invite-flow
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

# Invite Flow

> All units need email in prod.

## Sub-units (all done)

- [x] Invite tokens table + service *(needs email in prod)*
- [x] Invite API endpoints *(needs email in prod)*
- [x] Invite email template *(needs email in prod)*
- [x] Admin invite creator flow *(needs email in prod)*
- [x] Team page invite UI *(needs email in prod)*

## Overview

Token-based invite system for two use cases: (1) admin invites someone to become a creator owner, and (2) existing creator owners invite team members. Tokens are hashed, time-limited, single-use, and delivered via email. Acceptance creates the appropriate resources (creator profile or team membership).

---

## Implementation Units

### Unit 1: Shared Invite Types

**File**: `packages/shared/src/invite.ts`

```typescript
import { z } from "zod";

export const INVITE_TYPES = ["creator_owner", "team_member"] as const;
export type InviteType = (typeof INVITE_TYPES)[number];
export const InviteTypeSchema = z.enum(INVITE_TYPES);

export const CreateCreatorOwnerInviteSchema = z.object({
  type: z.literal("creator_owner"),
  email: z.string().email(),
  displayName: z.string().min(1).max(100),
});

export const CreateTeamMemberInviteSchema = z.object({
  type: z.literal("team_member"),
  email: z.string().email(),
  creatorId: z.string().min(1),
  role: z.enum(["owner", "editor", "viewer"]),
});

export const CreateInviteSchema = z.discriminatedUnion("type", [
  CreateCreatorOwnerInviteSchema,
  CreateTeamMemberInviteSchema,
]);

export const InviteResponseSchema = z.object({
  id: z.string(),
  type: InviteTypeSchema,
  email: z.string(),
  expiresAt: z.string(),
  createdAt: z.string(),
});

export const ValidateInviteResponseSchema = z.object({
  id: z.string(),
  type: InviteTypeSchema,
  email: z.string(),
  expiresAt: z.string(),
  payload: z.record(z.unknown()),
});

export type CreateInvite = z.infer<typeof CreateInviteSchema>;
export type InviteResponse = z.infer<typeof InviteResponseSchema>;
export type ValidateInviteResponse = z.infer<typeof ValidateInviteResponseSchema>;
```

Re-export from `packages/shared/src/index.ts`.

**Acceptance Criteria**:

- [ ] Discriminated union schema validates both invite types
- [ ] Shared package builds

---

### Unit 2: Database Schema — Invite Tokens

**File**: `apps/api/src/db/schema/invite.schema.ts`

`invite_tokens` table: `id` (PK), `type`, `email`, `payload` (jsonb), `tokenHash` (unique), `expiresAt`, `acceptedAt` (null = pending), `createdBy` (FK to users), `createdAt`. Indexes on `email` and `tokenHash`.

**Payload shapes**:
- `creator_owner`: `{ displayName: string }`
- `team_member`: `{ creatorId: string, role: "owner" | "editor" | "viewer" }`

**Implementation Notes**:

- `tokenHash` is SHA-256 of the raw token. The raw token is sent via email and never stored.
- Expiry: 7 days from creation.
- `unique` constraint on `tokenHash` prevents hash collisions (defense-in-depth).

**Acceptance Criteria**:

- [ ] Migration generated via `bun run --filter @snc/api db:generate`
- [ ] Table created after `bun run --filter @snc/api db:migrate`
- [ ] Unique constraint on `tokenHash`

---

### Unit 3: Invite Service

**File**: `apps/api/src/services/invites.ts`

Functions:
- `createInvite(input, createdBy)` — generates raw token (base64url 32 bytes), stores hash, sends email. Returns error if email not configured.
- `validateInvite(rawToken)` — hashes token, queries for non-accepted, non-expired row. Returns invite details.
- `acceptInvite(rawToken, userId)` — validates token, verifies user email matches invite email (403 on mismatch), creates creator profile + membership (for `creator_owner`) or adds team member (for `team_member`), marks invite as accepted.

**Implementation Notes**:

- Creator profiles created via invite start as `inactive`. Owner can activate after setup.
- Team member invite uses `onConflictDoNothing` in case user was already added by another path.
- `generateSlug` from `services/slug.ts` used for handle generation.

**Acceptance Criteria**:

- [ ] Token hashed before storage, raw token sent via email
- [ ] Validate rejects expired, used, or invalid tokens
- [ ] Accept creator_owner creates profile + membership
- [ ] Accept team_member adds member (idempotent)
- [ ] Email mismatch returns 403
- [ ] Invite marked as accepted after use

---

### Unit 4: Invite Email Template

**File**: `apps/api/src/email/templates/invite.ts`

`formatInviteEmail({ type, email, token, payload })` — returns `{ subject, html, text }`. Accept URL uses base64url token. 7-day expiry noted in email.

- `creator_owner` — includes display name in subject and body
- `team_member` — includes role in body

**Acceptance Criteria**:

- [ ] Creator owner invite includes display name
- [ ] Team member invite includes role
- [ ] Accept URL uses base64url token (URL-safe)
- [ ] 7-day expiry noted in email

---

### Unit 5: Invite API Endpoints

**File**: `apps/api/src/routes/invite.routes.ts`

Mount at `/api/invites` in `app.ts`.

- `POST /` — auth required. Admin-only for `creator_owner` type; creator owner (or admin) for `team_member` type.
- `GET /:token` — public (no auth). Returns invite details; 404 for invalid/expired/used.
- `POST /:token/accept` — auth required. Creates resources and marks accepted; 403 on email mismatch.

**Acceptance Criteria**:

- [ ] POST `/api/invites` — admin can create creator_owner invite
- [ ] POST `/api/invites` — creator owner can create team_member invite
- [ ] POST `/api/invites` — non-admin/non-owner gets 403
- [ ] GET `/api/invites/:token` — returns invite details (public, no auth needed)
- [ ] GET `/api/invites/:token` — returns 404 for invalid/expired/used tokens
- [ ] POST `/api/invites/:token/accept` — creates resources and marks accepted
- [ ] POST `/api/invites/:token/accept` — email mismatch returns 403

---

### Unit 6: Accept Invite Page

**File**: `apps/web/src/routes/invite/$token.tsx`

Route requires auth (redirects to login with `returnTo` set to invite URL). Loader validates the token via `GET /api/invites/:token`. "Accept Invite" button calls `POST /api/invites/:token/accept`. After accepting, redirects to creator manage settings (new owner) or manage overview (team member).

**Acceptance Criteria**:

- [ ] Page shows invite details before accepting
- [ ] Unauthenticated users redirected to login, then back
- [ ] Accept button creates resources and redirects
- [ ] Error displayed on failure

---

### Unit 7: Admin Invite Creator Flow

**File**: `apps/web/src/routes/admin/creators.tsx` (extend existing)

"Invite Creator" button alongside existing "Create Creator" action. Dialog collects email + display name, submits to `POST /api/invites` with `type: "creator_owner"`.

**Acceptance Criteria**:

- [ ] "Invite Creator" button visible on admin creators page
- [ ] Dialog collects email + display name
- [ ] Submits to POST `/api/invites` with `type: "creator_owner"`
- [ ] Success feedback after sending

---

### Unit 8: Team Page Invite UI

**File**: `apps/web/src/components/creator/team-section.tsx` (extend existing)

"Invite by email" button alongside existing search-and-add flow. Form collects email + role, submits to `POST /api/invites` with `type: "team_member"`. Only shown for owners/admins, matching existing `canManageMembers` gate.

**Acceptance Criteria**:

- [ ] "Invite by email" button visible for owners/admins
- [ ] Form collects email + role
- [ ] Submits to POST `/api/invites` with `type: "team_member"`
- [ ] Success feedback after sending

---

## Implementation Order

1. **Unit 1** — Shared types in `@snc/shared`
2. **Unit 2** — Database schema + migration
3. **Unit 3** — Invite service (create, validate, accept)
4. **Unit 4** — Email template
5. **Unit 5** — API endpoints
6. **Unit 6** — Accept invite page
7. **Unit 7** — Admin invite creator dialog
8. **Unit 8** — Team page invite UI

## Testing

### Unit Tests: `apps/api/tests/services/invites.test.ts`

- Token hashing and validation
- Expiry enforcement
- Accept creates creator profile (owner invite)
- Accept adds team member (team invite)
- Email mismatch rejection
- Double-accept prevention (already accepted)

### Unit Tests: `apps/api/tests/routes/invite.routes.test.ts`

- POST create: admin-only for creator_owner, owner-only for team_member
- GET validate: valid, expired, used tokens
- POST accept: auth required, email match, resource creation

### Unit Tests: `apps/web/tests/routes/invite.test.tsx`

- Page renders invite details
- Accept button flow
- Error handling

## Verification Checklist

```bash
bun run --filter @snc/shared build
bun run --filter @snc/api db:generate
bun run --filter @snc/api db:migrate
bun run --filter @snc/api test:unit
bun run --filter @snc/web test
```
