import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

// ── Public API ──

export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
});
