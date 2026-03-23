import { describe, it, expect } from "vitest";

describe("ssrLogger", () => {
  it("exports a pino logger instance", async () => {
    const { ssrLogger } = await import("../../../src/lib/logger.js");
    expect(ssrLogger).toBeDefined();
    expect(typeof ssrLogger.info).toBe("function");
    expect(typeof ssrLogger.warn).toBe("function");
    expect(typeof ssrLogger.error).toBe("function");
  });
});
