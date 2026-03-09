> **Archived**: 2026-03-09
> **Validation**: All tests passing, no cross-finding regressions

# Refactor Analysis: Admin (User & Role Management)

> **Generated**: 2026-03-09
> **Scope**: 14 source files across 4 layers (shared, API routes, web lib/components/routes, tests)
> **Libraries researched**: None required (no admin-specific external libs beyond existing stack)

---

## Executive Summary

The admin vertical slice is compact and well-structured: 3 API endpoints, 1 web route, 1 component, 1 lib module, and corresponding tests/fixtures. The analysis found **0 P0**, **2 P1**, **3 P2**, and **3 P3** findings. The highest-impact issue is duplicated user-to-response transformation logic in the API route (inline mapping repeated in 3 places instead of extracted to a `toAdminUserResponse` transformer). The second is a dead export (`fetchAdminUsers`) in the web lib that is never consumed. No shared schema tests exist for the admin domain.

---

## P0 -- Fix Now

None found.

---

## P1 -- High Value

### 1. Duplicated user-to-AdminUser mapping in admin.routes.ts

- **Affected files**: `apps/api/src/routes/admin.routes.ts:58-67`, `:136-145`
- **Current state**: The conversion from DB user row to `AdminUser` response shape (`.toISOString()` on dates, spreading roles) is written inline in two separate places:
  1. Inside `getUserWithRoles()` (lines 58-67) -- used by POST and DELETE handlers
  2. Inside the GET `/users` handler (lines 136-145) -- mapping over paginated users

  Both do the same field-by-field mapping: `id, name, email, emailVerified, image, createdAt.toISOString(), updatedAt.toISOString(), roles`.

- **Proposed consolidation**: Extract a private `toAdminUserResponse(row, roles)` transformer following the **row-to-response-transformer** pattern. Then both `getUserWithRoles()` and the GET handler can call it. This also makes the return type explicitly `AdminUser` from `@snc/shared`, enforcing type safety at the transformation boundary.

  ```typescript
  const toAdminUserResponse = (
    row: UserRow,
    roles: Role[],
  ): AdminUser => ({
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: row.emailVerified,
    image: row.image,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    roles,
  });
  ```

- **Estimated scope**: 1 file, ~-10 LOC (net reduction)
- **Pattern reference**: `row-to-response-transformer` (existing pattern, not yet applied in admin)
- **Tests affected**: `apps/api/tests/routes/admin.routes.test.ts` -- no changes needed (behavior unchanged)
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 2. Dead export: `fetchAdminUsers` in web lib

- **Affected files**: `apps/web/src/lib/admin.ts:12-17`
- **Current state**: `fetchAdminUsers()` is exported but never imported anywhere in the codebase. The admin page uses `useCursorPagination` with its own `buildUrl` callback that constructs the URL and fetches directly. This is the correct pattern per `use-cursor-pagination` (which constructs its own URL and uses `fetchOptions` instead of lib helpers).
- **Proposed consolidation**: Remove the dead `fetchAdminUsers` export. It adds surface area, import candidates for autocomplete, and a maintenance obligation without any consumer. The `AdminUsersResponse` type import can also be removed from the file.
- **Estimated scope**: 1 file, ~-6 LOC
- **Pattern reference**: `web-fetch-client` -- the function itself follows the pattern correctly; it is just unused
- **Tests affected**: None (no test file exists for `lib/admin.ts`)
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

---

## P2 -- Medium Value

### 1. Missing shared schema tests for admin types

- **Location**: `packages/shared/tests/` (missing `admin.test.ts`)
- **Affected files**: `packages/shared/src/admin.ts`
- **Issue**: Every other domain (`content`, `creator`, `booking`, `subscription`, `dashboard`, `emissions`, `merch`) has a corresponding test file in `packages/shared/tests/`. The admin domain defines 6 schemas (`AdminUserSchema`, `AdminUsersQuerySchema`, `AdminUsersResponseSchema`, `AssignRoleRequestSchema`, `RevokeRoleRequestSchema`, `AdminUserResponseSchema`) but none are tested at the schema level. While the route tests exercise these schemas indirectly through `zValidator`, direct schema tests catch edge cases (e.g., `AdminUsersQuerySchema.default(20)` coercion, `RoleSchema` validation inside `AssignRoleRequestSchema`).
- **Suggestion**: Add `packages/shared/tests/admin.test.ts` following the pattern of `auth.test.ts` -- parse valid/invalid inputs for each schema, verify type-level assertions compile.
- **Tests affected**: New file only
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 2. Missing web lib test for `lib/admin.ts`

