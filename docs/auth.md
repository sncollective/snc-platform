# Authentication & Authorization

S/NC uses [Better Auth](https://www.better-auth.com/) for session-based authentication with email/password credentials, backed by a Drizzle/PostgreSQL adapter. The API server also acts as an **OIDC identity provider** (via Better Auth's `oidcProvider` plugin), allowing external services like Seafile to authenticate against S/NC. Authorization is role-based: platform roles (`admin`, `stakeholder`) are stored in a custom `user_roles` join table and loaded into every authenticated request's Hono context. Users without any platform role are registered users; paying users with an active platform subscription are patrons. "Creator" is an entity type, not a role — users participate in creator teams (see [creators.md](creators.md)).

## How It Works

### Server-side (API)

1. **Better Auth instance** (`apps/api/src/auth/auth.ts`) is configured with email/password auth, email verification, email OTP (for password resets), a JWT plugin (RS256 JWKS), and the OIDC provider plugin. The Drizzle adapter uses `usePlural: true`, so table names match the schema (`users`, `sessions`, etc.).

2. **Session validation** happens in Hono middleware. Three middleware variants cover all cases:
   - `requireAuth` (`middleware/require-auth.ts`) — resolves the session from request headers via `auth.api.getSession()`, hydrates user/session/roles onto the Hono context, and throws `UnauthorizedError` (401) if no valid session exists.
   - `optionalAuth` (`middleware/optional-auth.ts`) — same resolution, but sets `null`/empty values instead of throwing. Never errors.
   - `requireRole(...roles)` (`middleware/require-role.ts`) — factory that checks if the authenticated user holds at least one of the specified roles. Throws `ForbiddenError` (403) if not. Must be chained after `requireAuth`.

3. **Context hydration** (`middleware/auth-helpers.ts`) normalizes the raw Better Auth session into typed `User`, `Session`, and `Role[]` values. Dates are converted to ISO strings; `image` is normalized to `null`. Roles are fetched from the `user_roles` table via `getUserRoles()`.

4. **Typed Hono env** (`middleware/auth-env.ts`) defines `AuthEnv` with `Variables: { user, session, roles, logger }` so route handlers get full type safety via `c.get("user")` etc. `OptionalAuthEnv` (in `optional-auth.ts`) makes `user` and `session` nullable.

5. **OIDC provider** — S/NC acts as an identity provider. The `oidcProvider` plugin issues JWTs with `roles` in the user info claim (via `getAdditionalUserInfoClaim`). Trusted clients are declared in the Better Auth config and seeded into the database at startup by `seed-oidc-clients.ts` (upsert on `clientId`). PKCE is not required. Consent is skipped for trusted clients.

6. **Role lookup** (`auth/user-roles.ts`) provides `getUserRoles(userId)` and `batchGetUserRoles(userIds)` for single and batch role queries against the `user_roles` table.

### Client-side (Web)

1. **Better Auth client** (`apps/web/src/lib/auth-client.ts`) — a `createAuthClient()` instance with the `emailOTPClient` plugin. Provides `useSession()` for reactive session state.

2. **Auth state fetching** (`apps/web/src/lib/auth.ts`) — `fetchAuthState()` calls `GET /api/me` and returns `{ user, roles, isPatron }`. The `useAuthExtras()` hook re-fetches roles and patron status when the session changes. `hasRole(roles, role)` is a pure helper for role checks.

3. **Login redirects** (`apps/web/src/lib/return-to.ts`) — `buildLoginRedirect(currentPath)` attaches a `returnTo` query param (skipping `/`, `/login`, `/register`). `getValidReturnTo(returnTo)` sanitizes the value, rejecting non-relative paths and falling back to `/feed`.

4. **Guest redirect** (`apps/web/src/hooks/use-guest-redirect.ts`) — `useGuestRedirect()` redirects authenticated users away from login/register pages to `/feed`. Uses a `confirmedGuest` ref to prevent flicker during session refetch.

5. **Access denied** (`apps/web/src/lib/errors.ts`) — `AccessDeniedError` (403) is thrown by route `beforeLoad` guards when a user lacks required permissions.

## Routes

### Auth endpoints (`/api/auth/*`)

All auth endpoints are handled by Better Auth's built-in handler via a catch-all route. The following are explicitly documented with OpenAPI schemas:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/sign-up/email` | None | Register with name, email, password (min 8 chars). Sends verification email. |
| POST | `/api/auth/sign-in/email` | None | Authenticate with email and password. Sets session cookie. |
| POST | `/api/auth/sign-out` | Session | Destroy the current session. |
| GET | `/api/auth/get-session` | Optional | Return current session and user info, or null. |
| ALL | `/api/auth/*` | Varies | Catch-all for other Better Auth endpoints (OIDC, email verification, OTP, JWKS, etc.). |

### Session info endpoint

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/me` | Optional | Returns `{ user, session, roles, isPatron }` when authenticated; `{ user: null }` otherwise. Patron status is derived from an active platform-type subscription. |

## Schema

### `users` (Better Auth core)

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `name` | text | Required |
| `email` | text | Unique |
| `email_verified` | boolean | Default `false` |
| `image` | text | Nullable |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `sessions` (Better Auth core)

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `user_id` | text FK | References `users.id`, cascade delete |
| `token` | text | Unique session token |
| `expires_at` | timestamptz | |
| `ip_address` | text | Nullable |
| `user_agent` | text | Nullable |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `accounts` (Better Auth core)

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `user_id` | text FK | References `users.id`, cascade delete |
| `account_id` | text | |
| `provider_id` | text | e.g. `"credential"` for email/password |
| `access_token` | text | Nullable |
| `refresh_token` | text | Nullable |
| `password` | text | Hashed, for credential provider |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `verifications` (Better Auth core)

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `identifier` | text | e.g. email address |
| `value` | text | OTP or verification token |
| `expires_at` | timestamptz | |

### `user_roles` (custom)

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | text FK | References `users.id`, cascade delete |
| `role` | text | `"admin"` or `"stakeholder"` |
| `created_at` | timestamptz | Default `now()` |

Composite primary key on `(user_id, role)`.

### OIDC tables

Better Auth's `oidcProvider` plugin manages its own tables (defined in `db/schema/oidc.schema.ts`), including `oauth_applications` for registered clients.

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `BETTER_AUTH_SECRET` | Yes | Signing secret for sessions and tokens. Min 32 characters. |
| `BETTER_AUTH_URL` | Yes | Base URL of the API server (e.g. `http://localhost:3080`). Used as the JWT issuer prefix. |
| `CORS_ORIGIN` | Yes | Comma-separated allowed origins for CORS and Better Auth `trustedOrigins`. |
| `SEAFILE_OIDC_CLIENT_ID` | No | Client ID for the Seafile OIDC integration. When absent, the OIDC provider has no trusted clients. |
| `SEAFILE_OIDC_CLIENT_SECRET` | No | Client secret for Seafile. Min 32 characters when provided. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | No | SMTP credentials for sending verification and password reset emails. Email features degrade gracefully when absent. |
| `EMAIL_FROM` | No | Sender address. Defaults to `S/NC <noreply@s-nc.org>`. |

Feature flags that gate auth-adjacent behavior (e.g. `FEATURE_ADMIN`, `FEATURE_DASHBOARD`) are documented in [feature-flags.md](feature-flags.md).

## Key Decisions

- **Better Auth over custom auth** — provides session management, email verification, OIDC provider, and JWKS out of the box. The Drizzle adapter integrates directly with the existing ORM.

- **Session-based, not token-based** — the API uses cookie-based sessions. JWTs are only issued for OIDC clients (Seafile), not for first-party API calls.

- **Roles are separate from the user table** — the `user_roles` join table allows multiple roles per user and avoids schema changes when roles are added. Only two platform roles exist: `admin` and `stakeholder`.

- **Patron status is derived, not stored** — whether a user is a patron is computed at query time by checking for an active platform-type subscription in `user_subscriptions`. The `/api/me` endpoint returns `isPatron` as a convenience boolean.

- **S/NC as identity provider** — the platform acts as an OIDC provider so that Seafile (files.s-nc.org) can use S/NC accounts for login. The Seafile client is configured as a trusted client with `skipConsent: true` and a redirect URL of `https://files.s-nc.org/oauth/callback/`. The client record is upserted into the database on every API server startup.

- **PKCE not required** — the OIDC provider has `requirePKCE: false` because the Seafile client is a confidential (server-side) application that authenticates with a client secret.

- **Email verification sent but not required** — `sendOnSignUp: true` sends a verification email, but `requireEmailVerification: false` allows users to use the platform before verifying. This is a deliberate onboarding choice.

- **Password reset via OTP** — the `emailOTP` plugin handles the `forget-password` flow by sending a one-time code via email, avoiding magic-link infrastructure.

## Gotchas

- **`requireRole` must always follow `requireAuth`** — it reads `user` and `roles` from the Hono context, which are only set by `requireAuth`. Using `requireRole` alone will throw `UnauthorizedError` instead of `ForbiddenError`.

- **The `usePlural: true` adapter option is load-bearing** — Better Auth expects singular table names by default. The Drizzle schema uses plural names (`users`, `sessions`, `accounts`, `verifications`), so the adapter must be told to match. Removing this flag silently breaks all auth queries.

- **`hydrateAuthContext` converts Dates to ISO strings** — the raw Better Auth session has `Date` objects, but the shared `User` and `Session` types use ISO datetime strings. The hydration step in `auth-helpers.ts` performs this conversion. Client code that bypasses hydration will encounter type mismatches.

- **OIDC client seeding runs on every startup** — `seedOidcClients()` uses `INSERT ... ON CONFLICT DO UPDATE` so it is safe to call repeatedly. Config changes to the client secret or redirect URL are automatically picked up on the next deploy.

- **`returnTo` sanitization rejects non-relative paths** — `getValidReturnTo()` only accepts paths starting with a single `/`. Paths starting with `//` or containing `://` are treated as open-redirect attempts and fall back to `/feed`.

- **`useGuestRedirect` uses a ref to prevent flicker** — once a user is confirmed as a guest (no session, not pending), the hook locks to `true` so that session refetch events (e.g. window focus) do not unmount the login/register form.

- **Creator is not a role** — there is no `"creator"` entry in the `ROLES` array. Users interact with creator functionality through creator team membership. See [creators.md](creators.md) for details.
