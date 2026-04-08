import { describe, it, expect, vi, afterEach } from "vitest";
import { Hono } from "hono";

afterEach(() => {
  vi.resetModules();
});

describe("app boot", () => {
  it("assembles without throwing", async () => {
    const { app } = await import("../../src/app.js");

    expect(app).toBeInstanceOf(Hono);
  });
});
