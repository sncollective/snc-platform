import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => {
  vi.resetModules();
});

describe("GET /health", () => {
  it("returns 200 with { status: \"ok\" }", async () => {
    const { app } = await import("../../src/app.js");
    const res = await app.request("/health");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toStrictEqual({ status: "ok" });
  });

  it("returns JSON content-type header", async () => {
    const { app } = await import("../../src/app.js");
    const res = await app.request("/health");

    expect(res.headers.get("content-type")).toContain("application/json");
  });
});
