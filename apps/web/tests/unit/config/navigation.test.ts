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
  calendar: true,
  federation: true,
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

  it("all links have disabled: false when all features are enabled", async () => {
    vi.doMock("../../../src/lib/config.js", () => ({
      DEMO_MODE: false,
      features: ALL_ON,
      isFeatureEnabled: (flag: string) => ALL_ON[flag as keyof FeatureFlags],
    }));

    const { NAV_LINKS } = await import("../../../src/config/navigation.js");

    for (const link of NAV_LINKS) {
      expect(link.disabled).toBe(false);
    }
  });

  it("disabled features produce links with disabled: true", async () => {
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
    expect(labels).toContain("Merch");
    expect(labels).toContain("Services");
    expect(labels).toContain("Emissions");

    const merchLink = NAV_LINKS.find((l) => l.label === "Merch");
    const servicesLink = NAV_LINKS.find((l) => l.label === "Services");
    const emissionsLink = NAV_LINKS.find((l) => l.label === "Emissions");
    const feedLink = NAV_LINKS.find((l) => l.label === "Feed");

    expect(merchLink?.disabled).toBe(true);
    expect(servicesLink?.disabled).toBe(true);
    expect(emissionsLink?.disabled).toBe(true);
    expect(feedLink?.disabled).toBe(false);
  });

  it("always includes all 6 nav links regardless of feature state", async () => {
    const flags: FeatureFlags = {
      content: false,
      creator: false,
      subscription: false,
      merch: false,
      booking: false,
      dashboard: false,
      admin: false,
      emissions: false,
      calendar: false,
      federation: false,
    };

    vi.doMock("../../../src/lib/config.js", () => ({
      DEMO_MODE: false,
      features: flags,
      isFeatureEnabled: (flag: string) => flags[flag as keyof FeatureFlags],
    }));

    const { NAV_LINKS } = await import("../../../src/config/navigation.js");

    expect(NAV_LINKS).toHaveLength(6);
    for (const link of NAV_LINKS) {
      expect(link.disabled).toBe(true);
    }
  });
});
