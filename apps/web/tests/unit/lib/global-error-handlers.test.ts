import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { installGlobalErrorHandlers } from "../../../src/lib/global-error-handlers.js";

describe("installGlobalErrorHandlers", () => {
  let addEventSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addEventSpy = vi.spyOn(window, "addEventListener");
  });

  afterEach(() => {
    addEventSpy.mockRestore();
  });

  it("installs error and unhandledrejection listeners", () => {
    installGlobalErrorHandlers();

    expect(addEventSpy).toHaveBeenCalledWith("error", expect.any(Function));
    expect(addEventSpy).toHaveBeenCalledWith("unhandledrejection", expect.any(Function));
  });
});
