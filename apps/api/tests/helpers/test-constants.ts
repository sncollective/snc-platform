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

/** Factory for a valid config object for mocking `config.ts` in unit tests. */
export const makeTestConfig = (overrides?: Partial<Config>): Config => ({
  DATABASE_URL: TEST_DATABASE_URL,
  PORT: 3000,
  LOG_LEVEL: "info" as const,
  CORS_ORIGIN: "http://localhost:3080",
  BETTER_AUTH_SECRET: TEST_BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: "http://localhost:3080",
  STORAGE_TYPE: "local",
  STORAGE_LOCAL_DIR: "/tmp/snc-test-uploads",
  S3_ENDPOINT: undefined as string | undefined,
  S3_REGION: "garage",
  S3_BUCKET: undefined as string | undefined,
  S3_ACCESS_KEY_ID: undefined as string | undefined,
  S3_SECRET_ACCESS_KEY: undefined as string | undefined,
  STRIPE_SECRET_KEY: "sk_test_mock_key_for_testing_only" as string | undefined,
  STRIPE_WEBHOOK_SECRET: "whsec_mock_webhook_secret_for_testing" as
    | string
    | undefined,
  SHOPIFY_STORE_DOMAIN: TEST_SHOPIFY_STORE_DOMAIN,
  SHOPIFY_STOREFRONT_TOKEN: TEST_SHOPIFY_STOREFRONT_TOKEN,
  SRS_API_URL: TEST_SRS_API_URL as string | undefined,
  SRS_HLS_URL: TEST_SRS_HLS_URL as string | undefined,
  PLAYOUT_STREAM_KEY: "pk_test_playout_key" as string | undefined,
  SRS_CALLBACK_SECRET: undefined as string | undefined,
  PLAYOUT_CALLBACK_SECRET: "test-playout-callback-secret-minimum-32-chars" as string | undefined,
  LIQUIDSOAP_API_URL: undefined as string | undefined,
  LIQUIDSOAP_RTMP_URL: "rtmp://snc-liquidsoap:1936/live/stream",
  FEATURE_CONTENT: true,
  FEATURE_CREATOR: true,
  FEATURE_SUBSCRIPTION: true,
  FEATURE_MERCH: true,
  FEATURE_BOOKING: true,
  FEATURE_DASHBOARD: true,
  FEATURE_ADMIN: true,
  FEATURE_EMISSIONS: true,
  FEATURE_CALENDAR: true,
  SEAFILE_OIDC_CLIENT_ID: undefined as string | undefined,
  SEAFILE_OIDC_CLIENT_SECRET: undefined as string | undefined,
  STUDIO_INQUIRY_EMAIL: undefined as string | undefined,
  FEDERATION_DOMAIN: "s-nc.test",
  FEATURE_FEDERATION: false,
  FEATURE_STREAMING: true,
  IMGPROXY_URL: undefined as string | undefined,
  IMGPROXY_KEY: undefined as string | undefined,
  IMGPROXY_SALT: undefined as string | undefined,
  ...overrides,
});

/** Minimal valid config object for mocking `config.ts` in unit tests. */
export const TEST_CONFIG = makeTestConfig();
