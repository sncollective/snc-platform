import { test as setup } from "@playwright/test";

import { USERS } from "./fixtures/test-users.js";

/**
 * Global setup: create per-role auth storage states by logging in
 * as the existing demo seed users (seeded by seed-demo.ts).
 */
setup("create auth storage states", async ({ request, baseURL }) => {
  const roles = [
    { user: USERS.alex, file: "auth/admin.json" },
    { user: USERS.maya, file: "auth/stakeholder.json" },
    { user: USERS.pat, file: "auth/subscriber.json" },
    // Jordan owns his creator profile but has no provisioned channel — exercises
    // the lazy channel-provisioning path (creator-programming-provisioning.spec.ts).
    { user: USERS.jordan, file: "auth/creator-unprovisioned.json" },
  ];

  // Origin must match the configured CORS_ORIGIN on the API. In CI that's
  // the Vite web port (baseURL); locally it's the Caddy staging port.
  const origin = baseURL ?? "http://localhost:3082";

  for (const { user, file } of roles) {
    const response = await request.post("/api/auth/sign-in/email", {
      data: { email: user.email, password: user.password },
      headers: { Origin: origin },
    });

    if (!response.ok()) {
      const body = await response.text();
      const retryAfter = response.headers()["retry-after"];
      const rateLimitHint = response.status() === 429
        ? [
            "Rate limited during auth setup",
            retryAfter ? `Retry-After=${retryAfter}s` : null,
            "ensure the API webServer env sets AUTH_RATE_LIMIT_PROFILE=e2e for CI",
          ]
            .filter(Boolean)
            .join("; ")
        : "";
      const detail = rateLimitHint ? ` (${rateLimitHint})` : "";
      throw new Error(
        `Auth setup failed for ${user.email}: ${response.status()} ${body}${detail}`,
      );
    }

    await request.storageState({ path: file });
  }
});
