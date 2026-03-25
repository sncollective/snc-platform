import { describe, it, expect, vi, afterEach } from "vitest";

import type { FeatureFlags } from "@snc/shared";
import type { NavLink } from "../../../src/config/navigation.js";

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
  streaming: true,
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
    expect(labels).toContain("Live");
    expect(labels).toContain("Studio");
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
    expect(labels).toContain("Studio");
    expect(labels).toContain("Emissions");

    const merchLink = NAV_LINKS.find((l) => l.label === "Merch");
    const studioLink = NAV_LINKS.find((l) => l.label === "Studio");
    const emissionsLink = NAV_LINKS.find((l) => l.label === "Emissions");
    const feedLink = NAV_LINKS.find((l) => l.label === "Feed");

    expect(merchLink?.disabled).toBe(true);
    expect(studioLink?.disabled).toBe(true);
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
      streaming: false,
    };

    vi.doMock("../../../src/lib/config.js", () => ({
      DEMO_MODE: false,
      features: flags,
      isFeatureEnabled: (flag: string) => flags[flag as keyof FeatureFlags],
    }));

    const { NAV_LINKS } = await import("../../../src/config/navigation.js");

    expect(NAV_LINKS).toHaveLength(7);
    for (const link of NAV_LINKS) {
      expect(link.disabled).toBe(true);
    }
  });

  it("Studio link is an internal route", async () => {
    vi.doMock("../../../src/lib/config.js", () => ({
      DEMO_MODE: false,
      features: ALL_ON,
      isFeatureEnabled: (flag: string) => ALL_ON[flag as keyof FeatureFlags],
    }));

    const { NAV_LINKS } = await import("../../../src/config/navigation.js");

    const studioLink = NAV_LINKS.find((l) => l.label === "Studio");
    expect(studioLink).toBeDefined();
    expect(studioLink?.external).toBeUndefined();
    expect(studioLink?.to).toBe("/studio");
  });

});

describe("isNavLinkActive", () => {
  const makeLink = (overrides: Partial<NavLink> = {}): NavLink => ({
    to: "/feed",
    label: "Feed",
    ...overrides,
  });

  const allLinks: readonly NavLink[] = [
    { to: "/feed", label: "Feed" },
    { to: "/creators", label: "Creators" },
    { to: "/settings", label: "Settings" },
    { to: "/settings/subscriptions", label: "Subscriptions" },
  ];

  it("returns true for exact path match", async () => {
    vi.doMock("../../../src/lib/config.js", () => ({
      DEMO_MODE: false,
      features: ALL_ON,
      isFeatureEnabled: (flag: string) => ALL_ON[flag as keyof FeatureFlags],
    }));

    const { isNavLinkActive } = await import("../../../src/config/navigation.js");

    const link = makeLink({ to: "/feed" });
    expect(isNavLinkActive(link, "/feed", allLinks)).toBe(true);
  });

  it("returns true for prefix match", async () => {
    vi.doMock("../../../src/lib/config.js", () => ({
      DEMO_MODE: false,
      features: ALL_ON,
      isFeatureEnabled: (flag: string) => ALL_ON[flag as keyof FeatureFlags],
    }));

    const { isNavLinkActive } = await import("../../../src/config/navigation.js");

    const link = makeLink({ to: "/feed" });
    expect(isNavLinkActive(link, "/feed/123", allLinks)).toBe(true);
  });

  it("returns false for unrelated path", async () => {
    vi.doMock("../../../src/lib/config.js", () => ({
      DEMO_MODE: false,
      features: ALL_ON,
      isFeatureEnabled: (flag: string) => ALL_ON[flag as keyof FeatureFlags],
    }));

    const { isNavLinkActive } = await import("../../../src/config/navigation.js");

    const link = makeLink({ to: "/feed" });
    expect(isNavLinkActive(link, "/creators", allLinks)).toBe(false);
  });

  it("returns false when a more specific link claims the match", async () => {
    vi.doMock("../../../src/lib/config.js", () => ({
      DEMO_MODE: false,
      features: ALL_ON,
      isFeatureEnabled: (flag: string) => ALL_ON[flag as keyof FeatureFlags],
    }));

    const { isNavLinkActive } = await import("../../../src/config/navigation.js");

    const settingsLink = makeLink({ to: "/settings", label: "Settings" });
    expect(isNavLinkActive(settingsLink, "/settings/subscriptions", allLinks)).toBe(false);
  });

  it("returns true for the more specific link itself", async () => {
    vi.doMock("../../../src/lib/config.js", () => ({
      DEMO_MODE: false,
      features: ALL_ON,
      isFeatureEnabled: (flag: string) => ALL_ON[flag as keyof FeatureFlags],
    }));

    const { isNavLinkActive } = await import("../../../src/config/navigation.js");

    const subsLink = makeLink({ to: "/settings/subscriptions", label: "Subscriptions" });
    expect(isNavLinkActive(subsLink, "/settings/subscriptions", allLinks)).toBe(true);
  });

  it("returns false for external links", async () => {
    vi.doMock("../../../src/lib/config.js", () => ({
      DEMO_MODE: false,
      features: ALL_ON,
      isFeatureEnabled: (flag: string) => ALL_ON[flag as keyof FeatureFlags],
    }));

    const { isNavLinkActive } = await import("../../../src/config/navigation.js");

    const link = makeLink({ to: "/feed", external: true });
    expect(isNavLinkActive(link, "/feed", allLinks)).toBe(false);
  });

  it("returns false for disabled links", async () => {
    vi.doMock("../../../src/lib/config.js", () => ({
      DEMO_MODE: false,
      features: ALL_ON,
      isFeatureEnabled: (flag: string) => ALL_ON[flag as keyof FeatureFlags],
    }));

    const { isNavLinkActive } = await import("../../../src/config/navigation.js");

    const link = makeLink({ to: "/feed", disabled: true });
    expect(isNavLinkActive(link, "/feed", allLinks)).toBe(false);
  });
});
