---
id: feature-set-up-snc-login-prompt
kind: feature
stage: review
tags: [identity]
release_binding: null
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# Set Up S/NC Login Prompt

## Overview

After OAuth-only signup (Google/Apple/Twitch/Mastodon), prompt users to set a platform password so they can log in natively and optionally de-link their OAuth provider. The prompt appears as a dismissible banner on the settings page and checks whether the user has a `credential` provider in the `accounts` table.

14 new tests.

---

## Implementation Units

### Unit 1: API Endpoint — Check Account Providers

**File**: `apps/api/src/routes/me.routes.ts`

Add a `GET /api/me/providers` endpoint that returns the user's linked account providers:

```typescript
// Add to existing meRoutes:

meRoutes.get(
  "/providers",
  requireAuth,
  describeRoute({
    tags: ["me"],
    summary: "List linked account providers",
    responses: { 200: { description: "Provider list" } },
  }),
  async (c) => {
    const user = c.get("user");

    const rows = await db
      .select({ providerId: accounts.providerId })
      .from(accounts)
      .where(eq(accounts.userId, user.id));

    const providers = rows.map((r) => r.providerId);
    const hasPassword = providers.includes("credential");

    return c.json({ providers, hasPassword });
  },
);
```

**Implementation Notes**:

- Better Auth uses `providerId: "credential"` for email/password accounts (confirmed in `seed-demo.ts` line 290).
- OAuth accounts have `providerId: "google"`, `"apple"`, `"twitch"`, `"mastodon"`.
- A user who signed up via Google and later set a password will have both `"credential"` and `"google"` in their providers list.
- The `accounts` table is already imported in `me.routes.ts` or can be imported from `../db/schema/user.schema.js`.

**Acceptance Criteria**:

- [ ] Returns `{ providers: ["credential", "google"], hasPassword: true }` for a user with both
- [ ] Returns `{ providers: ["google"], hasPassword: false }` for OAuth-only user
- [ ] Auth required

---

### Unit 2: Settings Page Banner Component

**File**: `apps/web/src/components/auth/set-password-banner.tsx`

```typescript
import { useState, useEffect } from "react";
import type React from "react";

import { apiGet } from "../../lib/fetch-utils.js";
import { authClient } from "../../lib/auth-client.js";
import styles from "./set-password-banner.module.css";
import formStyles from "../../styles/form.module.css";

// ── Private Constants ──

const DISMISSED_KEY = "snc-set-password-dismissed";

// ── Public Types ──

export interface SetPasswordBannerProps {
  /** User email for the password setup form. */
  readonly email: string;
}

// ── Public API ──

/** Banner prompting OAuth-only users to set a platform password. */
export function SetPasswordBanner({
  email,
}: SetPasswordBannerProps): React.ReactElement | null {
  const [needsPassword, setNeedsPassword] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Check localStorage for dismissal
    if (localStorage.getItem(DISMISSED_KEY) === "true") {
      setDismissed(true);
      return;
    }

    // Check if user has a password
    const checkProviders = async () => {
      try {
        const data = await apiGet<{ hasPassword: boolean }>(
          "/api/me/providers",
        );
        setNeedsPassword(!data.hasPassword);
      } catch {
        // Silently fail — don't block the settings page
      }
    };
    void checkProviders();
  }, []);

  if (dismissed || !needsPassword || success) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setIsSubmitting(true);
    try {
      // Better Auth's changePassword expects currentPassword.
      // For OAuth-only users who have no password, use the
      // set-password endpoint if available, or email-based
      // password reset as a fallback.
      // Check Better Auth's API for a "set initial password" method.
      // If none exists, use the forget-password + OTP flow.
      //
      // Implementation detail: Better Auth's `changePassword` API
      // requires `currentPassword`. For users without a password,
      // the recommended approach is:
      // 1. Call authClient.emailOtp.sendVerificationOtp({ email, type: "forget-password" })
      // 2. User enters OTP
      // 3. Call authClient.emailOtp.resetPassword({ email, otp, newPassword })
      //
      // For simplicity in this first iteration, link to the
      // existing forgot-password page with a helpful message.

      // Simple approach: trigger password reset flow
      await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "forget-password",
      });

      setSuccess(true);
    } catch {
      setError("Failed to start password setup. Try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.banner} role="status">
      <div className={styles.content}>
        <p className={styles.message}>
          <strong>Set up an S/NC password</strong> — You signed in with a social
          account. Add a password so you can log in directly anytime.
        </p>
        {!showForm ? (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.setupButton}
              onClick={() => setShowForm(true)}
            >
              Set password
            </button>
            <button
              type="button"
              className={styles.dismissButton}
              onClick={handleDismiss}
            >
              Dismiss
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            {error && (
              <div className={formStyles.serverError} role="alert">
                {error}
              </div>
            )}
            {success ? (
              <p className={styles.successMessage}>
                Check your email for a password reset code. Use it on the{" "}
                <a href="/forgot-password">forgot password page</a> to set your
                password.
              </p>
            ) : (
              <>
                <p className={styles.formHint}>
                  We'll send a verification code to <strong>{email}</strong> to
                  set your password.
                </p>
                <button
                  type="submit"
                  className={styles.setupButton}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Sending code..." : "Send verification code"}
                </button>
                <button
                  type="button"
                  className={styles.dismissButton}
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
```

