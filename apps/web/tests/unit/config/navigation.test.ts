import { describe, it, expect, vi, afterEach } from "vitest";

import type { FeatureFlags } from "@snc/shared";

afterEach(() => {
  vi.resetModules();
});

const ALL_ON: FeatureFlags = {
  content: true,
  creator: true,
  subscription: true,
  merch: true,
  booking: true,
  dashboard: true,
  admin: true,
  emissions: true,
};

describe("NAV_LINKS", () => {
  it("includes all links when all features are enabled", async () => {
    vi.doMock("../../../src/lib/config.js", () => ({
      DEMO_MODE: false,
      features: ALL_ON,
      isFeatureEnabled: (flag: string) => ALL_ON[flag as keyof FeatureFlags],
    }));

    const { NAV_LINKS } = await import("../../../src/config/navigation.js");

    const labels = NAV_LINKS.map((l) => l.label);
    expect(labels).toContain("Feed");
    expect(labels).toContain("Creators");
    expect(labels).toContain("Services");
    expect(labels).toContain("Merch");
    expect(labels).toContain("Pricing");
    expect(labels).toContain("Emissions");
  });

  it("excludes links for disabled features", async () => {
    const flags: FeatureFlags = {
      ...ALL_ON,
      merch: false,
      booking: false,
      emissions: false,
    };

    vi.doMock("../../../src/lib/config.js", () => ({
      DEMO_MODE: false,
      features: flags,
      isFeatureEnabled: (flag: string) => flags[flag as keyof FeatureFlags],
    }));

    const { NAV_LINKS } = await import("../../../src/config/navigation.js");

    const labels = NAV_LINKS.map((l) => l.label);
    expect(labels).toContain("Feed");
    expect(labels).toContain("Creators");
    expect(labels).toContain("Pricing");
    expect(labels).not.toContain("Merch");
    expect(labels).not.toContain("Services");
    expect(labels).not.toContain("Emissions");
  });

  it("returns empty nav when all features are disabled", async () => {
    const flags: FeatureFlags = {
      content: false,
      creator: false,
      subscription: false,
      merch: false,
      booking: false,
      dashboard: false,
      admin: false,
      emissions: false,
    };

    vi.doMock("../../../src/lib/config.js", () => ({
      DEMO_MODE: false,
      features: flags,
      isFeatureEnabled: (flag: string) => flags[flag as keyof FeatureFlags],
    }));

    const { NAV_LINKS } = await import("../../../src/config/navigation.js");

    expect(NAV_LINKS).toHaveLength(0);
  });
});
