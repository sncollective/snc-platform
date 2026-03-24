import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

// ── Public API ──

/** Better Auth client instance with email OTP plugin. */
export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
});
