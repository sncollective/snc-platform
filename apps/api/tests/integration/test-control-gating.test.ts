import { describe, it, expect, vi, afterEach } from "vitest";

import { makeTestConfig } from "../helpers/test-constants.js";

const featureFlags = {
  subscription: false,
  merch: false,
  booking: false,
  emissions: false,
  federation: false,
};

const TEST_CONTROL_SECRET = "test-control-secret-minimum-32-chars";
const TEST_CONTROL_HEADERS = { "x-test-control-secret": TEST_CONTROL_SECRET };

const mockConfig = (
  testControlProfile: "disabled" | "e2e",
  testControlSecret: string | undefined = TEST_CONTROL_SECRET,
) => {
  vi.doMock("../../src/config.js", () => ({
    config: makeTestConfig({
      TEST_CONTROL_PROFILE: testControlProfile,
      TEST_CONTROL_SECRET: testControlSecret,
    }),
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
    const res = await app.request("/api/test-control/status", {
      headers: TEST_CONTROL_HEADERS,
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, profile: "e2e" });
  });

  it("rejects mounted test-control routes when the shared secret is missing", async () => {
    vi.stubEnv("NODE_ENV", "test");
    mockConfig("e2e", undefined);

    const { app } = await import("../../src/app.js");
    const res = await app.request("/api/test-control/status");

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Test-control secret is not configured",
      },
    });
  });

  it("rejects destructive test-control routes without the shared secret header", async () => {
    vi.stubEnv("NODE_ENV", "test");
    mockConfig("e2e");

    const { app } = await import("../../src/app.js");
    const res = await app.request("/api/test-control/creator-programming/maya/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Invalid test-control secret",
      },
    });
  });

  it("does not mount test-control routes in production even if the e2e profile is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockConfig("e2e");

    const { app } = await import("../../src/app.js");
    const res = await app.request("/api/test-control/status");

    expect(res.status).toBe(404);
  });
});
