---
id: feature-social-login-identity
kind: feature
stage: done
tags: [identity]
release_binding: 0.2.1
created: 2026-04-18
updated: 2026-04-20
related_decisions: []
related_designs: []
parent: null
---

# Social Login + Identity

## Sub-units

- [ ] Accounts table migration
- [ ] Social login — Google
- [ ] Social login — Apple
- [ ] Social login — Twitch
- [ ] Mastodon OAuth login

## Overview

Add social login via Google, Apple, Twitch, and Mastodon alongside existing email/password auth. Uses Better Auth's built-in social provider support for Google/Apple/Twitch, and a custom implementation for Mastodon (per-instance dynamic OAuth). The existing `accounts` table already supports provider linking — no schema migration needed for the core providers.

## Tech Reference Note

Better Auth v1.5.4 is installed. The exploration confirmed social providers are configured via `socialProviders` in the `betterAuth()` config, and the client calls `authClient.signIn.social({ provider })`. The `genericOAuth` plugin exists for custom providers but requires static endpoint configuration — unsuitable for Mastodon's per-instance model. Mastodon OAuth will be implemented as a custom flow outside Better Auth's plugin system.

---

## Implementation Units

### Unit 1: Environment Configuration for Social Providers

**File**: `apps/api/src/config.ts`

Add optional env vars for each social provider to the `ENV_SCHEMA`:

```typescript
// Inside ENV_SCHEMA definition, add alongside existing optional vars:

// Social Login — Google
GOOGLE_CLIENT_ID: z.string().optional(),
GOOGLE_CLIENT_SECRET: z.string().optional(),

// Social Login — Apple
APPLE_CLIENT_ID: z.string().optional(),
APPLE_CLIENT_SECRET: z.string().optional(),

// Social Login — Twitch (login only — basic profile scopes)
TWITCH_CLIENT_ID: z.string().optional(),
TWITCH_CLIENT_SECRET: z.string().optional(),

// Social Login — Mastodon (custom per-instance OAuth)
MASTODON_REDIRECT_URI: z.string().url().optional(),
```

**File**: `apps/web/src/lib/config.ts`

Add Vite env vars to expose which providers are available to the client:

```typescript
export const socialProviders = {
  google: import.meta.env.VITE_SOCIAL_GOOGLE === "true",
  apple: import.meta.env.VITE_SOCIAL_APPLE === "true",
  twitch: import.meta.env.VITE_SOCIAL_TWITCH === "true",
  mastodon: import.meta.env.VITE_SOCIAL_MASTODON === "true",
} as const;

export type SocialProvider = keyof typeof socialProviders;
```

**Implementation Notes**:

- All social provider env vars are optional — when absent, that provider is not available.
- Dev defaults: all absent = all disabled (unlike feature flags which default ON). Social providers require real OAuth credentials.
- The web config uses separate `VITE_SOCIAL_*` vars (not derived from API config) so Vite can replace them at build time.

**Acceptance Criteria**:

- [ ] API starts without social provider env vars (existing behavior unchanged)
- [ ] Web build succeeds with no `VITE_SOCIAL_*` vars
- [ ] Each provider var parsed correctly when present

---

### Unit 2: Better Auth Social Provider Configuration

**File**: `apps/api/src/auth/auth.ts`

Add social providers to the `betterAuth()` config. Only include providers whose env vars are present:

