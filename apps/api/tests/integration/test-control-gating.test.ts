import { describe, it, expect, vi, afterEach } from "vitest";

import { makeTestConfig } from "../helpers/test-constants.js";

const featureFlags = {
  subscription: false,
  merch: false,
  booking: false,
  emissions: false,
  federation: false,
};

const mockConfig = (testControlProfile: "disabled" | "e2e") => {
  vi.doMock("../../src/config.js", () => ({
    config: makeTestConfig({ TEST_CONTROL_PROFILE: testControlProfile }),
    features: featureFlags,
    parseOrigins: (raw: string) => raw.split(",").map((o) => o.trim()).filter(Boolean),
  }));
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("test-control route gating", () => {
  it("does not mount test-control routes by default", async () => {
    vi.stubEnv("NODE_ENV", "test");
    mockConfig("disabled");

    const { app } = await import("../../src/app.js");
    const res = await app.request("/api/test-control/status");

    expect(res.status).toBe(404);
  });

  it("mounts test-control routes under the explicit e2e test profile", async () => {
    vi.stubEnv("NODE_ENV", "test");
    mockConfig("e2e");

    const { app } = await import("../../src/app.js");
    const res = await app.request("/api/test-control/status");

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, profile: "e2e" });
  });

  it("does not mount test-control routes in production even if the e2e profile is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockConfig("e2e");

    const { app } = await import("../../src/app.js");
    const res = await app.request("/api/test-control/status");

    expect(res.status).toBe(404);
  });
});
