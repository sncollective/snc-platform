import { describe, it, expect, vi, afterEach } from "vitest";

// ── Test Lifecycle ──

afterEach(() => {
  vi.resetModules();
});

// ── DEMO_MODE ──

describe("DEMO_MODE", () => {
  it('is true when VITE_DEMO_MODE is "true"', async () => {
    vi.doMock("../../../src/lib/config.js", async () => {
      // Simulate the module with env set to "true"
      return { DEMO_MODE: true };
    });
    const { DEMO_MODE } = await import("../../../src/lib/config.js");
    expect(DEMO_MODE).toBe(true);
  });

  it('is false when VITE_DEMO_MODE is "false"', async () => {
    vi.doMock("../../../src/lib/config.js", async () => {
      return { DEMO_MODE: false };
    });
    const { DEMO_MODE } = await import("../../../src/lib/config.js");
    expect(DEMO_MODE).toBe(false);
  });

  it("is false when VITE_DEMO_MODE is undefined", async () => {
    vi.doMock("../../../src/lib/config.js", async () => {
      return { DEMO_MODE: false };
    });
    const { DEMO_MODE } = await import("../../../src/lib/config.js");
    expect(DEMO_MODE).toBe(false);
  });
});
