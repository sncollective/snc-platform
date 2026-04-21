import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// jsdom does not implement scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

import { createRouterMock } from "../../../helpers/router-mock.js";

// ── Hoisted Mocks ──

const { mockUseRouterState, mockIsFeatureEnabled } = vi.hoisted(() => ({
  mockUseRouterState: vi.fn(),
  mockIsFeatureEnabled: vi.fn(),
}));

vi.mock("@tanstack/react-router", () =>
  createRouterMock({ useRouterState: mockUseRouterState }),
);

vi.mock("../../../../src/lib/config.js", () => ({
  DEMO_MODE: false,
  features: {},
  isFeatureEnabled: mockIsFeatureEnabled,
}));

// ── Import component under test (after mocks) ──

import { ContextShell } from "../../../../src/components/layout/context-shell.js";
import type { ContextNavConfig, ContextNavItem } from "../../../../src/config/context-nav.js";

// ── Fixtures ──

const THREE_ITEM_CONFIG: ContextNavConfig = {
  label: "Test Section",
  basePath: "/test",
  backTo: "/",
  backLabel: "Back",
  items: [
    { to: "", label: "Overview" },
    { to: "/alpha", label: "Alpha" },
    { to: "/beta", label: "Beta" },
  ],
};

function renderShell(
  config: ContextNavConfig = THREE_ITEM_CONFIG,
  options: { itemFilter?: (item: ContextNavItem) => boolean } = {},
) {
  return render(
    <ContextShell config={config} itemFilter={options.itemFilter}>
      <div>content</div>
    </ContextShell>,
  );
}

/**
 * Returns the inner <nav> element that holds sidebar items only.
 * The sidebar <aside role="navigation"> also contains the back link, so we
 * query the nav role within the sidebar to isolate nav items.
 */
function getSidebarNav() {
  // The aside has role="navigation" for AT; its inner <nav> is the items list
  const aside = screen.getByRole("navigation", { name: "Test Section navigation" });
  const innerNav = aside.querySelector("nav");
  if (!innerNav) throw new Error("Sidebar inner <nav> not found");
  return innerNav;
}

function getSidebarNavForConfig(label: string) {
  const aside = screen.getByRole("navigation", { name: `${label} navigation` });
  const innerNav = aside.querySelector("nav");
  if (!innerNav) throw new Error(`Sidebar inner <nav> not found for ${label}`);
  return innerNav;
}

function getChipBar(label: string = "Test Section") {
  return screen.getByRole("navigation", { name: `${label} mobile navigation` });
}

// ── Test Lifecycle ──

beforeEach(() => {
  mockUseRouterState.mockImplementation(
    (opts?: { select?: (s: unknown) => unknown }) => {
      const state = { location: { pathname: "/test" } };
      return opts?.select ? opts.select(state) : state;
    },
  );
  mockIsFeatureEnabled.mockReturnValue(true);
});

// ── Tests ──

