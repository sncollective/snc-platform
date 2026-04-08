import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["tests/integration/**", "node_modules/**"],
    restoreMocks: true,
    mockReset: true,
    unstubGlobals: true,
    env: {
      DATABASE_URL: "postgres://test:test@localhost:5432/test",
      BETTER_AUTH_SECRET: "test-secret-that-is-at-least-thirty-two-characters",
      BETTER_AUTH_URL: "http://localhost:3000",
      STRIPE_SECRET_KEY: "sk_test_mock_key_for_testing_only",
      STRIPE_WEBHOOK_SECRET: "whsec_mock_webhook_secret_for_testing",
    },
  },
});
