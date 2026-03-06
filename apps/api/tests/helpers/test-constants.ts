import type { Config } from "../../src/config.js";

// ── Test Constants ──

/** Database URL for unit test config mocks (no real connection made). */
export const TEST_DATABASE_URL = "postgres://test:test@localhost:5432/test";

/** Better Auth secret for unit test config mocks (>= 32 chars required). */
export const TEST_BETTER_AUTH_SECRET =
  "test-secret-that-is-at-least-thirty-two-characters";

/** Shopify store domain for unit test config mocks. */
export const TEST_SHOPIFY_STORE_DOMAIN = "test-store.myshopify.com";

/** Shopify Storefront API token for unit test config mocks. */
export const TEST_SHOPIFY_STOREFRONT_TOKEN = "test-storefront-token";

/** Factory for a valid config object for mocking `config.ts` in unit tests. */
export const makeTestConfig = (overrides?: Partial<Config>): Config => ({
  DATABASE_URL: TEST_DATABASE_URL,
  PORT: 3000,
  CORS_ORIGIN: "http://localhost:3080",
  BETTER_AUTH_SECRET: TEST_BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: "http://localhost:3080",
  STORAGE_TYPE: "local",
  STORAGE_LOCAL_DIR: "/tmp/snc-test-uploads",
  STRIPE_SECRET_KEY: "sk_test_mock_key_for_testing_only" as string | undefined,
  STRIPE_WEBHOOK_SECRET: "whsec_mock_webhook_secret_for_testing" as
    | string
    | undefined,
  SHOPIFY_STORE_DOMAIN: TEST_SHOPIFY_STORE_DOMAIN,
  SHOPIFY_STOREFRONT_TOKEN: TEST_SHOPIFY_STOREFRONT_TOKEN,
  ...overrides,
});

/** Minimal valid config object for mocking `config.ts` in unit tests. */
export const TEST_CONFIG = makeTestConfig();
