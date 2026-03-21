import { describe, it, expect, vi, afterEach } from "vitest";
import { Hono } from "hono";
import pino from "pino";
import { Transform } from "node:stream";

// ── Helpers ──

const captureOutput = () => {
  const lines: string[] = [];
  const stream = new Transform({
    transform(chunk, _enc, cb) {
      lines.push(chunk.toString().trim());
      cb();
    },
  });
  return { stream, lines };
};

const parseLines = (lines: string[]) =>
  lines
    .map((l) => {
      try {
        return JSON.parse(l) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter((e): e is Record<string, unknown> => e !== null);

// ── Tests ──

describe("requestLogger middleware", () => {
  afterEach(() => {
    vi.resetModules();
  });

  const setupApp = async () => {
    const { stream, lines } = captureOutput();
    const mockRootLogger = pino({ level: "info" }, stream);

    vi.doMock("../../src/logging/logger.js", () => ({
      rootLogger: mockRootLogger,
    }));

    const { requestIdMiddleware, requestLogger } = await import(
      "../../src/middleware/request-logger.js"
    );

    const app = new Hono();
    app.use("*", requestIdMiddleware);
    app.use("*", requestLogger);
    app.get("/test", (c) => {
      const logger = c.var.logger;
      return c.json({ hasLogger: logger !== undefined });
    });

    return { app, lines };
  };

  it("provides c.var.logger to handlers", async () => {
    const { app } = await setupApp();

    const res = await app.request("/test");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hasLogger).toBe(true);
  });

  it("uses x-request-id header as reqId when provided", async () => {
    const { app, lines } = await setupApp();

    await app.request("/test", {
      headers: { "x-request-id": "my-request-id-123" },
    });

    await new Promise((resolve) => setImmediate(resolve));

    const entries = parseLines(lines);
    const reqLog = entries.find((e) => e["reqId"] === "my-request-id-123");
    expect(reqLog).toBeDefined();
  });

  it("generates a UUID reqId when no x-request-id header is provided", async () => {
    const { app, lines } = await setupApp();

    await app.request("/test");

    await new Promise((resolve) => setImmediate(resolve));

    const entries = parseLines(lines);
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    const entryWithUuid = entries.find(
      (e) =>
        typeof e["reqId"] === "string" &&
        uuidPattern.test(e["reqId"] as string),
    );
    expect(entryWithUuid).toBeDefined();
  });

  it("logs structured response data including status code", async () => {
    const { app, lines } = await setupApp();

    await app.request("/test");

    await new Promise((resolve) => setImmediate(resolve));

    const entries = parseLines(lines);
    const resLog = entries.find((e) => e["statusCode"] !== undefined);
    expect(resLog).toBeDefined();
    expect(resLog!["statusCode"]).toBe(200);
  });
});