**File**: `apps/web/src/components/auth/set-password-banner.module.css`

```css
.banner {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  margin-bottom: var(--space-lg);
  background: var(--color-surface);
}

.content {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.message {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.actions {
  display: flex;
  gap: var(--space-sm);
}

.setupButton {
  padding: var(--space-xs) var(--space-md);
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: var(--color-primary-text);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.setupButton:hover:not(:disabled) {
  opacity: 0.9;
}

.setupButton:disabled {
  opacity: 0.5;
  cursor: default;
}

.dismissButton {
  padding: var(--space-xs) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.formHint {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.successMessage {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-success, #16a34a);
}
```

**Implementation Notes**:

- The banner is dismissible via localStorage. Once dismissed, it won't show again.
- Better Auth doesn't have a "set initial password" API for OAuth-only users. The simplest UX: send a password reset OTP to their email, then they use the existing forgot-password page to set the password. This reuses existing infrastructure.
- The banner checks `/api/me/providers` to determine if the user needs a password.
- The `email` prop comes from the auth state (user session).

**Acceptance Criteria**:

- [ ] Banner shows for OAuth-only users (no `credential` provider)
- [ ] Banner does not show for users who already have a password
- [ ] "Dismiss" persists via localStorage
- [ ] "Set password" sends OTP email
- [ ] Success message links to forgot-password page

---

### Unit 3: Integrate Banner into Settings Page

**File**: `apps/web/src/routes/settings/index.tsx`

Add the `SetPasswordBanner` above the existing "Change password" section:

```typescript
import { SetPasswordBanner } from "../../components/auth/set-password-banner.js";
import { useSession } from "../../lib/auth.js";

// In SettingsPage component:
function SettingsPage() {
  const session = useSession();
  const userEmail = session.data?.user?.email;

  return (
    <div className={settingsStyles.page}>
      <h1 className={listingStyles.heading}>Settings</h1>
      {userEmail && <SetPasswordBanner email={userEmail} />}
      <h2>Change password</h2>
      <ChangePasswordForm />
    </div>
  );
}
```

**Implementation Notes**:

- `useSession()` is already available from `../../lib/auth.js` (used throughout the app).
- The banner self-hides via its internal state — no conditional rendering needed beyond ensuring `userEmail` exists.

**Acceptance Criteria**:

- [ ] Banner appears on settings page for OAuth-only users
- [ ] Banner does not appear when user has a password
- [ ] Settings page renders normally when session has no email

---

## Implementation Order

1. **Unit 1** — API endpoint (`/api/me/providers`)
2. **Unit 2** — Banner component + CSS
3. **Unit 3** — Settings page integration

## Testing

### Unit Tests: `apps/api/tests/routes/me.routes.test.ts`

Add test for `GET /api/me/providers`:
- Returns `hasPassword: true` when user has credential provider
- Returns `hasPassword: false` when user only has OAuth providers
- Auth required

### Unit Tests: `apps/web/tests/unit/components/set-password-banner.test.tsx`

- Renders banner when `hasPassword: false`
- Does not render when `hasPassword: true`
- Dismiss hides banner and persists to localStorage
- "Set password" calls emailOtp API

## Verification Checklist

```bash
bun run --filter @snc/api test:unit
bun run --filter @snc/web test
```
