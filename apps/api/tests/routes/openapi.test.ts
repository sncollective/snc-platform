import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => {
  vi.resetModules();
});

const setupApp = async () => {
  vi.doMock("../../src/storage/index.js", () => ({
    storage: { download: vi.fn(), upload: vi.fn(), delete: vi.fn(), head: vi.fn() },
    s3Multipart: null,
  }));

  const { app } = await import("../../src/app.js");
  return app;
};

describe("GET /api/openapi.json", () => {
  it("returns 200 with valid JSON", async () => {
    const app = await setupApp();
    const res = await app.request("/api/openapi.json");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");

    const body = await res.json();
    expect(body).toBeDefined();
  });

  it("contains openapi field with 3.1 prefix", async () => {
    const app = await setupApp();
    const res = await app.request("/api/openapi.json");
    const body = await res.json();

    expect(body.openapi).toBeDefined();
    expect(body.openapi).toMatch(/^3\.1/);
  });

  it("contains the /health path", async () => {
    const app = await setupApp();
    const res = await app.request("/api/openapi.json");
    const body = await res.json();

    expect(body.paths).toBeDefined();
    expect(body.paths).toHaveProperty("/health");
  });

  it("contains info with API title", async () => {
    const app = await setupApp();
    const res = await app.request("/api/openapi.json");
    const body = await res.json();

    expect(body.info).toBeDefined();
    expect(body.info.title).toBe("S/NC API");
    expect(body.info.version).toBe("1.0.0");
  });
});
