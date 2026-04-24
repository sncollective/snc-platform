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
      throw new Error(
        `Auth setup failed for ${user.email}: ${response.status()} ${body}`,
      );
    }

    await request.storageState({ path: file });
  }
});
