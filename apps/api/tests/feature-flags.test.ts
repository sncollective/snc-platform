import { describe, it, expect, vi, afterEach } from "vitest";

import { parseConfig, getFeatureFlags } from "../src/config.js";
import {
  TEST_DATABASE_URL,
  TEST_BETTER_AUTH_SECRET,
} from "./helpers/test-constants.js";

const BASE_ENV = {
  DATABASE_URL: TEST_DATABASE_URL,
  BETTER_AUTH_SECRET: TEST_BETTER_AUTH_SECRET,
};

afterEach(() => {
  vi.resetModules();
});

describe("getFeatureFlags", () => {
  it("extracts feature flags from config", () => {
    const cfg = parseConfig(BASE_ENV);
    const flags = getFeatureFlags(cfg);

    expect(flags).toStrictEqual({
      subscription: true,
      merch: true,
      booking: true,
      emissions: true,
      federation: false,
    });
  });

  it("reflects disabled flags from env", () => {
    const cfg = parseConfig({
      ...BASE_ENV,
      FEATURE_MERCH: "false",
      FEATURE_BOOKING: "false",
    });
    const flags = getFeatureFlags(cfg);

    expect(flags.merch).toBe(false);
    expect(flags.booking).toBe(false);
    expect(flags.subscription).toBe(true);
  });
});

describe("ENV_SCHEMA feature flag defaults", () => {
  it("defaults all feature flags to true when env vars absent", () => {
    const cfg = parseConfig(BASE_ENV);

    expect(cfg.FEATURE_SUBSCRIPTION).toBe(true);
    expect(cfg.FEATURE_MERCH).toBe(true);
    expect(cfg.FEATURE_BOOKING).toBe(true);
    expect(cfg.FEATURE_EMISSIONS).toBe(true);
  });

  it('sets flag to false when env var is "false"', () => {
    const cfg = parseConfig({
      ...BASE_ENV,
      FEATURE_SUBSCRIPTION: "false",
    });

    expect(cfg.FEATURE_SUBSCRIPTION).toBe(false);
  });

  it('sets flag to false for any non-"true" string', () => {
    const cfg = parseConfig({
      ...BASE_ENV,
      FEATURE_MERCH: "0",
    });

    expect(cfg.FEATURE_MERCH).toBe(false);
  });
});

describe("conditional route registration", () => {
  it("returns 404 for disabled feature routes", async () => {
    vi.doMock("../src/storage/index.js", () => ({
      storage: { download: vi.fn(), upload: vi.fn(), delete: vi.fn(), head: vi.fn() },
      s3Multipart: null,
    }));
    vi.doMock("../src/config.js", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../src/config.js")>();
      return {
        ...actual,
        features: {
          ...actual.features,
          merch: false,
        },
      };
    });

    const { app } = await import("../src/app.js");
    const res = await app.request("/api/merch");

    expect(res.status).toBe(404);
  });

  it("keeps health endpoint regardless of feature flags", async () => {
    vi.doMock("../src/storage/index.js", () => ({
      storage: { download: vi.fn(), upload: vi.fn(), delete: vi.fn(), head: vi.fn() },
      s3Multipart: null,
    }));
    vi.doMock("../src/config.js", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../src/config.js")>();
      return {
        ...actual,
        features: {
          subscription: false,
          merch: false,
          booking: false,
          emissions: false,
          federation: false,
        },
      };
    });

    const { app } = await import("../src/app.js");
    const res = await app.request("/health");

    expect(res.status).toBe(200);
  });
});
