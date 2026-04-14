import type { Config } from "../../src/config.js";

// ── Test Constants ──

/** Database URL for unit test config mocks (no real connection made). */
export const TEST_DATABASE_URL = "postgres://test:test@localhost:5432/test";

/** Better Auth secret for unit test config mocks (>= 32 chars required). */
export const TEST_BETTER_AUTH_SECRET =
  "test-secret-that-is-at-least-thirty-two-characters";

/** SRS API URL for unit test config mocks. */
export const TEST_SRS_API_URL = "http://srs.test:1985";

/** SRS HLS URL for unit test config mocks. */
export const TEST_SRS_HLS_URL = "http://srs.test:8080/live/livestream.m3u8";

/** Shopify store domain for unit test config mocks. */
export const TEST_SHOPIFY_STORE_DOMAIN = "test-store.myshopify.com";

/** Shopify Storefront API token for unit test config mocks. */
export const TEST_SHOPIFY_STOREFRONT_TOKEN = "test-storefront-token";

/**
 * Factory for a valid config object for mocking `config.ts` in unit tests.
 *
 * The explicit `as Config` cast works around a TS2719 "two different types
 * with this name" that appears when the Zod v4 inferred `Config` type is
 * structurally identical but referentially distinct across this test file
 * and the config module. Same shape, different brand.
 */
export const makeTestConfig = (overrides?: Partial<Config>): Config => (({
  DATABASE_URL: TEST_DATABASE_URL,
  PORT: 3000,
  LOG_LEVEL: "info" as const,
  CORS_ORIGIN: "http://localhost:3080",
  BETTER_AUTH_SECRET: TEST_BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: "http://localhost:3080",
  STORAGE_TYPE: "local",
  STORAGE_LOCAL_DIR: "/tmp/snc-test-uploads",
  S3_REGION: "garage",
  STRIPE_SECRET_KEY: "sk_test_mock_key_for_testing_only",
  STRIPE_WEBHOOK_SECRET: "whsec_mock_webhook_secret_for_testing",
  SHOPIFY_STORE_DOMAIN: TEST_SHOPIFY_STORE_DOMAIN,
  SHOPIFY_STOREFRONT_TOKEN: TEST_SHOPIFY_STOREFRONT_TOKEN,
  SRS_API_URL: TEST_SRS_API_URL,
  SRS_HLS_URL: TEST_SRS_HLS_URL,
  PLAYOUT_STREAM_KEY: "pk_test_playout_key",
  PLAYOUT_CALLBACK_SECRET: "test-playout-callback-secret-minimum-32-chars",
  LIQUIDSOAP_RTMP_URL: "rtmp://snc-liquidsoap:1936/live/stream",
  FEATURE_SUBSCRIPTION: true,
  FEATURE_MERCH: true,
  FEATURE_BOOKING: true,
  FEATURE_EMISSIONS: true,
  MEDIA_TEMP_DIR: "/tmp/snc-media",
  MEDIA_FFMPEG_CONCURRENCY: 2,
  FEDERATION_DOMAIN: "s-nc.test",
  FEATURE_FEDERATION: false,
  ...overrides,
}) as Config);

/** Minimal valid config object for mocking `config.ts` in unit tests. */
export const TEST_CONFIG = makeTestConfig();
