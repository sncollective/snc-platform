import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type React from "react";

// ── Hoisted Mocks ──

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
    createRootRoute: (options: Record<string, unknown>) => options,
    Outlet: () =>
      React.createElement("div", { "data-testid": "outlet" }, "Page content"),
  };
});

vi.mock("../../../src/components/layout/nav-bar.js", () => ({
  NavBar: () => null,
}));

vi.mock("../../../src/components/layout/footer.js", () => ({
  Footer: () => null,
}));

vi.mock("../../../src/components/layout/demo-banner.js", () => ({
  DemoBanner: () => null,
}));

vi.mock("../../../src/contexts/audio-player-context.js", async () => {
  const React = await import("react");
  return {
    AudioPlayerProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

vi.mock("../../../src/components/media/mini-player.js", () => ({
  MiniPlayer: () => null,
}));

vi.mock("../../../src/lib/config.js", () => ({
  DEMO_MODE: false,
}));

vi.mock("../../../src/styles/global.css?url", () => ({
  default: "global.css",
}));

// ── Component Under Test ──

let RootLayout: () => React.ReactElement;

beforeAll(async () => {
  const mod = await import("../../../src/routes/__root.js");
  RootLayout = mod.RootLayout;
});

// ── Lifecycle ──

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──

describe("RootLayout", () => {
  describe("skip-to-content link", () => {
    it("renders a skip-to-content link in the DOM", () => {
      render(<RootLayout />);
      const skipLink = screen.getByText("Skip to main content");
      expect(skipLink).toBeInTheDocument();
      expect(skipLink.tagName).toBe("A");
    });

    it("skip-to-content link has href targeting #main-content", () => {
      render(<RootLayout />);
      const skipLink = screen.getByText("Skip to main content");
      expect(skipLink).toHaveAttribute("href", "#main-content");
    });

    it("skip-to-content link has the skip-link CSS class", () => {
      render(<RootLayout />);
      const skipLink = screen.getByText("Skip to main content");
      expect(skipLink).toHaveClass("skip-link");
    });

    it("skip-to-content link is the first focusable element in the document", () => {
      const { container } = render(<RootLayout />);
      const allFocusable = container.querySelectorAll(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      expect(allFocusable.length).toBeGreaterThan(0);
      expect(allFocusable[0]).toHaveTextContent("Skip to main content");
    });
  });

  describe("main content landmark", () => {
    it("main element has id='main-content'", () => {
      render(<RootLayout />);
      const main = screen.getByRole("main");
      expect(main).toHaveAttribute("id", "main-content");
    });

    it("main element retains the main-content CSS class", () => {
      render(<RootLayout />);
      const main = screen.getByRole("main");
      expect(main).toHaveClass("main-content");
    });

    it("outlet content renders inside main", () => {
      render(<RootLayout />);
      const main = screen.getByRole("main");
      expect(main).toHaveTextContent("Page content");
    });
  });
});
