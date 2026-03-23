import { describe, it, expect, vi } from "vitest";

import { logClientError } from "../../../src/lib/client-logger.js";

describe("logClientError", () => {
  it("logs structured error to console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logClientError({
      source: "error-boundary",
      location: "TestComponent",
      error: "Something broke",
      url: "http://localhost/test",
    });

    expect(spy).toHaveBeenCalledWith(
      "[client-error]",
      expect.stringContaining('"source":"error-boundary"'),
    );
    spy.mockRestore();
  });
});