- **Location**: `apps/web/tests/unit/lib/` (missing `admin.test.ts`)
- **Affected files**: `apps/web/src/lib/admin.ts`
- **Issue**: Every other domain lib (`booking.ts`, `dashboard.ts`, `creator.ts`, `merch.ts`, `subscription.ts`, `content.ts`) has a corresponding test file. `lib/admin.ts` has 3 exported functions (`fetchAdminUsers`, `assignRole`, `revokeRole`) with no unit tests. If P1.2 removes `fetchAdminUsers`, only 2 functions remain, but they still need coverage for URL construction, method selection, and `encodeURIComponent` usage.
- **Suggestion**: Add `apps/web/tests/unit/lib/admin.test.ts` following the pattern of `dashboard.test.ts` or `booking.test.ts`.
- **Tests affected**: New file only
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 3. `batchGetUserRoles` duplicates `getUserRoles` logic

- **Location**: `apps/api/src/routes/admin.routes.ts:31-46` vs `apps/api/src/auth/user-roles.ts:10-17`
- **Affected files**: `apps/api/src/routes/admin.routes.ts`, `apps/api/src/auth/user-roles.ts`
- **Issue**: `getUserRoles` in `auth/user-roles.ts` queries roles for a single user. `batchGetUserRoles` in `admin.routes.ts` does the same query but with `inArray` for multiple users. Both query the same table with the same column selection. The batch version is only used in admin routes, so this is not a cross-file DRY violation per se, but the single-user version is called inside `getUserWithRoles()` which calls `batchGetUserRoles([userId])` -- an inefficient single-element batch. Consider either:
  - Making `batchGetUserRoles` a shared utility in `auth/user-roles.ts` alongside `getUserRoles`, or
  - Having `getUserWithRoles` call `getUserRoles` directly (since it only needs one user) instead of going through the batch function.
- **Suggestion**: Simplify `getUserWithRoles` to call `getUserRoles(userId)` directly from `auth/user-roles.ts` (eliminating the single-element batch call). Keep `batchGetUserRoles` private in admin routes for the paginated list endpoint only.
- **Tests affected**: `apps/api/tests/routes/admin.routes.test.ts` (mock setup may simplify slightly)
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

---

## P3 -- Nice-to-Have

- **`admin.routes.ts:98`**: `c.req.valid("query" as never) as AdminUsersQuery` uses a double cast (`as never` then `as AdminUsersQuery`). This is a known Hono-OpenAPI typing limitation that appears across all route files -- not admin-specific. Track as a cross-cutting concern if/when `hono-openapi` resolves its generics.
- **`admin.routes.ts:196,249`**: `c.json({ user: user! })` uses non-null assertion. The `getUserWithRoles` call follows a verified-exists check, so `user` is guaranteed non-null, but a guard clause or early return would be safer. Same pattern appears in both POST and DELETE handlers.
- **`user-role-manager.tsx:25`**: Extra whitespace in `useState<Role | "">(""  )` (two trailing spaces inside parentheses). Cosmetic only.

---

## Skip -- Intentional Patterns

| Pattern | Location | Why it stays |
|---------|----------|-------------|
| `as Role` cast on `row.role` | `admin.routes.ts:42,144` | Known-safe Drizzle enum cast; `userRoles.role` column stores valid `Role` values enforced by schema. Per `vertical-slice-lens.md` skip list. |
| API fixture uses `Date` objects, web fixture uses ISO strings | `admin-fixtures.ts` (both layers) | Intentional per `dual-layer-fixtures` pattern -- API tests mock DB rows (Date), web tests mock JSON responses (string). |
| `fetchAdminUsers` uses `apiGet` pattern correctly | `lib/admin.ts:12-17` | The function itself follows `web-fetch-client` pattern. It is dead code (P1.2 recommends removal), but the implementation is correct. |
| Admin page uses `useCursorPagination` with raw `buildUrl` | `admin.tsx:37-45` | Correct per `use-cursor-pagination` pattern -- lib helpers are not used inside this hook's `buildUrl` callback. |

