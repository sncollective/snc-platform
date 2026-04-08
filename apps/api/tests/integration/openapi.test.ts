import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => {
  vi.resetModules();
});

describe("GET /api/openapi.json", () => {
  it("returns 200 with valid JSON", async () => {
    const { app } = await import("../../src/app.js");
    const res = await app.request("/api/openapi.json");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");

    const body = await res.json();
    expect(body).toBeDefined();
  });

  it("contains openapi field with 3.1 prefix", async () => {
    const { app } = await import("../../src/app.js");
    const res = await app.request("/api/openapi.json");
    const body = await res.json();

    expect(body.openapi).toBeDefined();
    expect(body.openapi).toMatch(/^3\.1/);
  });

  it("contains the /health path", async () => {
    const { app } = await import("../../src/app.js");
    const res = await app.request("/api/openapi.json");
    const body = await res.json();

    expect(body.paths).toBeDefined();
    expect(body.paths).toHaveProperty("/health");
  });

  it("contains info with API title", async () => {
    const { app } = await import("../../src/app.js");
    const res = await app.request("/api/openapi.json");
    const body = await res.json();

    expect(body.info).toBeDefined();
    expect(body.info.title).toBe("S/NC API");
    expect(body.info.version).toBe("1.0.0");
  });
});
