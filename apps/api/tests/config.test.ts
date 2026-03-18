import { describe, it, expect } from "vitest";
import { parseConfig, ENV_SCHEMA } from "../src/config.js";

import {
  TEST_DATABASE_URL,
  TEST_BETTER_AUTH_SECRET,
} from "./helpers/test-constants.js";

const TEST_STRIPE_SECRET_KEY = "sk_test_mock_key_for_testing_only";
const TEST_STRIPE_WEBHOOK_SECRET = "whsec_mock_webhook_secret_for_testing";

/** Minimal valid env for parseConfig calls in this test file. */
const BASE_ENV = {
  DATABASE_URL: TEST_DATABASE_URL,
  BETTER_AUTH_SECRET: TEST_BETTER_AUTH_SECRET,
  STRIPE_SECRET_KEY: TEST_STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: TEST_STRIPE_WEBHOOK_SECRET,
};

describe("parseConfig", () => {
  it("returns a valid Config when all required vars are set", () => {
    const result = parseConfig(BASE_ENV);

    expect(result).toStrictEqual({
      DATABASE_URL: TEST_DATABASE_URL,
      PORT: 3000,
      CORS_ORIGIN: "http://localhost:3080",
      BETTER_AUTH_SECRET: TEST_BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: "http://localhost:3080",
      STORAGE_TYPE: "local",
      STORAGE_LOCAL_DIR: "./uploads",
      STRIPE_SECRET_KEY: TEST_STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: TEST_STRIPE_WEBHOOK_SECRET,
      SMTP_PORT: 587,
      EMAIL_FROM: "S/NC <noreply@s-nc.org>",
      FEATURE_CONTENT: true,
      FEATURE_CREATOR: true,
      FEATURE_SUBSCRIPTION: true,
      FEATURE_MERCH: true,
      FEATURE_BOOKING: true,
      FEATURE_DASHBOARD: true,
      FEATURE_ADMIN: true,
      FEATURE_EMISSIONS: true,
      FEATURE_CALENDAR: true,
      FEDERATION_DOMAIN: "s-nc.org",
      FEATURE_FEDERATION: false,
      FEATURE_STREAMING: false,
    });
  });

  it("throws ZodError when DATABASE_URL is missing", () => {
    expect(() =>
      parseConfig({
        BETTER_AUTH_SECRET: TEST_BETTER_AUTH_SECRET,
        STRIPE_SECRET_KEY: TEST_STRIPE_SECRET_KEY,
        STRIPE_WEBHOOK_SECRET: TEST_STRIPE_WEBHOOK_SECRET,
      }),
    ).toThrow();
  });

  it("throws ZodError when DATABASE_URL is empty", () => {
    expect(() =>
      parseConfig({ ...BASE_ENV, DATABASE_URL: "" }),
    ).toThrow();
  });

  it("coerces PORT string to number", () => {
    const result = parseConfig({ ...BASE_ENV, PORT: "4000" });

    expect(result.PORT).toBe(4000);
  });

  it("applies default PORT when omitted", () => {
    const result = parseConfig(BASE_ENV);

    expect(result.PORT).toBe(3000);
  });

  it("applies default CORS_ORIGIN when omitted", () => {
    const result = parseConfig(BASE_ENV);

    expect(result.CORS_ORIGIN).toBe("http://localhost:3080");
  });

  it("accepts custom CORS_ORIGIN", () => {
    const result = parseConfig({
      ...BASE_ENV,
      CORS_ORIGIN: "https://example.com",
    });

    expect(result.CORS_ORIGIN).toBe("https://example.com");
  });

  it("throws ZodError when BETTER_AUTH_SECRET is missing", () => {
    expect(() =>
      parseConfig({
        DATABASE_URL: TEST_DATABASE_URL,
        STRIPE_SECRET_KEY: TEST_STRIPE_SECRET_KEY,
        STRIPE_WEBHOOK_SECRET: TEST_STRIPE_WEBHOOK_SECRET,
      }),
    ).toThrow();
  });

  it("throws ZodError when BETTER_AUTH_SECRET is shorter than 32 characters", () => {
    expect(() =>
      parseConfig({ ...BASE_ENV, BETTER_AUTH_SECRET: "too-short" }),
    ).toThrow();
  });

  it("applies default BETTER_AUTH_URL when omitted", () => {
    const result = parseConfig(BASE_ENV);

    expect(result.BETTER_AUTH_URL).toBe("http://localhost:3080");
  });

  it("accepts custom BETTER_AUTH_URL", () => {
    const result = parseConfig({
      ...BASE_ENV,
      BETTER_AUTH_URL: "https://auth.example.com",
    });

    expect(result.BETTER_AUTH_URL).toBe("https://auth.example.com");
  });

  it("throws ZodError when BETTER_AUTH_URL is not a valid URL", () => {
    expect(() =>
      parseConfig({ ...BASE_ENV, BETTER_AUTH_URL: "not-a-url" }),
    ).toThrow();
  });

  it("applies default STORAGE_TYPE when omitted", () => {
    const result = parseConfig(BASE_ENV);

    expect(result.STORAGE_TYPE).toBe("local");
  });

  it("accepts STORAGE_TYPE 'local'", () => {
    const result = parseConfig({ ...BASE_ENV, STORAGE_TYPE: "local" });

    expect(result.STORAGE_TYPE).toBe("local");
  });

  it("throws ZodError when STORAGE_TYPE is invalid", () => {
    expect(() =>
      parseConfig({ ...BASE_ENV, STORAGE_TYPE: "s3" }),
    ).toThrow();
  });

  it("applies default STORAGE_LOCAL_DIR when omitted", () => {
    const result = parseConfig(BASE_ENV);

    expect(result.STORAGE_LOCAL_DIR).toBe("./uploads");
  });

  it("accepts custom STORAGE_LOCAL_DIR", () => {
    const result = parseConfig({
      ...BASE_ENV,
      STORAGE_LOCAL_DIR: "/tmp/custom-uploads",
    });

    expect(result.STORAGE_LOCAL_DIR).toBe("/tmp/custom-uploads");
  });

  it("accepts config when STRIPE_SECRET_KEY is missing", () => {
    const result = parseConfig({
      DATABASE_URL: TEST_DATABASE_URL,
      BETTER_AUTH_SECRET: TEST_BETTER_AUTH_SECRET,
      STRIPE_WEBHOOK_SECRET: TEST_STRIPE_WEBHOOK_SECRET,
    });

    expect(result.STRIPE_SECRET_KEY).toBeUndefined();
  });

  it("accepts config when STRIPE_WEBHOOK_SECRET is missing", () => {
    const result = parseConfig({
      DATABASE_URL: TEST_DATABASE_URL,
      BETTER_AUTH_SECRET: TEST_BETTER_AUTH_SECRET,
      STRIPE_SECRET_KEY: TEST_STRIPE_SECRET_KEY,
    });

    expect(result.STRIPE_WEBHOOK_SECRET).toBeUndefined();
  });

  it("accepts config when SEAFILE_OIDC_CLIENT_ID is missing", () => {
    const result = parseConfig(BASE_ENV);

    expect(result.SEAFILE_OIDC_CLIENT_ID).toBeUndefined();
  });

  it("accepts config with SEAFILE_OIDC_CLIENT_ID set", () => {
    const result = parseConfig({
      ...BASE_ENV,
      SEAFILE_OIDC_CLIENT_ID: "seafile-client-id",
    });

    expect(result.SEAFILE_OIDC_CLIENT_ID).toBe("seafile-client-id");
  });

  it("accepts config with both Seafile OIDC client ID and secret", () => {
    const result = parseConfig({
      ...BASE_ENV,
      SEAFILE_OIDC_CLIENT_ID: "seafile-client-id",
      SEAFILE_OIDC_CLIENT_SECRET:
        "a-secret-that-is-at-least-thirty-two-chars",
    });

    expect(result.SEAFILE_OIDC_CLIENT_ID).toBe("seafile-client-id");
    expect(result.SEAFILE_OIDC_CLIENT_SECRET).toBe(
      "a-secret-that-is-at-least-thirty-two-chars",
    );
  });

  it("throws ZodError when SEAFILE_OIDC_CLIENT_SECRET is shorter than 32 chars", () => {
    expect(() =>
      parseConfig({
        ...BASE_ENV,
        SEAFILE_OIDC_CLIENT_SECRET: "too-short",
      }),
    ).toThrow();
  });
});
