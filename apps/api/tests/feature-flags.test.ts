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
      content: true,
      creator: true,
      subscription: true,
      merch: true,
      booking: true,
      dashboard: true,
      admin: true,
      emissions: true,
      calendar: true,
      federation: false,
      streaming: false,
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
    expect(flags.content).toBe(true);
  });
});

describe("ENV_SCHEMA feature flag defaults", () => {
  it("defaults all feature flags to true when env vars absent", () => {
    const cfg = parseConfig(BASE_ENV);

    expect(cfg.FEATURE_CONTENT).toBe(true);
    expect(cfg.FEATURE_CREATOR).toBe(true);
    expect(cfg.FEATURE_SUBSCRIPTION).toBe(true);
    expect(cfg.FEATURE_MERCH).toBe(true);
    expect(cfg.FEATURE_BOOKING).toBe(true);
    expect(cfg.FEATURE_DASHBOARD).toBe(true);
    expect(cfg.FEATURE_ADMIN).toBe(true);
    expect(cfg.FEATURE_EMISSIONS).toBe(true);
  });

  it('sets flag to false when env var is "false"', () => {
    const cfg = parseConfig({
      ...BASE_ENV,
      FEATURE_CONTENT: "false",
    });

    expect(cfg.FEATURE_CONTENT).toBe(false);
  });

  it('sets flag to false for any non-"true" string', () => {
    const cfg = parseConfig({
      ...BASE_ENV,
      FEATURE_ADMIN: "0",
    });

    expect(cfg.FEATURE_ADMIN).toBe(false);
  });
});

describe("conditional route registration", () => {
  it("returns 404 for disabled feature routes", async () => {
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
    vi.doMock("../src/config.js", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../src/config.js")>();
      return {
        ...actual,
        features: {
          content: false,
          creator: false,
          subscription: false,
          merch: false,
          booking: false,
          dashboard: false,
          admin: false,
          emissions: false,
          calendar: false,
        },
      };
    });

    const { app } = await import("../src/app.js");
    const res = await app.request("/health");

    expect(res.status).toBe(200);
  });
});
