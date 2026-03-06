import { describe, it, expect } from "vitest";
import { Hono } from "hono";

import { createCorsMiddleware } from "../../src/middleware/cors.js";

const setupCorsApp = (origin: string | string[]): Hono => {
  const app = new Hono();
  app.use("*", createCorsMiddleware(origin));
  app.get("/test", (c) => c.json({ ok: true }));
  return app;
};

describe("corsMiddleware", () => {
  describe("with single origin", () => {
    const app = setupCorsApp("http://localhost:3001");

    it("sets CORS headers for allowed origin", async () => {
      const res = await app.request("/test", {
        headers: { Origin: "http://localhost:3001" },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBe(
        "http://localhost:3001",
      );
      expect(res.headers.get("access-control-allow-credentials")).toBe(
        "true",
      );
    });

    it("does not set CORS origin header for disallowed origin", async () => {
      const res = await app.request("/test", {
        headers: { Origin: "http://evil.com" },
      });

      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    });

    it("responds to preflight OPTIONS with correct methods and headers", async () => {
      const res = await app.request("/test", {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:3001",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Content-Type",
        },
      });

      const allowMethods = res.headers.get("access-control-allow-methods");
      expect(allowMethods).toContain("GET");
      expect(allowMethods).toContain("POST");
      expect(allowMethods).toContain("PATCH");
      expect(allowMethods).toContain("DELETE");
      expect(allowMethods).toContain("OPTIONS");

      const allowHeaders = res.headers.get("access-control-allow-headers");
      expect(allowHeaders).toContain("Content-Type");
      expect(allowHeaders).toContain("Authorization");
    });
  });

  describe("with multiple origins", () => {
    const app = setupCorsApp([
      "http://localhost:3001",
      "https://app.example.com",
    ]);

    it("allows the first origin in the list", async () => {
      const res = await app.request("/test", {
        headers: { Origin: "http://localhost:3001" },
      });

      expect(res.headers.get("access-control-allow-origin")).toBe(
        "http://localhost:3001",
      );
    });

    it("allows the second origin in the list", async () => {
      const res = await app.request("/test", {
        headers: { Origin: "https://app.example.com" },
      });

      expect(res.headers.get("access-control-allow-origin")).toBe(
        "https://app.example.com",
      );
    });

    it("rejects an origin not in the list", async () => {
      const res = await app.request("/test", {
        headers: { Origin: "http://evil.com" },
      });

      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    });
  });
});