describe("ContextShell", () => {
  describe("both nav surfaces render the same items", () => {
    it("renders sidebar nav with correct aria-label", () => {
      renderShell();
      expect(
        screen.getByRole("navigation", { name: "Test Section navigation" }),
      ).toBeInTheDocument();
    });

    it("renders chip bar nav with distinct aria-label", () => {
      renderShell();
      expect(
        screen.getByRole("navigation", { name: "Test Section mobile navigation" }),
      ).toBeInTheDocument();
    });

    it("sidebar and chip bar have distinct aria-labels (no duplicate landmark confusion)", () => {
      renderShell();
      const navs = screen.getAllByRole("navigation");
      const labels = navs.map((n) => n.getAttribute("aria-label"));
      expect(new Set(labels).size).toBe(labels.length);
    });

    it("renders all 3 items in the sidebar inner nav", () => {
      renderShell();
      const sidebarNav = getSidebarNav();
      const links = sidebarNav.querySelectorAll("a");
      expect(links).toHaveLength(3);
      expect(links[0]).toHaveTextContent("Overview");
      expect(links[1]).toHaveTextContent("Alpha");
      expect(links[2]).toHaveTextContent("Beta");
    });

    it("renders all 3 items in the chip bar nav", () => {
      renderShell();
      const chipBar = getChipBar();
      const links = chipBar.querySelectorAll("a");
      expect(links).toHaveLength(3);
      expect(links[0]).toHaveTextContent("Overview");
      expect(links[1]).toHaveTextContent("Alpha");
      expect(links[2]).toHaveTextContent("Beta");
    });
  });

  describe("active state — sidebar", () => {
    it("marks active sidebar item with aria-current=page when path matches (root item exact)", () => {
      mockUseRouterState.mockImplementation(
        (opts?: { select?: (s: unknown) => unknown }) => {
          const state = { location: { pathname: "/test" } };
          return opts?.select ? opts.select(state) : state;
        },
      );
      renderShell();
      const sidebarNav = getSidebarNav();
      const overviewLink = sidebarNav.querySelector("a[href='/test']");
      expect(overviewLink).toHaveAttribute("aria-current", "page");
    });

    it("marks active sidebar item with aria-current=page on sub-path", () => {
      mockUseRouterState.mockImplementation(
        (opts?: { select?: (s: unknown) => unknown }) => {
          const state = { location: { pathname: "/test/alpha/sub" } };
          return opts?.select ? opts.select(state) : state;
        },
      );
      renderShell();
      const sidebarNav = getSidebarNav();
      const alphaLink = sidebarNav.querySelector("a[href='/test/alpha']");
      expect(alphaLink).toHaveAttribute("aria-current", "page");
    });

    it("no sidebar item has aria-current on unmatched path", () => {
      mockUseRouterState.mockImplementation(
        (opts?: { select?: (s: unknown) => unknown }) => {
          const state = { location: { pathname: "/other" } };
          return opts?.select ? opts.select(state) : state;
        },
      );
      renderShell();
      const sidebarNav = getSidebarNav();
      const activeLinks = sidebarNav.querySelectorAll("a[aria-current]");
      expect(activeLinks).toHaveLength(0);
    });
  });

  describe("active state — chip bar", () => {
    it("marks active chip with aria-current=page when path matches (root item exact)", () => {
      mockUseRouterState.mockImplementation(
        (opts?: { select?: (s: unknown) => unknown }) => {
          const state = { location: { pathname: "/test" } };
          return opts?.select ? opts.select(state) : state;
        },
      );
      renderShell();
      const chipBar = getChipBar();
      const overviewChip = chipBar.querySelector("a[href='/test']");
      expect(overviewChip).toHaveAttribute("aria-current", "page");
    });

    it("marks active chip with aria-current=page on sub-path", () => {
      mockUseRouterState.mockImplementation(
        (opts?: { select?: (s: unknown) => unknown }) => {
          const state = { location: { pathname: "/test/beta/detail" } };
          return opts?.select ? opts.select(state) : state;
        },
      );
      renderShell();
      const chipBar = getChipBar();
      const betaChip = chipBar.querySelector("a[href='/test/beta']");
      expect(betaChip).toHaveAttribute("aria-current", "page");
    });

    it("no chip has aria-current on unmatched path", () => {
      mockUseRouterState.mockImplementation(
        (opts?: { select?: (s: unknown) => unknown }) => {
          const state = { location: { pathname: "/other" } };
          return opts?.select ? opts.select(state) : state;
        },
      );
      renderShell();
      const chipBar = getChipBar();
      const activeChips = chipBar.querySelectorAll("a[aria-current]");
      expect(activeChips).toHaveLength(0);
    });
  });

  describe("itemFilter hides items from BOTH surfaces identically", () => {
    it("filters out Beta from both sidebar and chip bar", () => {
      const filter = (item: ContextNavItem) => item.label !== "Beta";
      renderShell(THREE_ITEM_CONFIG, { itemFilter: filter });

      const sidebarNav = getSidebarNav();
      const chipBar = getChipBar();

      expect(sidebarNav.querySelectorAll("a")).toHaveLength(2);
      expect(chipBar.querySelectorAll("a")).toHaveLength(2);
      expect(sidebarNav.querySelector("a[href='/test/beta']")).toBeNull();
      expect(chipBar.querySelector("a[href='/test/beta']")).toBeNull();
    });

    it("filters out all items when filter returns false for all", () => {
      const filter = () => false;
      renderShell(THREE_ITEM_CONFIG, { itemFilter: filter });

      const sidebarNav = getSidebarNav();
      const chipBar = getChipBar();

      expect(sidebarNav.querySelectorAll("a")).toHaveLength(0);
      expect(chipBar.querySelectorAll("a")).toHaveLength(0);
    });
  });

  describe("featureFlag-gated items hide from BOTH surfaces when flag is off", () => {
    const CONFIG_WITH_FLAG: ContextNavConfig = {
      label: "Flagged",
      basePath: "/flagged",
      backTo: "/",
      backLabel: "Back",
      items: [
        { to: "", label: "Home" },
        { to: "/gated", label: "Gated Feature", featureFlag: "subscription" },
      ],
    };

    it("shows gated item in both surfaces when flag is on", () => {
      mockIsFeatureEnabled.mockReturnValue(true);
      mockUseRouterState.mockImplementation(
        (opts?: { select?: (s: unknown) => unknown }) => {
          const state = { location: { pathname: "/flagged" } };
          return opts?.select ? opts.select(state) : state;
        },
      );
      renderShell(CONFIG_WITH_FLAG);

      const sidebarNav = getSidebarNavForConfig("Flagged");
      const chipBar = getChipBar("Flagged");

      expect(sidebarNav.querySelectorAll("a")).toHaveLength(2);
      expect(chipBar.querySelectorAll("a")).toHaveLength(2);
    });

    it("hides gated item from both surfaces when flag is off", () => {
      mockIsFeatureEnabled.mockReturnValue(false);
      mockUseRouterState.mockImplementation(
        (opts?: { select?: (s: unknown) => unknown }) => {
          const state = { location: { pathname: "/flagged" } };
          return opts?.select ? opts.select(state) : state;
        },
      );
      renderShell(CONFIG_WITH_FLAG);

      const sidebarNav = getSidebarNavForConfig("Flagged");
      const chipBar = getChipBar("Flagged");

      expect(sidebarNav.querySelectorAll("a")).toHaveLength(1);
      expect(chipBar.querySelectorAll("a")).toHaveLength(1);
      expect(sidebarNav.querySelector("a[href='/flagged/gated']")).toBeNull();
      expect(chipBar.querySelector("a[href='/flagged/gated']")).toBeNull();
    });
  });
});
