import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => {
  vi.resetModules();
});

describe("conditional route registration", () => {
  it("returns 404 for disabled feature routes", async () => {
    vi.doMock("../../src/config.js", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../../src/config.js")>();
      return {
        ...actual,
        features: {
          ...actual.features,
          merch: false,
        },
      };
    });

    const { app } = await import("../../src/app.js");
    const res = await app.request("/api/merch");

    expect(res.status).toBe(404);
  });

  it("keeps health endpoint regardless of feature flags", async () => {
    vi.doMock("../../src/config.js", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../../src/config.js")>();
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

    const { app } = await import("../../src/app.js");
    const res = await app.request("/health");

    expect(res.status).toBe(200);
  });
});
