import { defineConfig, devices } from "@playwright/test";

const IS_CI = !!process.env.CI;

/**
 * Locally: use the staging environment (port 3082 via Caddy) which mirrors
 * production feature flags (creator, admin, calendar, content ON).
 *
 * CI: start fresh servers with explicit feature flag env vars.
 */

/** Feature flags matching production defaults. */
const PROD_FLAGS = {
  FEATURE_CONTENT: "true",
  FEATURE_CREATOR: "true",
  FEATURE_ADMIN: "true",
  FEATURE_CALENDAR: "true",
  FEATURE_SUBSCRIPTION: "false",
  FEATURE_MERCH: "false",
  FEATURE_BOOKING: "false",
  FEATURE_DASHBOARD: "false",
  FEATURE_EMISSIONS: "false",
  FEATURE_FEDERATION: "false",
  FEATURE_STREAMING: "false",
};

/** Vite-prefixed flags for the web server. */
const VITE_FLAGS = Object.fromEntries(
  Object.entries(PROD_FLAGS).map(([k, v]) => [`VITE_${k}`, v]),
);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: IS_CI ? 2 : 0,
  workers: IS_CI ? 2 : undefined,
  reporter: IS_CI
    ? [["html", { open: "never" }], ["github"]]
    : [["html", { open: "on-failure" }]],

  use: {
    baseURL: IS_CI ? "http://localhost:3001" : "http://localhost:3082",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "setup",
      testDir: ".",
      testMatch: /global\.setup\.ts/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],

  webServer: IS_CI
    ? [
        {
          command: "pnpm --filter @snc/api dev",
          port: 3000,
          reuseExistingServer: false,
          env: { ...PROD_FLAGS },
          cwd: "../..",
        },
        {
          command: "pnpm --filter @snc/web dev",
          port: 3002,
          reuseExistingServer: false,
          env: { ...VITE_FLAGS, VITE_API_URL: "http://localhost:3000" },
          cwd: "../..",
        },
      ]
    : [],
});