---

## Best Practices Research

No admin-specific libraries to research. The admin slice uses the same stack as other domains (Hono, Drizzle, TanStack Router, CSS Modules) -- all of which have been researched in prior refactor cycles.

---

## OSS Alternatives

No candidates identified. The admin role management is a thin CRUD layer over the existing `user_roles` table and does not warrant an external RBAC library at this scale.

---

## Pattern Compliance

| Pattern | Status | Notes |
|---------|--------|-------|
| `row-to-response-transformer` | **Drift** | Inline mapping instead of extracted transformer (P1.1) |
| `route-private-helpers` | Compliant | `batchGetUserRoles` and `getUserWithRoles` are properly unexported helpers |
| `cursor-encode-decode` | Compliant | Uses `decodeCursor` + `buildPaginatedResponse` correctly |
| `css-modules-design-tokens` | Compliant | All CSS uses `var(--token)` references, no hardcoded values |
| `listing-page-shared-css` | Compliant | Uses `listingStyles.status`, `.loadMoreWrapper`, `.loadMoreButton` correctly |
| `web-fetch-client` | Compliant | `assignRole` and `revokeRole` use `apiMutate` correctly |
| `tanstack-file-route` | Compliant | `beforeLoad` with `fetchAuthStateServer` + role check + `redirect` |
| `vi-hoisted-module-mock` | Compliant | Web route test uses `vi.hoisted()` for `mockAssignRole`/`mockRevokeRole` |
| `dual-layer-fixtures` | Compliant | API fixtures use Date objects; web fixtures use ISO strings |
| `hono-test-app-factory` | Compliant | Uses `setupRouteTest` factory with `mountRoute` |
| `app-error-hierarchy` | Compliant | Uses `NotFoundError` and `ForbiddenError` from `@snc/shared` |

---

## Cross-Layer Continuity

### Schema-Transformer Alignment

| Shared Schema | Transformer | Status | Notes |
|---------------|-------------|--------|-------|
| `AdminUserSchema.id` | inline `u.id` | **Drift** | Not using named transformer (P1.1) |
| `AdminUserSchema.name` | inline `u.name` | **Drift** | Same |
| `AdminUserSchema.email` | inline `u.email` | **Drift** | Same |
| `AdminUserSchema.emailVerified` | inline `u.emailVerified` | **Drift** | Same |
| `AdminUserSchema.image` | inline `u.image` | **Drift** | Same |
| `AdminUserSchema.createdAt` | inline `u.createdAt.toISOString()` | **Drift** | Same |
| `AdminUserSchema.updatedAt` | inline `u.updatedAt.toISOString()` | **Drift** | Same |
| `AdminUserSchema.roles` | inline `rolesMap.get(u.id) ?? []` | **Drift** | Same |

All fields are present but mapped inline rather than via a named transformer. The return type is asserted via `AdminUser[]` type annotation rather than enforced by a typed transformer function.

### Validation Sync

| Field | Server Rule | Client Rule | Status |
|-------|-------------|-------------|--------|
| `role` (assign/revoke) | `RoleSchema` (Zod enum from `@snc/shared`) | No client-side validation | **Acceptable** |
| `limit` | `z.coerce.number().int().min(1).max(100).default(20)` | Hardcoded `"20"` in `buildUrl` | Synced |

No client-side form validation exists for role assignment because the role select dropdown only shows valid `ROLES` values from `@snc/shared`. The constraint is enforced by the UI control itself (dropdown options), not a Zod schema. This is acceptable.

### Error Path Coverage

