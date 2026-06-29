module.exports = {
  apps: [
    {
      name: "api",
      cwd: "./apps/api",
      script: "./node_modules/.bin/tsx",
      args: "watch --ignore './uploads/**' --import ./src/env.ts src/index.ts",
      interpreter: "node",
      env: {
        NODE_ENV: "development",
        CORS_ORIGIN: "http://localhost:3080,http://localhost:3082",
        // Local e2e runs target the PM2-managed staging stack on localhost:3082.
        // Keep production strict/fail-closed, but make the dev API expose the
        // explicit e2e-only setup profile so `bun run --filter @snc/e2e test`
        // works without a manual PM2 env override.
        AUTH_RATE_LIMIT_PROFILE: "e2e",
        TEST_CONTROL_PROFILE: "e2e",
        TEST_CONTROL_SECRET: process.env.TEST_CONTROL_SECRET || "dev-e2e-test-control-secret-minimum-32-chars",
      },
      // Logging
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
      // Restart policy
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,
      // Must outlast the API's 30s shutdown force-exit bound (src/index.ts),
      // or PM2's SIGKILL races the graceful exit at exactly 30s.
      kill_timeout: 35000,
    },
    {
      name: "web",
      cwd: "./apps/web",
      script: "./node_modules/.bin/vite",
      args: "--port 3001 --strictPort",
      interpreter: "node",
      env: {
        NODE_ENV: "development",
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,
      kill_timeout: 30000,
    },
    {
      name: "web-staging",
      cwd: "./apps/web",
      script: "./node_modules/.bin/vite",
      args: "--port 3002 --strictPort",
      interpreter: "node",
      env: {
        NODE_ENV: "development",
        VITE_FEATURE_CONTENT: "true",
        VITE_FEATURE_CREATOR: "true",
        VITE_FEATURE_SUBSCRIPTION: "false",
        VITE_FEATURE_MERCH: "false",
        VITE_FEATURE_BOOKING: "false",
        VITE_FEATURE_DASHBOARD: "false",
        VITE_FEATURE_ADMIN: "true",
        VITE_FEATURE_EMISSIONS: "false",
        VITE_FEATURE_CALENDAR: "true",
        VITE_FEATURE_FEDERATION: "false",
        VITE_FEATURE_STREAMING: "true",
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,
    },
  ],
};
