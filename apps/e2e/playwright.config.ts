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
  FEATURE_STREAMING: "true",
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
    // CI uses ports 3100/3101 to avoid colliding with the host's 3000/3001
    // (the Forgejo runner shares host-network mode — see
    // boards/workflow/BOARD.md park item on 2026-04-14). Local mode hits
    // staging via Caddy on 3082.
    baseURL: IS_CI ? "http://localhost:3101" : "http://localhost:3082",
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
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      dependencies: ["setup"],
    },
  ],

  webServer: IS_CI
    ? [
        {
          command: "bun run --filter @snc/api dev",
          port: 3100,
          reuseExistingServer: false,
          env: {
            ...PROD_FLAGS,
            PORT: "3100",
            // Web in CI runs on :3101 via Vite; API's default CORS_ORIGIN is
            // :3080 (the prod-like Caddy port). Override so the API trusts
            // requests coming from the CI web origin.
            CORS_ORIGIN: "http://localhost:3101",
            BETTER_AUTH_URL: "http://localhost:3101",
          },
          cwd: "../..",
        },
        {
          command: "cd apps/web && bun run vite -- --port 3101",
          port: 3101,
          reuseExistingServer: false,
          env: { ...VITE_FLAGS, VITE_API_URL: "http://localhost:3100" },
          cwd: "../..",
        },
      ]
    : [],
});
