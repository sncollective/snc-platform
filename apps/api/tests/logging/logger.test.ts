import { describe, it, expect } from "vitest";
import { Transform } from "node:stream";

import { createRootLogger } from "../../src/logging/logger.js";

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

// ── Tests ──

describe("createRootLogger", () => {
  it("returns a logger with the configured level (warn)", () => {
    const logger = createRootLogger({ LOG_LEVEL: "warn" });
    expect(logger.level).toBe("warn");
  });

  it("returns a logger with the configured level (debug)", () => {
    const logger = createRootLogger({ LOG_LEVEL: "debug" });
    expect(logger.level).toBe("debug");
  });

  it("redacts authorization header", async () => {
    const { stream, lines } = captureOutput();
    const logger = createRootLogger({ LOG_LEVEL: "info" }, stream);

    logger.info({ req: { headers: { authorization: "Bearer secret" } } }, "test");

    await new Promise((resolve) => setImmediate(resolve));

    expect(lines.length).toBeGreaterThan(0);
    const parsed = JSON.parse(lines[0]!);
    expect(parsed.req.headers.authorization).toBe("[REDACTED]");
  });

  it("redacts cookie header", async () => {
    const { stream, lines } = captureOutput();
    const logger = createRootLogger({ LOG_LEVEL: "info" }, stream);

    logger.info({ req: { headers: { cookie: "session=abc123" } } }, "test");

    await new Promise((resolve) => setImmediate(resolve));

    expect(lines.length).toBeGreaterThan(0);
    const parsed = JSON.parse(lines[0]!);
    expect(parsed.req.headers.cookie).toBe("[REDACTED]");
  });

  it("info-level messages appear in output when level is info", async () => {
    const { stream, lines } = captureOutput();
    const logger = createRootLogger({ LOG_LEVEL: "info" }, stream);

    logger.info("hello from test");

    await new Promise((resolve) => setImmediate(resolve));

    expect(lines.length).toBeGreaterThan(0);
    const parsed = JSON.parse(lines[0]!);
    expect(parsed.msg).toBe("hello from test");
  });

  it("debug-level messages are suppressed when level is warn", async () => {
    const { stream, lines } = captureOutput();
    const logger = createRootLogger({ LOG_LEVEL: "warn" }, stream);

    logger.debug("this should not appear");

    await new Promise((resolve) => setImmediate(resolve));

    expect(lines).toHaveLength(0);
  });
});