```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins/jwt";
import { oidcProvider } from "better-auth/plugins/oidc-provider";
import { emailOTP } from "better-auth/plugins/email-otp";

import { db } from "../db/connection.js";
import { config, parseOrigins } from "../config.js";
import * as userSchema from "../db/schema/user.schema.js";
import * as oidcSchema from "../db/schema/oidc.schema.js";
import { getUserRoles } from "./user-roles.js";
import { sendEmail } from "../email/send.js";
import { rootLogger } from "../logging/logger.js";

// ── Private Helpers ──

const schema = { ...userSchema, ...oidcSchema };

/** Build social providers config from available env vars. */
const buildSocialProviders = () => {
  const providers: Record<string, { clientId: string; clientSecret: string; scope?: string[] }> = {};

  if (config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET) {
    providers.google = {
      clientId: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
    };
  }

  if (config.APPLE_CLIENT_ID && config.APPLE_CLIENT_SECRET) {
    providers.apple = {
      clientId: config.APPLE_CLIENT_ID,
      clientSecret: config.APPLE_CLIENT_SECRET,
    };
  }

  if (config.TWITCH_CLIENT_ID && config.TWITCH_CLIENT_SECRET) {
    providers.twitch = {
      clientId: config.TWITCH_CLIENT_ID,
      clientSecret: config.TWITCH_CLIENT_SECRET,
      // Login only — basic profile scopes. Streaming scopes are separate.
      scope: ["user:read:email"],
    };
  }

  return providers;
};

// ── Public API ──

export const auth = betterAuth({
  // ... existing config stays unchanged ...
  socialProviders: buildSocialProviders(),
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "apple", "twitch"],
    },
  },
  // ... rest of existing config ...
});
```

**Implementation Notes**:

