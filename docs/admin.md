# Platform Administration

The admin domain provides user management and role assignment for platform operators. Admin endpoints live behind the `admin` feature flag and require authenticated users with the `admin` role. The frontend exposes a single `/admin` page where admins can browse all registered users and manage their platform roles. There is no user search endpoint — the user list is cursor-paginated and fetched in order of registration (newest first).

## How It Works

Platform roles use an **additive model**. Users start with no roles. An admin assigns roles by inserting rows into the `user_roles` join table. The only two platform roles are `admin` and `stakeholder` — defined as `ROLES` in `packages/shared/src/auth.ts`. There is no "creator" role; creator is an entity (a profile), not a role. See [auth.md](auth.md) for the full role system.

**Role assignment** is idempotent. The `POST` endpoint uses `INSERT ... ON CONFLICT DO NOTHING`, so assigning a role a user already has returns the current state without error.

**Role revocation** has a self-protection guard: an admin cannot remove their own `admin` role. This prevents accidental lockout. The `DELETE` endpoint silently succeeds if the role was already absent.

Both assign and revoke operations are **audit-logged** via structured logging. Each log entry includes the event type (`role_assigned` or `role_revoked`), the acting admin's ID, the target user's ID, the role, and the client IP address.

**Feature flags** control which route groups are mounted at startup. The `admin` flag gates the entire `/api/admin` route tree. Flags are resolved from environment variables at boot time via `getFeatureFlags()` in `apps/api/src/config.ts` — they are not runtime-toggleable through an API endpoint. See [feature-flags.md](feature-flags.md) for flag definitions and the `PRODUCTION_DEFAULTS` preset.

On the frontend, the `/admin` page checks the `admin` feature flag client-side via `isFeatureEnabled("admin")` and redirects to `/` if disabled. It then verifies the user is authenticated and holds the `admin` role before rendering.

## Routes

All routes are mounted at `/api/admin` when the `admin` feature flag is enabled (`apps/api/src/app.ts`).

| Method | Path | Auth | Description | Request Body | Response |
|--------|------|------|-------------|-------------|----------|
| `GET` | `/users` | `admin` | List users with roles (cursor-paginated) | — | `{ items: AdminUser[], nextCursor: string \| null }` |
| `POST` | `/users/:userId/roles` | `admin` | Assign a role to a user (idempotent) | `{ role: "admin" \| "stakeholder" }` | `{ user: AdminUser }` |
| `DELETE` | `/users/:userId/roles` | `admin` | Revoke a role from a user | `{ role: "admin" \| "stakeholder" }` | `{ user: AdminUser }` |

Every route requires both `requireAuth` (session validation, 401 on failure) and `requireRole("admin")` (role check, 403 on failure).

**Pagination:** The user list uses cursor-based keyset pagination ordered by `createdAt DESC, id DESC`. Query parameters: `cursor` (opaque string, optional) and `limit` (1-100, default 20). The frontend requests pages of 20 via `useCursorPagination<AdminUser>` with a "Load more" button.

## Schema

### `user_roles` table

Defined in `apps/api/src/db/schema/user.schema.ts`:

| Column | Type | Constraints |
|--------|------|------------|
| `user_id` | `text` | `NOT NULL`, FK to `users.id` (`ON DELETE CASCADE`) |
| `role` | `text` | `NOT NULL`, typed as `Role` (`"admin" \| "stakeholder"`) |
| `created_at` | `timestamp with time zone` | `NOT NULL`, default `NOW()` |

**Primary key:** composite `(user_id, role)` — a user can hold multiple roles, but each role appears at most once per user.

The `Role` type is derived from the `ROLES` constant: `["stakeholder", "admin"] as const`. Validation uses `RoleSchema` (a `z.enum(ROLES)`) from `packages/shared/src/auth.ts`.

### Shared types (`packages/shared/src/admin.ts`)

- `AdminUserSchema` — extends `UserSchema` with a `roles: Role[]` array
- `AdminUsersQuerySchema` — cursor pagination (max 100, default 20)
- `AdminUsersResponseSchema` — `{ items: AdminUser[], nextCursor: string | null }`
- `AssignRoleRequestSchema` / `RevokeRoleRequestSchema` — `{ role: Role }`
- `AdminUserResponseSchema` — `{ user: AdminUser }`

## Configuration

The admin routes are gated by the `admin` feature flag. In `PRODUCTION_DEFAULTS` (`packages/shared/src/features.ts`), the `admin` flag is **enabled by default**.

The `FEATURE_LABELS` entry for `admin`:
- **Name:** Admin
- **Description:** Platform administration and feature management.

No additional configuration (API keys, secrets) is required for the admin domain.

## Key Decisions

- **Additive role model.** Users have zero roles by default. Roles are granted explicitly, not inferred from payment status or account age. This keeps authorization auditable — every role has a corresponding `user_roles` row with a timestamp.
- **No user search.** The user list endpoint provides cursor pagination but no search/filter parameter. The frontend pages through users in registration order.
- **Idempotent assignment.** `ON CONFLICT DO NOTHING` means repeated `POST` calls are safe. Clients do not need to check current roles before assigning.
- **Self-revocation blocked.** Admins cannot revoke their own `admin` role. This is enforced server-side with a `ForbiddenError`.
- **Structured audit logging.** Role changes are logged with actor, target, role, and IP — not stored in a database audit table, but emitted via the structured logger (pino).
- **Feature flags are boot-time, not runtime.** Flags are resolved from environment variables when the server starts. There is no admin endpoint to toggle flags at runtime.

## Gotchas

- **The `admin` feature flag gates route mounting, not authorization.** If the flag is off, the `/api/admin` routes do not exist (404). If the flag is on, authorization is enforced per-request via `requireRole("admin")`. These are two separate gates.
- **Roles in the response are fetched separately.** The user list endpoint calls `batchGetUserRoles()` after fetching user rows — roles are not joined in the initial query. This means the `user_roles` table could be queried once per page load.
- **The `AdminUser` type includes `email`.** The admin user list exposes email addresses. This is intentional for user management but means the endpoint must stay admin-only.
- **No role exists for "patron" or "registered user."** The user tier model (Guest, Registered, Patron, Stakeholder, Admin) does not map 1:1 to the `user_roles` table. Only `admin` and `stakeholder` are stored as roles. Patron status comes from an active subscription, and registered user status comes from having an account. See [auth.md](auth.md).
- **`localUsers` state in the frontend.** The admin page keeps a `Map<string, AdminUser>` overlay (`localUsers`) to reflect role changes immediately without refetching the paginated list. The overlay is keyed by user ID and merges with the paginated data via `getUser()`.