| Error | API Route | Web Component | UI Treatment |
|-------|-----------|---------------|--------------|
| `NotFoundError` (user) | `admin.routes:185,239` | `AdminPage` | Caught by generic `try/catch`, shown via `actionError` alert |
| `ForbiddenError` (self-remove) | `admin.routes:229` | `AdminPage` | Caught by generic `try/catch`, shown via `actionError` alert |
| `400` (invalid role) | `zValidator` | `AdminPage` | Caught by generic `try/catch`, shown via `actionError` alert |
| `401` (unauthenticated) | `requireAuth` | `beforeLoad` | Redirected to `/login` before component mounts |
| `403` (non-admin) | `requireRole` | `beforeLoad` | Redirected to `/feed` before component mounts |
| Network error | N/A | `useCursorPagination` | Shown via `error` state in listing area |

All error paths have UI treatment. The `actionError` alert handles mutation errors generically, which is appropriate for an admin tool where specific error codes (e.g., "Cannot remove your own admin role") are conveyed in the error message itself.

### Type Chain

| Step | Type | Mechanism | Status |
|------|------|-----------|--------|
| Shared | `AdminUser` | `z.infer<typeof AdminUserSchema>` | Source of truth |
| Transformer | (inline mapping) | `AdminUser[]` type annotation | Weakly enforced (P1.1) |
| Web lib | `apiMutate<AdminUserResponse>` | Generic parameter | Matches shared |
| Component | `UserRoleManagerProps.user: AdminUser` | Props interface | Matches shared |

### Fixture Sync

| Entity | API Factory | Web Factory | Status | Notes |
|--------|-------------|-------------|--------|-------|
| AdminUser (response shape) | `makeMockAdminUser` (in `api/tests/helpers`) | `makeMockAdminUser` (in `web/tests/helpers`) | Synced | Both produce `AdminUser` with ISO strings and roles array |
| DB User row | `makeMockDbUser` (in `api/tests/helpers`) | N/A | N/A | API-only fixture for Drizzle row shape |

Note: The API fixture file exports **both** `makeMockAdminUser` (response shape with ISO strings) and `makeMockDbUser` (DB shape with Date objects). This is unusual -- most API fixture files only export the DB shape. The `makeMockAdminUser` in the API fixtures is not currently imported by any API test (the route tests use `makeMockDbUser`). It could be removed from the API fixtures to align with the `dual-layer-fixtures` pattern where response-shape fixtures live only in the web layer.

### Dead API Surface

| Field | API Returns | Web Reads | Status |
|-------|-------------|-----------|--------|
| `AdminUser.id` | Yes | Yes (`key`, callbacks) | Active |
| `AdminUser.name` | Yes | Yes (display) | Active |
| `AdminUser.email` | Yes | Yes (display) | Active |
| `AdminUser.emailVerified` | Yes | No | **Unused on web** |
| `AdminUser.image` | Yes | No | **Unused on web** |
| `AdminUser.createdAt` | Yes | No | **Unused on web** |
| `AdminUser.updatedAt` | Yes | No | **Unused on web** |
| `AdminUser.roles` | Yes | Yes (badges, dropdown) | Active |

`emailVerified`, `image`, `createdAt`, and `updatedAt` are returned by the API but not rendered in the admin UI. These are inherited from `UserSchema` (the admin schema extends it), so they are structurally expected. Not flagged as dead surface because they will likely be needed as the admin UI matures (e.g., showing user avatars, join dates, verification status).

---

## Suggested Implementation Order

1. **P1.1 -- Extract `toAdminUserResponse` transformer** (highest value, zero risk, aligns with core pattern)
2. **P1.2 -- Remove dead `fetchAdminUsers` export** (trivial, reduces surface area)
3. **P2.3 -- Simplify `getUserWithRoles` to use `getUserRoles` directly** (reduces indirection, simplifies test mocks)
4. **P2.1 -- Add shared schema tests for admin types** (fills coverage gap)
5. **P2.2 -- Add web lib admin tests** (fills coverage gap, depends on P1.2 deciding final exports)
6. **P3 items** -- opportunistic cleanup

Order by: dependencies first (P1.1 before P2.3), highest value, least risk.