- `accountLinking.enabled: true` with `trustedProviders` means if a user signs up with Google using `alice@gmail.com`, and later signs in with email/password for the same email, the accounts are linked automatically. Trusted providers skip email verification for linking.
- The `accounts` table (already in `user.schema.ts`) stores each linked provider: `providerId` (e.g., "google"), `accountId` (provider's user ID), `accessToken`, `refreshToken`.
- Better Auth auto-creates rows in `accounts` on social sign-in. No additional schema changes needed.
- Scope for Twitch is explicitly limited to `user:read:email` for login. The streaming connect flow (separate design doc) will request additional scopes.

**Acceptance Criteria**:

- [ ] With Google env vars set, Google social login is available
- [ ] Without Google env vars, Google is not configured (no error)
- [ ] Account linking works: social login with matching email links to existing user
- [ ] New social sign-in creates user + account record
- [ ] Each provider's access/refresh tokens stored in accounts table

---

### Unit 3: Auth Client Social Provider Support

**File**: `apps/web/src/lib/auth-client.ts`

No changes needed to the auth client itself — Better Auth's client already supports `signIn.social()` when social providers are configured server-side. The existing `createAuthClient()` call is sufficient.

Verify the client API:

```typescript
// Usage in components (no change to auth-client.ts):
await authClient.signIn.social({
  provider: "google",   // | "apple" | "twitch"
  callbackURL: "/feed", // redirect after success
});
```

**Acceptance Criteria**:

- [ ] `authClient.signIn.social({ provider: "google" })` initiates OAuth flow
- [ ] Callback redirects to the specified URL after successful auth

---

### Unit 4: Social Login Buttons Component

**File**: `apps/web/src/components/auth/social-login-buttons.tsx`

```typescript
import type React from "react";

import { authClient } from "../../lib/auth-client.js";
import { socialProviders } from "../../lib/config.js";
import styles from "./social-login-buttons.module.css";

// ── Private Constants ──

const PROVIDER_CONFIG = {
  google: { label: "Google", icon: "google" },
  apple: { label: "Apple", icon: "apple" },
  twitch: { label: "Twitch", icon: "twitch" },
} as const;

type BuiltInProvider = keyof typeof PROVIDER_CONFIG;

// ── Public Types ──

export interface SocialLoginButtonsProps {
  /** URL to redirect to after successful social login. */
  readonly callbackURL: string;
  /** Whether to show Mastodon login option. */
  readonly onMastodonClick?: () => void;
}

// ── Public API ──

/** Social login provider buttons. Only renders providers enabled via env config. */
export function SocialLoginButtons({
  callbackURL,
  onMastodonClick,
}: SocialLoginButtonsProps): React.ReactElement | null {
  const enabledProviders = (Object.keys(PROVIDER_CONFIG) as BuiltInProvider[]).filter(
    (p) => socialProviders[p],
  );

  const hasMastodon = socialProviders.mastodon;

  if (enabledProviders.length === 0 && !hasMastodon) return null;

  const handleSocialLogin = (provider: BuiltInProvider) => {
    void authClient.signIn.social({ provider, callbackURL });
  };

  return (
    <div className={styles.container}>
      <div className={styles.divider}>
        <span>or continue with</span>
      </div>
      <div className={styles.buttons}>
        {enabledProviders.map((provider) => (
          <button
            key={provider}
            type="button"
            className={styles.providerButton}
            onClick={() => handleSocialLogin(provider)}
          >
            <span className={styles.providerIcon} data-provider={provider} />
            {PROVIDER_CONFIG[provider].label}
          </button>
        ))}
        {hasMastodon && onMastodonClick && (
          <button
            type="button"
            className={styles.providerButton}
            onClick={onMastodonClick}
          >
            <span className={styles.providerIcon} data-provider="mastodon" />
            Mastodon
          </button>
        )}
      </div>
    </div>
  );
}
```

**Acceptance Criteria**:

- [ ] Component renders only enabled providers
- [ ] Clicking a provider button initiates the OAuth flow
- [ ] Renders nothing when no providers are enabled
- [ ] Mastodon button calls `onMastodonClick` instead of direct OAuth

---

### Unit 5: Integrate Social Buttons into Login/Register Forms

**File**: `apps/web/src/components/auth/login-form.tsx`

Add `SocialLoginButtons` below the existing form:

```typescript
import { SocialLoginButtons } from "./social-login-buttons.js";
import { MastodonLoginDialog } from "./mastodon-login-dialog.js";

// Inside LoginForm component, add state:
const [showMastodonDialog, setShowMastodonDialog] = useState(false);

// After the closing </form> tag, before the component's closing:
return (
  <>
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {/* ... existing form fields ... */}
    </form>
    <SocialLoginButtons
      callbackURL={getValidReturnTo(returnTo)}
      onMastodonClick={() => setShowMastodonDialog(true)}
    />
    <MastodonLoginDialog
      open={showMastodonDialog}
      onClose={() => setShowMastodonDialog(false)}
    />
  </>
);
```

**File**: `apps/web/src/components/auth/register-form.tsx`

Same pattern — add `SocialLoginButtons` below the register form.

**Acceptance Criteria**:

- [ ] Social login buttons appear below the login form when providers are configured
- [ ] Social login buttons appear below the register form when providers are configured
- [ ] No visual change when no providers are configured
- [ ] Mastodon button opens the instance dialog

---

### Unit 6: Mastodon App Registration Table

**File**: `apps/api/src/db/schema/mastodon.schema.ts`

Mastodon requires dynamic OAuth app registration per instance. Store registered apps:

```typescript
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Mastodon OAuth app registrations per instance. Cached to avoid re-registering. */
export const mastodonApps = pgTable("mastodon_apps", {
  instanceDomain: text("instance_domain").primaryKey(),
  clientId: text("client_id").notNull(),
  clientSecret: text("client_secret").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

**Implementation Notes**:

- Primary key is the instance domain (e.g., `mastodon.social`). One app registration per instance.
- When a user logs in with a Mastodon instance we haven't seen before, we register an OAuth app via `POST https://{instance}/api/v1/apps` and cache the credentials here.
- Subsequent logins from the same instance reuse the cached app.

**Acceptance Criteria**:

- [ ] Migration generated via `bun run --filter @snc/api db:generate`
- [ ] Table created after `bun run --filter @snc/api db:migrate`

---

### Unit 7: Mastodon OAuth Service

**File**: `apps/api/src/services/mastodon-auth.ts`

```typescript
import { randomUUID, randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";
import type { AppError, Result } from "@snc/shared";
import { ok, err } from "@snc/shared";

import { db } from "../db/connection.js";
import { mastodonApps } from "../db/schema/mastodon.schema.js";
import { users, accounts } from "../db/schema/user.schema.js";
import { rootLogger } from "../logging/logger.js";
import { config } from "../config.js";
import { AppError as AppErrorClass } from "@snc/shared";
```

Key functions: `startMastodonAuth(instanceDomain)` — registers app on instance if needed, returns authorization URL. `handleMastodonCallback(code, state)` — validates state, exchanges code for token, fetches profile, creates or links user account.

**Implementation Notes**:

- **State management**: In-memory `Map` for CSRF state. Works for single-instance deployments (pre-1.0). For multi-instance, migrate to DB-backed or Redis-backed state.
- **Email handling**: Mastodon doesn't guarantee an email address. The `email` field stores `username@instance` as a unique identifier.
- **Account linking**: Query for existing linked accounts using `and(eq(providerId, "mastodon"), eq(accountId, providerAccountId))`.
- **Session creation**: After `handleMastodonCallback`, the route handler must create a Better Auth session for the user.

**Acceptance Criteria**:

- [ ] First login from an instance registers the app and caches credentials
- [ ] Second login from the same instance reuses cached credentials
- [ ] Authorization URL includes correct client_id, redirect_uri, scope, state
- [ ] Code exchange returns access token
- [ ] Profile fetch returns user info
- [ ] New user created with Mastodon account linked
- [ ] Returning user recognized by provider account ID

---

### Unit 8: Mastodon OAuth Routes

**File**: `apps/api/src/routes/mastodon-auth.routes.ts`

Mount at `/api/auth/mastodon` in `app.ts`. Routes:
- `POST /start` — validates instance domain, returns authorization URL
- `GET /callback` — handles OAuth redirect, creates session, redirects to `/feed`

Error cases redirect to `/login?error=...` for the UI to display.

**Acceptance Criteria**:

- [ ] POST `/api/auth/mastodon/start` with valid domain returns authorization URL
- [ ] POST `/api/auth/mastodon/start` with invalid domain returns 400
- [ ] GET `/api/auth/mastodon/callback` with valid code/state creates session and redirects
- [ ] GET `/api/auth/mastodon/callback` with invalid state redirects to login with error

---

### Unit 9: Mastodon Login Dialog

**File**: `apps/web/src/components/auth/mastodon-login-dialog.tsx`

Dialog for entering a Mastodon instance domain to initiate OAuth login. Strips protocol prefix and trailing slashes from input before submitting to `/api/auth/mastodon/start`. Redirects to the returned authorization URL.

**Acceptance Criteria**:

- [ ] Dialog opens when `open` is true
- [ ] Input strips protocol prefix and trailing slashes
- [ ] Submitting calls `/api/auth/mastodon/start` and redirects to authorization URL
- [ ] Error displayed on failed instance connection
- [ ] Cancel button closes dialog

---

## Implementation Order

1. **Unit 1** — Environment configuration (foundation)
2. **Unit 6** — Mastodon apps table + migration
3. **Unit 2** — Better Auth social provider config (Google/Apple/Twitch)
4. **Unit 3** — Verify auth client (no changes needed)
5. **Unit 7** — Mastodon OAuth service
6. **Unit 8** — Mastodon OAuth routes
7. **Unit 4** — Social login buttons component
8. **Unit 9** — Mastodon login dialog
9. **Unit 5** — Integrate into login/register forms

## Testing

### Unit Tests: `apps/api/tests/services/mastodon-auth.test.ts`

- Mock `fetch` for Mastodon API calls
- Test app registration: first call registers, second call uses cache
- Test authorization URL generation with correct params
- Test code exchange flow
- Test profile fetch and user creation
- Test state validation (expired, missing, reused)

### Unit Tests: `apps/api/tests/routes/mastodon-auth.routes.test.ts`

- Test POST `/start` with valid/invalid domain
- Test GET `/callback` with valid/invalid code/state
- Test redirect behavior on success/error

### Unit Tests: `apps/web/tests/components/social-login-buttons.test.tsx`

- Renders nothing when no providers enabled
- Renders only enabled providers
- Click calls `authClient.signIn.social` with correct provider

### Unit Tests: `apps/web/tests/components/mastodon-login-dialog.test.tsx`

- Dialog visible when `open` is true, hidden when false
- Domain cleaning (strips protocol, trailing slash, @)
- Submit calls API and redirects
- Error display on failure

## Verification Checklist

```bash
bun run --filter @snc/api db:generate
bun run --filter @snc/api db:migrate
bun run --filter @snc/shared build
bun run --filter @snc/api test:unit
bun run --filter @snc/web test
```
